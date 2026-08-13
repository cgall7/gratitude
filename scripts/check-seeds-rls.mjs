// Gate for the seeds schema (supabase/migrations/20260813000002_seeds_schema.sql).
//
//   npm run check:seeds-rls
//
// Seeds is the one primitive in this app whose entire product promise is a
// security property: before `bloom_at`, the recipient cannot read the text.
// That promise is not kept by the client — it is kept by two RLS policies and
// two triggers, and every one of those is a line of SQL that a later migration
// could quietly undo. A comment cannot fail, so the promise is asserted here.
//
// Three rules this file tries to keep:
//
//   1. RUN THE REAL MIGRATIONS. This reads the actual .sql files off disk and
//      applies them verbatim to a real Postgres. It never re-types the DDL. If
//      a policy is edited, this runs the edited policy.
//   2. ATTACK FROM THE RECIPIENT'S SEAT. Every assertion runs as the
//      `authenticated` role with a JWT claim, which is what PostgREST does —
//      not as the table owner, who bypasses RLS and would pass everything.
//   3. ASSERT ON VALUES, NOT ROW COUNTS, where a query returns a row no matter
//      what RLS did. A correlated subselect over a filtered row yields NULL and
//      an aggregate over zero rows yields `count 0` — both arrive as one row,
//      so "did I get a row back" is the wrong question and an earlier version
//      of this file reported two false failures by asking it.
//
// Requires `embedded-postgres` and `pg` (devDependencies). A missing install
// is a HARD FAILURE, deliberately.
//
// This gate first shipped skipping with exit 0 when the deps were absent, on
// the reasoning that a fresh checkout shouldn't go red for a missing install.
// That was wrong, and it made `npm test` a liar: the one suite proving a
// sealed seed cannot be read early was also the only one able to decline to
// run and still report success. Wired to CI that way, it's a permanently
// green light over an untested seal — and a fresh checkout, which is exactly
// where the deps are missing, is exactly where nobody would notice.
//
// So the default is inverted. Skipping is opt-in and has to be typed:
//
//   SKIP_PG_GATES=1 npm test
//
// for the one person who genuinely cannot run a cluster. That way the skip is
// a decision someone made, not a silence the harness produced on its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const require = createRequire(import.meta.url);

if (process.env.SKIP_PG_GATES === '1') {
  console.log('check-seeds-rls: SKIPPED — SKIP_PG_GATES=1 was set. The seal is UNTESTED in this run.');
  process.exit(0);
}

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require('embedded-postgres').default;
  require('pg');
} catch (e) {
  console.error(
    `check-seeds-rls: FAILED — cannot load embedded-postgres/pg (${e.message.split('\n')[0]}).\n` +
      '  These are devDependencies of this repo; run `npm install`.\n' +
      '  This gate proves a sealed seed cannot be read before it blooms, so it\n' +
      '  fails rather than skipping. To bypass deliberately: SKIP_PG_GATES=1 npm test'
  );
  process.exit(1);
}

// The migrations this gate needs: the core schema seeds depends on (profiles),
// and seeds itself. Listed rather than globbed so a new unrelated migration
// cannot silently change what this gate is testing.
const APPLY = [
  '20260808000001_honeycombs_core_schema.sql',
  '20260810000001_content_length_caps.sql',
  '20260813000001_notes_schema.sql',
  '20260813000002_seeds_schema.sql',
];

const ALICE = '11111111-1111-1111-1111-111111111111'; // sender
const BOB = '22222222-2222-2222-2222-222222222222'; // recipient
const MALLORY = '33333333-3333-3333-3333-333333333333'; // uninvolved third party

// How long the timed seed waits before it comes due. Real time, because the
// seal opens on the server clock and there is nothing to fake: bloom_at is
// immutable after planting (seeds_recipient_open_only), deliberately, so this
// gate cannot cheat by moving the date and neither can an attacker.
const BLOOM_DELAY_SECONDS = 3;

let pass = 0;
const failures = [];
const ok = (name) => {
  pass += 1;
  console.log(`  ok   ${name}`);
};
const bad = (name, detail) => {
  failures.push(`${name} — ${detail}`);
  console.log(`  FAIL ${name}\n         ${detail}`);
};
const firstLine = (e) => e.message.split('\n')[0].slice(0, 72);

// Supabase's own environment, reproduced: the three roles, the auth schema,
// and — critically — the default privileges. Supabase grants new public-schema
// tables and functions to anon/authenticated/service_role BY NAME via ALTER
// DEFAULT PRIVILEGES. That is why neither the notes migration nor the seeds
// one carries a GRANT, and it is also why `REVOKE ... FROM PUBLIC` alone does
// not lock anon out of a function. Setting these before any table is created
// matters: default privileges apply at CREATE time, not retroactively.
const SUPABASE_ENV = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to postgres;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  -- Matches Supabase's auth.uid(): the GUC is nullif'd BEFORE the jsonb cast,
  -- so a signed-out request yields null instead of raising. An earlier shim
  -- raised on the empty GUC, which made the signed-out test pass for the wrong
  -- reason and hid a real anon grant on plant_seed.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid;
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function main() {
  const dataDir = path.join(ROOT, '.seeds-rls-pgdata');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54329,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');
  const client = pg.getPgClient('app');
  await client.connect();

  // Run `fn` as a signed-in Supabase user. Wrapped in a transaction so the
  // `set local` identity unwinds and one assertion cannot leak its seat into
  // the next.
  const asUser = async (uid, fn) => {
    await client.query('begin');
    try {
      await client.query("select set_config('role', 'authenticated', true)");
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      const result = await fn();
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  };

  // "Refused" means an error OR zero rows: RLS denies a SELECT by filtering it
  // away, not by raising, and both are a refusal.
  const denied = async (uid, name, sql, params = []) => {
    try {
      const res = await asUser(uid, () => client.query(sql, params));
      if (res.rowCount === 0) return ok(name);
      return bad(name, `expected refusal, got ${res.rowCount} row(s): ${JSON.stringify(res.rows[0]).slice(0, 160)}`);
    } catch (e) {
      return ok(`${name} [${firstLine(e)}]`);
    }
  };

  const allowed = async (uid, name, sql, params = [], check = null) => {
    try {
      const res = await asUser(uid, () => client.query(sql, params));
      if (res.rowCount === 0) return bad(name, 'expected rows, got 0 — RLS filtered it out');
      const why = check ? check(res.rows[0]) : null;
      return why ? bad(name, why) : ok(name);
    } catch (e) {
      return bad(name, `expected success, raised: ${firstLine(e)}`);
    }
  };

  // For queries that return a row regardless of what RLS did — see rule 3.
  const yields = async (uid, name, sql, params, check) => {
    try {
      const res = await asUser(uid, () => client.query(sql, params));
      if (res.rowCount !== 1) return bad(name, `expected exactly 1 row, got ${res.rowCount}`);
      const why = check(res.rows[0]);
      return why ? bad(name, why) : ok(name);
    } catch (e) {
      return ok(`${name} [${firstLine(e)}]`);
    }
  };

  console.log(`\n${(await client.query('select version()')).rows[0].version.split(',')[0]}\n`);
  await client.query(SUPABASE_ENV);

  for (const file of APPLY) {
    try {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
      console.log(`  applied ${file}`);
    } catch (e) {
      console.error(`\ncheck-seeds-rls: MIGRATION FAILED — ${file}\n  ${e.message}\n`);
      await client.end();
      await pg.stop();
      process.exit(1);
    }
  }

  await client.query('insert into auth.users (id) values ($1), ($2), ($3)', [ALICE, BOB, MALLORY]);
  await client.query(
    `insert into public.profiles (id, display_name)
     values ($1, 'Alice'), ($2, 'Bob'), ($3, 'Mallory')
     on conflict (id) do nothing`,
    [ALICE, BOB, MALLORY]
  );

  // --- Grants --------------------------------------------------------------
  // Checked directly rather than inferred from behaviour. plant_seed also
  // refuses a null auth.uid() internally, so a signed-out call fails either
  // way — which is exactly how a stray anon grant stays invisible.
  console.log('\n  grants');
  const SIG = 'public.plant_seed(uuid,text,timestamptz)';
  for (const [role, want] of [['anon', false], ['authenticated', true]]) {
    const got = (await client.query('select has_function_privilege($1, $2, $3) e', [role, SIG, 'execute'])).rows[0].e;
    if (got === want) ok(`${role} EXECUTE on plant_seed is ${got}`);
    else {
      const acl = (await client.query("select proacl::text a from pg_proc where proname = 'plant_seed'")).rows[0].a;
      bad(`${role} EXECUTE on plant_seed`, `expected ${want}, got ${got} (ACL: ${acl})`);
    }
  }

  // --- Planting ------------------------------------------------------------
  const plant = async (uid, recipient, text, interval) =>
    (await asUser(uid, () => client.query(`select (public.plant_seed($1, $2, now() + $3::interval)).id as id`, [recipient, text, interval]))).rows[0].id;

  const sealedId = await plant(ALICE, BOB, 'The sealed secret.', '30 days');
  const timedId = await plant(ALICE, BOB, 'The opened secret.', `${BLOOM_DELAY_SECONDS} seconds`);

  // --- The seal ------------------------------------------------------------
  console.log('\n  the seal: what a recipient can reach before bloom');
  await allowed(BOB, 'recipient sees the sealed envelope (the teaser survives)', 'select id, bloom_at, sender_id from public.seeds where id = $1', [sealedId], (r) =>
    r.bloom_at ? null : 'bloom_at came back null — nothing to count down to'
  );
  await denied(BOB, 'recipient cannot select the sealed content', 'select content from public.seed_contents where seed_id = $1', [sealedId]);
  await denied(BOB, 'recipient cannot reach content through a join', 'select c.content from public.seeds s join public.seed_contents c on c.seed_id = s.id where s.id = $1', [sealedId]);
  await yields(BOB, 'recipient cannot reach content through a correlated subquery', 'select (select content from public.seed_contents c where c.seed_id = s.id) as content from public.seeds s where s.id = $1', [sealedId], (r) =>
    r.content === null ? null : `subquery returned the text: ${r.content}`
  );
  await yields(BOB, 'recipient cannot leak content length via aggregate', 'select count(*)::int as n, max(char_length(content)) as len from public.seed_contents where seed_id = $1', [sealedId], (r) =>
    r.n === 0 && r.len === null ? null : `aggregate leaked n=${r.n} len=${r.len}`
  );
  await denied(BOB, 'recipient cannot confirm a guess at the text', "select seed_id from public.seed_contents where seed_id = $1 and content like '%sealed%'", [sealedId]);

  // --- Prying --------------------------------------------------------------
  console.log('\n  prying the seal open');
  await denied(BOB, 'recipient cannot pull bloom_at forward to unlock it', "update public.seeds set bloom_at = now() - interval '1 day' where id = $1 returning id", [sealedId]);
  await denied(BOB, 'recipient cannot mark a sealed seed opened', 'update public.seeds set opened_at = now() where id = $1 returning id', [sealedId]);
  await denied(BOB, 'recipient cannot rewrite the content', "update public.seed_contents set content = 'x' where seed_id = $1 returning seed_id", [sealedId]);
  await denied(BOB, 'recipient cannot delete the content row to replace it', 'delete from public.seed_contents where seed_id = $1 returning seed_id', [sealedId]);
  await denied(BOB, 'recipient cannot reassign the seed to himself as sender', 'update public.seeds set sender_id = $2 where id = $1 returning id', [sealedId, BOB]);
  await denied(BOB, 'recipient cannot delete a seed addressed to him', 'delete from public.seeds where id = $1 returning id', [sealedId]);

  // --- The sender ----------------------------------------------------------
  console.log('\n  the sender');
  await allowed(ALICE, 'sender can read what she wrote, sealed or not', 'select content from public.seed_contents where seed_id = $1', [sealedId], (r) =>
    r.content === 'The sealed secret.' ? null : `wrong content: ${r.content}`
  );
  await denied(ALICE, 'sender cannot rewrite a planted seed (no take-backs)', "update public.seed_contents set content = 'rewritten' where seed_id = $1 returning seed_id", [sealedId]);
  await denied(ALICE, 'sender cannot move the bloom date after planting', "update public.seeds set bloom_at = now() + interval '99 days' where id = $1 returning id", [sealedId]);

  // --- The bystander -------------------------------------------------------
  console.log('\n  the bystander');
  await denied(MALLORY, 'bystander cannot see the envelope', 'select id from public.seeds where id = $1', [sealedId]);
  await denied(MALLORY, 'bystander cannot see the content', 'select content from public.seed_contents where seed_id = $1', [sealedId]);
  await denied(MALLORY, 'bystander cannot enumerate seeds at all', 'select count(*) c from public.seeds having count(*) > 0');

  // --- The only door in ----------------------------------------------------
  console.log('\n  the only door in');
  await denied(BOB, 'direct INSERT into seeds is closed', "insert into public.seeds (sender_id, recipient_id, bloom_at) values ($1, $2, now() + interval '1 day') returning id", [BOB, ALICE]);
  await denied(BOB, 'direct INSERT into seed_contents is closed', "insert into public.seed_contents (seed_id, content) values ($1, 'forged') returning seed_id", [sealedId]);
  await denied(ALICE, 'plant_seed refuses a seed to yourself', "select public.plant_seed($1, 'me', now() + interval '1 day')", [ALICE]);
  await denied(ALICE, 'plant_seed refuses an empty seed', "select public.plant_seed($1, '   ', now() + interval '1 day')", [BOB]);
  await denied(ALICE, 'plant_seed refuses a bloom date in the past', "select public.plant_seed($1, 'past', now() - interval '1 day')", [BOB]);
  await denied(ALICE, 'plant_seed refuses over-length content', `select public.plant_seed($1, repeat('x', 501), now() + interval '1 day')`, [BOB]);

  // anon is the role an unauthenticated PostgREST request runs as.
  await client.query('begin');
  try {
    await client.query("select set_config('role', 'anon', true)");
    await client.query("select set_config('request.jwt.claims', '', true)");
    await client.query(`select public.plant_seed($1, 'anon', now() + interval '1 day')`, [BOB]);
    await client.query('rollback');
    bad('signed-out caller cannot plant a seed', 'anon executed plant_seed');
  } catch (e) {
    await client.query('rollback');
    ok(`signed-out caller cannot plant a seed [${firstLine(e)}]`);
  }

  // --- Bloom, on the clock -------------------------------------------------
  console.log(`\n  bloom (waiting ${BLOOM_DELAY_SECONDS + 1}s for the timed seed to come due)`);
  await new Promise((r) => setTimeout(r, (BLOOM_DELAY_SECONDS + 1) * 1000));

  await allowed(BOB, 'recipient can read the seed once its date passes — no write, no job', 'select content from public.seed_contents where seed_id = $1', [timedId], (r) =>
    r.content === 'The opened secret.' ? null : `wrong content: ${r.content}`
  );
  await allowed(BOB, 'recipient can mark a bloomed seed opened', 'update public.seeds set opened_at = now() where id = $1 returning id', [timedId]);
  await denied(ALICE, 'sender cannot un-plant a seed that already bloomed', 'delete from public.seeds where id = $1 returning id', [timedId]);
  await allowed(BOB, 'the 30-day seed is still sealed after the other bloomed', 'select id from public.seeds where id = $1', [sealedId]);
  await denied(BOB, '  ...and its content is still unreadable', 'select content from public.seed_contents where seed_id = $1', [sealedId]);

  // --- Un-planting ---------------------------------------------------------
  console.log('\n  un-planting');
  const doomedId = await plant(ALICE, BOB, 'regret', '10 days');
  await allowed(ALICE, 'sender can un-plant a still-sealed seed', 'delete from public.seeds where id = $1 returning id', [doomedId]);
  const orphans = (await client.query('select count(*)::int c from public.seed_contents where seed_id = $1', [doomedId])).rows[0].c;
  if (orphans === 0) ok('un-planting takes the contents with it (no orphan text left behind)');
  else bad('un-planting takes the contents with it', `${orphans} content row(s) survived the delete`);

  await client.end();
  await pg.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log(`\ncheck-seeds-rls: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\ncheck-seeds-rls: harness error —', e);
  process.exit(1);
});
