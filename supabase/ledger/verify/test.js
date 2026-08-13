// Executes POLLINATE_LEDGER_SCHEMA.sql against a real Postgres and asserts every
// invariant the schema claims. Not a mock: embedded-postgres runs actual PG.
const EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');
const fs = require('fs');
const path = require('path');

const SCHEMA = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

// Minimal stand-ins for what Supabase already provides.
const SHIM = `
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table public.profiles (
  id uuid primary key,
  display_name text not null
);
`;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ' :: ' + detail : ''}`); }
}

async function expectFail(client, name, fn, matcher) {
  try {
    await fn();
    check(name, false, 'expected an error, got success');
  } catch (e) {
    const msg = e.message || String(e);
    check(name, matcher ? matcher.test(msg) : true, matcher ? `wrong error: ${msg}` : undefined);
  }
}

const PORT = 55433;
const USD = (n) => Math.round(n * 1_000_000); // dollars -> microUSD

async function main() {
  const dataDir = path.join(__dirname, 'pgdata');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'pw', port: PORT, persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('ledger');
  const client = pg.getPgClient('ledger');
  await client.connect();

  const ver = await client.query('show server_version');
  console.log(`\nPostgres ${ver.rows[0].server_version}\n`);

  console.log('— schema application —');
  await client.query(SHIM);
  try {
    await client.query(SCHEMA);
    check('schema applies cleanly', true);
  } catch (e) {
    check('schema applies cleanly', false, e.message);
    console.log('\nCannot continue.\n');
    process.exit(1);
  }

  // ---- fixtures -----------------------------------------------------------
  const alice = '11111111-1111-1111-1111-111111111111';
  const bob   = '22222222-2222-2222-2222-222222222222';
  await client.query(`insert into public.profiles (id, display_name) values ($1,'Alice'),($2,'Bob')`, [alice, bob]);

  const acct = {};
  for (const [key, kind, owner] of [
    ['aliceAvail', 'user_available', alice],
    ['aliceEscrow', 'user_seed_escrow', alice],
    ['bobAvail', 'user_available', bob],
    ['bobEscrow', 'user_seed_escrow', bob],
    ['cash', 'strike_cash', null],
    ['btc', 'strike_btc', null],
    ['pending', 'withdrawal_pending', null],
    ['fees', 'fee_income', null],
    ['fx', 'fx_reserve', null],
  ]) {
    const r = await client.query(
      `insert into public.ledger_accounts (kind, owner_user_id) values ($1,$2) returning id`, [kind, owner]);
    acct[key] = r.rows[0].id;
  }

  // Helper: write a whole transaction atomically.
  async function post(txn, legs) {
    await client.query('begin');
    try {
      const r = await client.query(
        `insert into public.ledger_transactions (kind, idempotency_key, source_poll_id, payout_id, memo)
         values ($1,$2,$3,$4,$5) returning id`,
        [txn.kind, txn.key, txn.pollId ?? null, txn.payoutId ?? null, txn.memo ?? null]);
      const id = r.rows[0].id;
      for (const leg of legs) {
        await client.query(
          `insert into public.ledger_postings (transaction_id, account_id, amount_microusd, seed_id)
           values ($1,$2,$3,$4)`, [id, leg.account, leg.amount, leg.seedId ?? null]);
      }
      await client.query('commit');
      return id;
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  }

  async function balance(accountId) {
    const r = await client.query(
      `select balance_microusd from public.ledger_account_balances where account_id=$1`, [accountId]);
    return Number(r.rows[0].balance_microusd);
  }

  async function mkPoll(userId, dollars) {
    const inv = await client.query(
      `insert into public.strike_invoices (user_id, requested_amount_microusd, strike_invoice_id, api_confirmed_at)
       values ($1,$2,gen_random_uuid(),now()) returning correlation_id`, [userId, USD(dollars)]);
    const corr = inv.rows[0].correlation_id;
    const poll = await client.query(
      `insert into public.strike_invoice_polls
         (correlation_id, observed_state, observed_amount_microusd, is_simulated, raw_response)
       values ($1,'PAID',$2,true,'{}'::jsonb) returning id`, [corr, USD(dollars)]);
    return { corr, pollId: poll.rows[0].id };
  }

  // ---- I1: balance enforcement -------------------------------------------
  console.log('\n— invariant I1: every transaction balances —');

  const f1 = await mkPoll(alice, 10);
  await post({ kind: 'funding', key: `fund:${f1.corr}`, pollId: f1.pollId },
    [{ account: acct.cash, amount: USD(10) }, { account: acct.aliceAvail, amount: -USD(10) }]);
  check('balanced funding commits', await balance(acct.aliceAvail) === -USD(10));
  check('asset side recorded', await balance(acct.cash) === USD(10));

  const f2 = await mkPoll(alice, 10);
  await expectFail(client, 'unbalanced transaction rejected at COMMIT', () =>
    post({ kind: 'funding', key: `fund:${f2.corr}`, pollId: f2.pollId },
      [{ account: acct.cash, amount: USD(10) }, { account: acct.aliceAvail, amount: -USD(9) }]),
    /unbalanced by/);

  const f3 = await mkPoll(alice, 10);
  await expectFail(client, 'single-posting transaction rejected', () =>
    post({ kind: 'funding', key: `fund:${f3.corr}`, pollId: f3.pollId },
      [{ account: acct.cash, amount: USD(10) }]),
    /requires at least 2/);

  // ---- I2: no overdraft ---------------------------------------------------
  console.log('\n— invariant I2: users cannot overdraw —');

  await expectFail(client, 'tip exceeding balance rejected', () =>
    post({ kind: 'tip', key: 'tip:overdraw' },
      [{ account: acct.aliceAvail, amount: USD(50) }, { account: acct.bobAvail, amount: -USD(50) }]),
    /overdraft/);

  await post({ kind: 'tip', key: 'tip:1' },
    [{ account: acct.aliceAvail, amount: USD(3) }, { account: acct.bobAvail, amount: -USD(3) }]);
  check('tip within balance succeeds', await balance(acct.bobAvail) === -USD(3));
  check('sender debited', await balance(acct.aliceAvail) === -USD(7));

  // ---- exactly-once crediting --------------------------------------------
  console.log('\n— exactly-once: idempotency —');

  await expectFail(client, 'replaying same correlationId credits only once', () =>
    post({ kind: 'funding', key: `fund:${f1.corr}`, pollId: f1.pollId },
      [{ account: acct.cash, amount: USD(10) }, { account: acct.aliceAvail, amount: -USD(10) }]),
    /duplicate key|idempotency_key/);
  check('balance unchanged after replay attempt', await balance(acct.aliceAvail) === -USD(7));

  // ---- webhook cannot move money -----------------------------------------
  console.log('\n— structural: webhooks are a nudge, not a write path —');

  await expectFail(client, 'funding without a poll is rejected', () =>
    post({ kind: 'funding', key: 'fund:nopoll' },
      [{ account: acct.cash, amount: USD(5) }, { account: acct.aliceAvail, amount: -USD(5) }]),
    /funding_requires_poll/);

  const fkPath = await client.query(`
    select count(*)::int as n
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY'
       and tc.table_name = 'ledger_transactions'
       and ccu.table_name = 'strike_webhook_deliveries'`);
  check('no FK path from ledger to webhook deliveries', fkPath.rows[0].n === 0);

  await expectFail(client, 'internal transfer cannot claim external authority', () =>
    post({ kind: 'tip', key: 'tip:fakepoll', pollId: f1.pollId },
      [{ account: acct.aliceAvail, amount: USD(1) }, { account: acct.bobAvail, amount: -USD(1) }]),
    /internal_kinds_have_no_poll/);

  // ---- immutability -------------------------------------------------------
  console.log('\n— append-only history —');

  await expectFail(client, 'UPDATE on postings blocked', () =>
    client.query(`update public.ledger_postings set amount_microusd = 1 where id = (select min(id) from public.ledger_postings)`),
    /append-only/);
  await expectFail(client, 'DELETE on postings blocked', () =>
    client.query(`delete from public.ledger_postings where id = (select min(id) from public.ledger_postings)`),
    /append-only/);
  await expectFail(client, 'UPDATE on transactions blocked', () =>
    client.query(`update public.ledger_transactions set memo = 'x'`),
    /append-only/);

  // ---- seed escrow lifecycle ---------------------------------------------
  console.log('\n— seed escrow: plant, bloom, refund —');

  const seedA = '33333333-3333-3333-3333-333333333333';
  const seedB = '44444444-4444-4444-4444-444444444444';

  await post({ kind: 'seed_plant', key: `seed:plant:${seedA}` },
    [{ account: acct.aliceAvail, amount: USD(2), seedId: seedA },
     { account: acct.aliceEscrow, amount: -USD(2), seedId: seedA }]);
  await post({ kind: 'seed_plant', key: `seed:plant:${seedB}` },
    [{ account: acct.aliceAvail, amount: USD(1), seedId: seedB },
     { account: acct.aliceEscrow, amount: -USD(1), seedId: seedB }]);

  check('escrow holds both seeds', await balance(acct.aliceEscrow) === -USD(3));
  check('available reduced by escrow', await balance(acct.aliceAvail) === -USD(4));

  const perSeed = await client.query(
    `select seed_id, escrowed_microusd from public.seed_escrow_balances order by escrowed_microusd desc`);
  check('per-seed escrow is provable without per-seed accounts',
    perSeed.rows.length === 2 && Number(perSeed.rows[0].escrowed_microusd) === USD(2),
    JSON.stringify(perSeed.rows));

  await post({ kind: 'seed_bloom', key: `seed:bloom:${seedA}` },
    [{ account: acct.aliceEscrow, amount: USD(2), seedId: seedA },
     { account: acct.bobAvail, amount: -USD(2), seedId: seedA }]);
  check('bloom moves escrow to recipient', await balance(acct.bobAvail) === -USD(5));

  await post({ kind: 'seed_refund', key: `seed:refund:${seedB}` },
    [{ account: acct.aliceEscrow, amount: USD(1), seedId: seedB },
     { account: acct.aliceAvail, amount: -USD(1), seedId: seedB }]);
  check('unclaimed seed refunds to sender', await balance(acct.aliceEscrow) === 0);

  const seedAfter = await client.query(`select count(*)::int n from public.seed_escrow_balances where escrowed_microusd <> 0`);
  check('no escrow left after bloom + refund', seedAfter.rows[0].n === 0);

  await expectFail(client, 'escrow cannot release more than was committed', () =>
    post({ kind: 'seed_bloom', key: 'seed:bloom:phantom' },
      [{ account: acct.aliceEscrow, amount: USD(99) }, { account: acct.bobAvail, amount: -USD(99) }]),
    /overdraft/);

  // ---- withdrawal: reserve then settle ------------------------------------
  console.log('\n— withdrawal: reserve before send —');

  const payout = await client.query(
    `insert into public.strike_payouts (user_id, amount_microusd, destination_kind, destination)
     values ($1,$2,'bolt11','lnbc...') returning id`, [bob, USD(5)]);
  const payoutId = payout.rows[0].id;

  await post({ kind: 'withdrawal_reserve', key: `wd:reserve:${payoutId}`, payoutId },
    [{ account: acct.bobAvail, amount: USD(5) }, { account: acct.pending, amount: -USD(5) }]);
  check('reserve moves funds out of spendable', await balance(acct.bobAvail) === 0);
  check('reserve parks funds as pending', await balance(acct.pending) === -USD(5));

  await expectFail(client, 'cannot spend reserved funds', () =>
    post({ kind: 'tip', key: 'tip:afterreserve' },
      [{ account: acct.bobAvail, amount: USD(1) }, { account: acct.aliceAvail, amount: -USD(1) }]),
    /overdraft/);

  await expectFail(client, 'withdrawal without a payout record rejected', () =>
    post({ kind: 'withdrawal_reserve', key: 'wd:nopayout' },
      [{ account: acct.aliceAvail, amount: USD(1) }, { account: acct.pending, amount: -USD(1) }]),
    /withdrawal_requires_payout/);

  await post({ kind: 'withdrawal_settle', key: `wd:settle:${payoutId}`, payoutId },
    [{ account: acct.pending, amount: USD(5) }, { account: acct.cash, amount: -USD(5) }]);
  check('settle clears pending', await balance(acct.pending) === 0);
  check('settle reduces our assets', await balance(acct.cash) === USD(5));

  // ---- rails mode tripwire ------------------------------------------------
  console.log('\n— tripwire: simulated mode refuses live observations —');

  const modeInv = await client.query(
    `insert into public.strike_invoices (user_id, requested_amount_microusd) values ($1,$2) returning correlation_id`,
    [alice, USD(1)]);
  await expectFail(client, 'live poll rejected while mode=simulated', () =>
    client.query(`insert into public.strike_invoice_polls
      (correlation_id, observed_state, observed_amount_microusd, is_simulated, raw_response)
      values ($1,'PAID',$2,false,'{}'::jsonb)`, [modeInv.rows[0].correlation_id, USD(1)]),
    /rails mode is simulated/);

  await client.query(`update public.ledger_settings set rails_mode='live' where id`);
  await expectFail(client, 'simulated poll rejected once mode=live', () =>
    client.query(`insert into public.strike_invoice_polls
      (correlation_id, observed_state, observed_amount_microusd, is_simulated, raw_response)
      values ($1,'PAID',$2,true,'{}'::jsonb)`, [modeInv.rows[0].correlation_id, USD(1)]),
    /rails mode is live/);
  await client.query(`update public.ledger_settings set rails_mode='simulated' where id`);

  // ---- global invariants --------------------------------------------------
  console.log('\n— global invariants —');

  const zero = await client.query(`select coalesce(sum(balance_microusd),0)::bigint as t from public.ledger_account_balances`);
  check('sum of ALL account balances is exactly zero', Number(zero.rows[0].t) === 0, `got ${zero.rows[0].t}`);

  const drift = await client.query(`select * from public.ledger_verify_balance_cache()`);
  check('balance cache matches recomputation from postings', drift.rows.length === 0, JSON.stringify(drift.rows));

  const sol = await client.query(`select * from public.ledger_solvency()`);
  const s = sol.rows[0];
  check('solvency reports solvent under normal operation', s.is_solvent === true, JSON.stringify(s));
  check('assets cover user liabilities',
    Number(s.assets_microusd) >= Number(s.user_liabilities_microusd),
    `assets=${s.assets_microusd} liabilities=${s.user_liabilities_microusd}`);

  // ---- the FX scenario: this is the one that bites ------------------------
  console.log('\n— FX exposure: USD-denominated liabilities against a BTC-denominated float —');

  // Fund $100 that settles into BTC rather than USD cash.
  const f4 = await mkPoll(bob, 100);
  await post({ kind: 'funding', key: `fund:${f4.corr}`, pollId: f4.pollId },
    [{ account: acct.btc, amount: USD(100) }, { account: acct.bobAvail, amount: -USD(100) }]);

  const before = await client.query(`select * from public.ledger_solvency()`);
  check('solvent while BTC mark holds', before.rows[0].is_solvent === true);

  // BTC drops 30%. Our liability to Bob is still $100. Mark the asset down.
  await post({ kind: 'fx_mark', key: 'fx:btc-drop-30', memo: 'BTC mark down 30%' },
    [{ account: acct.fx, amount: USD(30) }, { account: acct.btc, amount: -USD(30) }]);

  const after = await client.query(`select * from public.ledger_solvency()`);
  check('a 30% BTC drawdown is detected as INSOLVENCY, not silently absorbed',
    after.rows[0].is_solvent === false,
    JSON.stringify(after.rows[0]));
  check('shortfall is quantified, not just flagged',
    Number(after.rows[0].coverage_microusd) === -USD(30),
    `coverage=${after.rows[0].coverage_microusd}`);

  const stillZero = await client.query(`select coalesce(sum(balance_microusd),0)::bigint as t from public.ledger_account_balances`);
  check('ledger still sums to zero even while insolvent', Number(stillZero.rows[0].t) === 0);

  // ---- funding must match the invoice it claims ---------------------------
  // Run last: these change balances, and asserting relative to the current state
  // keeps them independent of everything above.
  console.log('\n— funding is tied to the payer and the amount —');

  const wrongUser = await mkPoll(alice, 20);
  await expectFail(client, 'funding cannot credit a user who did not pay', () =>
    post({ kind: 'funding', key: `fund:${wrongUser.corr}`, pollId: wrongUser.pollId },
      [{ account: acct.cash, amount: USD(20) }, { account: acct.bobAvail, amount: -USD(20) }]),
    /not owned by the invoice payer/);

  const wrongAmt = await mkPoll(alice, 20);
  await expectFail(client, 'funding cannot credit more than was observed paid', () =>
    post({ kind: 'funding', key: `fund:${wrongAmt.corr}`, pollId: wrongAmt.pollId },
      [{ account: acct.cash, amount: USD(200) }, { account: acct.aliceAvail, amount: -USD(200) }]),
    /observed payment was/);

  const aliceBefore = await balance(acct.aliceAvail);
  const feesBefore = await balance(acct.fees);
  const feeSplit = await mkPoll(alice, 10);
  await post({ kind: 'funding', key: `fund:${feeSplit.corr}`, pollId: feeSplit.pollId },
    [{ account: acct.cash, amount: USD(10) },
     { account: acct.aliceAvail, amount: -USD(9.75) },
     { account: acct.fees, amount: -USD(0.25) }]);
  check('fee split against a funding invoice is allowed',
    await balance(acct.fees) === feesBefore - USD(0.25));
  check('user credited net of fee',
    await balance(acct.aliceAvail) === aliceBefore - USD(9.75));

  // ---- concurrency: the classic double-spend ------------------------------
  console.log('\n— concurrency: two simultaneous spends of one balance —');

  const carol = '55555555-5555-5555-5555-555555555555';
  await client.query(`insert into public.profiles (id, display_name) values ($1,'Carol')`, [carol]);
  const cAcct = (await client.query(
    `insert into public.ledger_accounts (kind, owner_user_id) values ('user_available',$1) returning id`,
    [carol])).rows[0].id;
  const cFund = await mkPoll(carol, 10);
  await post({ kind: 'funding', key: `fund:${cFund.corr}`, pollId: cFund.pollId },
    [{ account: acct.cash, amount: USD(10) }, { account: cAcct, amount: -USD(10) }]);

  // Two independent connections both try to spend $6 of Carol's $10.
  const { Client } = require('pg');
  const conn = { host: 'localhost', port: PORT, user: 'postgres', password: 'pw', database: 'ledger' };
  const cA = new Client(conn), cB = new Client(conn);
  await cA.connect(); await cB.connect();

  async function spend(cli, key) {
    await cli.query('begin');
    const t = await cli.query(
      `insert into public.ledger_transactions (kind, idempotency_key) values ('tip',$1) returning id`, [key]);
    await cli.query(
      `insert into public.ledger_postings (transaction_id, account_id, amount_microusd) values ($1,$2,$3)`,
      [t.rows[0].id, cAcct, USD(6)]);
    await cli.query(
      `insert into public.ledger_postings (transaction_id, account_id, amount_microusd) values ($1,$2,$3)`,
      [t.rows[0].id, acct.bobAvail, -USD(6)]);
  }

  await spend(cA, 'race:a');
  // Start B's write without awaiting: it must block on A's balance-row lock
  // rather than racing past it and reading a stale balance.
  const bWrite = spend(cB, 'race:b');
  let bFinishedEarly = false;
  await Promise.race([
    bWrite.then(() => { bFinishedEarly = true; }),
    new Promise((r) => setTimeout(r, 500)),
  ]);
  check('second spender blocks on the first rather than reading a stale balance', !bFinishedEarly);

  await cA.query('commit');
  await bWrite;
  let bCommitted = true;
  try {
    await cB.query('commit');
  } catch (e) {
    bCommitted = false;
    check('losing spender is rejected at COMMIT', /overdraft/.test(e.message), e.message);
  }
  if (bCommitted) check('losing spender is rejected at COMMIT', false, 'BOTH SPENDS COMMITTED — double spend');
  try { await cB.query('rollback'); } catch {}
  await cA.end(); await cB.end();

  check('exactly one of two concurrent $6 spends applied',
    await balance(cAcct) === -USD(4), `carol balance = ${await balance(cAcct)}`);

  // ---- re-verify globals after the mutating sections above ----------------
  console.log('\n— globals re-checked after all writes —');

  const zero2 = await client.query(`select coalesce(sum(balance_microusd),0)::bigint as t from public.ledger_account_balances`);
  check('ledger still sums to zero at end of suite', Number(zero2.rows[0].t) === 0, `got ${zero2.rows[0].t}`);
  const drift2 = await client.query(`select * from public.ledger_verify_balance_cache()`);
  check('no cache drift at end of suite', drift2.rows.length === 0, JSON.stringify(drift2.rows));

  // ---- report -------------------------------------------------------------
  console.log(`\n${'='.repeat(64)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) console.log(`failures:\n  - ${failures.join('\n  - ')}`);
  console.log('='.repeat(64) + '\n');

  await client.end();
  await pg.stop();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
