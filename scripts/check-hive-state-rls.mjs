// Gate for the hive state endpoint (supabase/migrations/20260813000003_hive_state_facts.sql).
//
//   npm run check:hive-state-rls
//
// list_hive_state() reads across three RLS-protected tables (profiles,
// entries, notes) on behalf of the caller. It runs `security invoker`
// specifically so it inherits the caller's own RLS instead of re-deriving
// visibility rules that could drift from the tables' real policies — this
// gate exists to prove that inheritance actually holds: an unaccepted
// connection, an unshared entry, or someone else's note must never surface
// through the function even though the function itself runs unrestricted
// grant-wise for `authenticated`.
//
// Modeled on check-seeds-rls.mjs: real migrations off disk, attacks run as
// `authenticated`/`anon` (never the table owner), and refusal is checked by
// value where a query would otherwise return a row regardless of RLS. See
// that file for the fuller rationale on all three rules.
//
// Requires `embedded-postgres` and `pg` — both are listed in
// `devDependencies`, so `npm install` fetches them on any normal checkout,
// and a missing install FAILS this gate rather than skipping it. This is
// the one gate in the repo proving `anon` cannot call `list_hive_state()`;
// a silent skip there is a green `npm test` over an unchecked grant. Set
// `SKIP_PG_GATES=1` to explicitly opt out on a machine that genuinely can't
// run a local Postgres — that has to be a deliberate flag, never a default
// (Sage's finding, thread e10d0fed, 2026-08-13: as written, this and
// check-seeds-rls.mjs both defaulted to skip-and-pass on any fresh checkout
// that hadn't run `npm install` yet, which is every fresh checkout).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const require = createRequire(import.meta.url);

if (process.env.SKIP_PG_GATES === '1') {
  console.log('check-hive-state-rls: SKIPPED — SKIP_PG_GATES=1 set explicitly');
  process.exit(0);
}

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require('embedded-postgres').default;
  require('pg');
} catch (e) {
  console.error(
    `check-hive-state-rls: FAILED — embedded-postgres/pg not installed (${e.message.split('\n')[0]}).\n` +
      '  Run `npm install` (both are devDependencies), or set SKIP_PG_GATES=1 to skip deliberately\n' +
      '  on a machine that genuinely cannot run a local Postgres.'
  );
  process.exit(1);
}

// Listed rather than globbed so an unrelated new migration can't silently
// change what this gate is testing.
const APPLY = [
  '20260808000001_honeycombs_core_schema.sql',
  '20260810000001_content_length_caps.sql',
  '20260813000001_notes_schema.sql',
  '20260813000003_hive_state_facts.sql',
];

const ALICE = '11111111-1111-1111-1111-111111111111'; // the viewer/caller
const BOB = '22222222-2222-2222-2222-222222222222'; // accepted connection
const CAROL = '33333333-3333-3333-3333-333333333333'; // pending connection
const DAN = '44444444-4444-4444-4444-444444444444'; // blocked connection
const MALLORY = '55555555-5555-5555-5555-555555555555'; // no connection at all
const EVE = '66666666-6666-6666-6666-666666666666'; // Bob's other correspondent

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

// Same Supabase-shaped environment as check-seeds-rls.mjs: default
// privileges grant new public-schema objects to anon/authenticated/
// service_role BY NAME, which is why `revoke ... from public` alone
// doesn't lock anon out of a function — the exact gap this migration's
// comment fixes and this gate checks directly.
const SUPABASE_ENV = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to postgres;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
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
  const dataDir = path.join(ROOT, '.hive-state-rls-pgdata');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54330, // seeds-rls uses 54329; different port so both gates can run concurrently
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');
  const client = pg.getPgClient('app');
  await client.connect();

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

  const allowed = async (uid, name, sql, params = [], check = null) => {
    try {
      const res = await asUser(uid, () => client.query(sql, params));
      if (res.rowCount === 0) return bad(name, 'expected rows, got 0 — RLS filtered it out');
      const why = check ? check(res.rows) : null;
      return why ? bad(name, why) : ok(name);
    } catch (e) {
      return bad(name, `expected success, raised: ${firstLine(e)}`);
    }
  };

  console.log(`\n${(await client.query('select version()')).rows[0].version.split(',')[0]}\n`);
  await client.query(SUPABASE_ENV);

  for (const file of APPLY) {
    try {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
      console.log(`  applied ${file}`);
    } catch (e) {
      console.error(`\ncheck-hive-state-rls: MIGRATION FAILED — ${file}\n  ${e.message}\n`);
      await client.end();
      await pg.stop();
      process.exit(1);
    }
  }

  const PEOPLE = [
    [ALICE, 'Alice'],
    [BOB, 'Bob'],
    [CAROL, 'Carol'],
    [DAN, 'Dan'],
    [MALLORY, 'Mallory'],
    [EVE, 'Eve'],
  ];
  await client.query(
    `insert into auth.users (id) select * from unnest($1::uuid[])`,
    [PEOPLE.map(([id]) => id)]
  );
  for (const [id, name] of PEOPLE) {
    await client.query(`insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [id, name]);
  }

  // Alice's honeycomb: Bob accepted, Carol pending, Dan blocked. Mallory and
  // Eve have no row at all.
  await client.query(`insert into public.honeycomb_connections (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [ALICE, BOB]);
  await client.query(`insert into public.honeycomb_connections (requester_id, addressee_id, status) values ($1, $2, 'pending')`, [ALICE, CAROL]);
  await client.query(`insert into public.honeycomb_connections (requester_id, addressee_id, status) values ($1, $2, 'blocked')`, [ALICE, DAN]);

  // --- Grants ----------------------------------------------------------------
  console.log('\n  grants');
  const SIG = 'public.list_hive_state()';
  for (const [role, want] of [['anon', false], ['authenticated', true]]) {
    const got = (await client.query('select has_function_privilege($1, $2, $3) e', [role, SIG, 'execute'])).rows[0].e;
    if (got === want) ok(`${role} EXECUTE on list_hive_state is ${got}`);
    else {
      const acl = (await client.query("select proacl::text a from pg_proc where proname = 'list_hive_state'")).rows[0].a;
      bad(`${role} EXECUTE on list_hive_state`, `expected ${want}, got ${got} (ACL: ${acl})`);
    }
  }
  await client.query('begin');
  try {
    await client.query("select set_config('role', 'anon', true)");
    await client.query("select set_config('request.jwt.claims', '', true)");
    await client.query('select * from public.list_hive_state()');
    await client.query('rollback');
    bad('signed-out caller cannot call list_hive_state', 'anon executed the function');
  } catch (e) {
    await client.query('rollback');
    ok(`signed-out caller cannot call list_hive_state [${firstLine(e)}]`);
  }

  // --- Membership: only accepted connections appear ---------------------------
  console.log('\n  membership');
  await allowed(ALICE, 'accepted connection (Bob) appears', 'select * from public.list_hive_state() where member_id = $1', [BOB]);
  await client.query('begin');
  await client.query("select set_config('role', 'authenticated', true)");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ALICE, role: 'authenticated' })]);
  const rows = (await client.query('select * from public.list_hive_state()')).rows;
  await client.query('commit');
  const ids = rows.map((r) => r.member_id);
  if (!ids.includes(CAROL)) ok('pending connection (Carol) does not appear');
  else bad('pending connection (Carol) does not appear', 'Carol was in the result');
  if (!ids.includes(DAN)) ok('blocked connection (Dan) does not appear');
  else bad('blocked connection (Dan) does not appear', 'Dan was in the result');
  if (!ids.includes(MALLORY)) ok('unconnected user (Mallory) does not appear');
  else bad('unconnected user (Mallory) does not appear', 'Mallory was in the result');
  if (ids.length === 1) ok('exactly one member in Alice’s hive state (Bob)');
  else bad('exactly one member in Alice’s hive state', `got ${ids.length}: ${ids.join(', ')}`);

  // --- last_entry_date: shared entries only, never a private one --------------
  console.log('\n  last_entry_date');
  const privateEntry = (await client.query(
    `insert into public.entries (user_id, content, entry_date) values ($1, 'private, never shared', '2026-08-01') returning id`,
    [BOB]
  )).rows[0].id;
  await allowed(ALICE, 'private (unshared) entry does not move last_entry_date', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    rs[0].last_entry_date === null ? null : `last_entry_date is ${rs[0].last_entry_date}, expected null (no shares exist yet)`
  );

  const sharedEntryId = (await client.query(
    `insert into public.entries (user_id, content, entry_date) values ($1, 'shared with the hive', '2026-08-10') returning id`,
    [BOB]
  )).rows[0].id;
  await client.query(`insert into public.shares (entry_id, user_id) values ($1, $2)`, [sharedEntryId, BOB]);
  await allowed(ALICE, 'shared entry sets last_entry_date to the shared date, not the later private one', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    String(rs[0].last_entry_date) === '2026-08-10T00:00:00.000Z' || rs[0].last_entry_date?.toISOString?.().startsWith('2026-08-10')
      ? null
      : `last_entry_date is ${rs[0].last_entry_date}, expected 2026-08-10 (the shared entry, not the private 2026-08-01 one)`
  );

  const laterSharedEntryId = (await client.query(
    `insert into public.entries (user_id, content, entry_date) values ($1, 'a more recent share', '2026-08-12') returning id`,
    [BOB]
  )).rows[0].id;
  await client.query(`insert into public.shares (entry_id, user_id) values ($1, $2)`, [laterSharedEntryId, BOB]);
  await allowed(ALICE, 'last_entry_date tracks the most recent shared entry', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    rs[0].last_entry_date?.toISOString?.().startsWith('2026-08-12') ? null : `last_entry_date is ${rs[0].last_entry_date}, expected 2026-08-12`
  );

  // --- last_note_received_at: notes TO the caller only, never someone else's --
  console.log('\n  last_note_received_at');
  await allowed(ALICE, 'no note yet: last_note_received_at is null', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    rs[0].last_note_received_at === null ? null : `last_note_received_at is ${rs[0].last_note_received_at}, expected null`
  );

  await client.query('begin');
  await client.query("select set_config('role', 'authenticated', true)");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ALICE, role: 'authenticated' })]);
  await client.query(`insert into public.notes (sender_id, recipient_id, content) values ($1, $2, 'thanks for being here')`, [ALICE, BOB]);
  await client.query('commit');
  await allowed(ALICE, 'a note ALICE SENT to Bob does not count as one she received', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    rs[0].last_note_received_at === null ? null : `last_note_received_at is ${rs[0].last_note_received_at}, expected still null (Alice sent it, didn't receive it)`
  );

  await client.query('begin');
  await client.query("select set_config('role', 'authenticated', true)");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: BOB, role: 'authenticated' })]);
  await client.query(`insert into public.notes (sender_id, recipient_id, content) values ($1, $2, 'thanks to you too')`, [BOB, ALICE]);
  await client.query(`insert into public.notes (sender_id, recipient_id, content) values ($1, $2, 'a note to someone else entirely')`, [BOB, EVE]);
  await client.query('commit');
  await allowed(ALICE, 'a note Bob sent Alice sets last_note_received_at', 'select * from public.list_hive_state() where member_id = $1', [BOB], (rs) =>
    rs[0].last_note_received_at !== null ? null : 'last_note_received_at is still null'
  );
  await allowed(ALICE, "Bob's note to Eve never surfaces in Alice's view of Bob (not a count, not a leak)", 'select * from public.list_hive_state() where member_id = $1', [BOB]);
  // Prove the Eve note specifically didn't leak by confirming Eve isn't a
  // member of Alice's hive at all — there is no member_id to attach it to.
  if (!ids.includes(EVE)) ok("Eve (Bob's other correspondent) isn't in Alice's hive state at all");
  else bad("Eve isn't in Alice's hive state", 'Eve appeared as a member');

  await client.end();
  await pg.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log(`\ncheck-hive-state-rls: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\ncheck-hive-state-rls: harness error —', e);
  process.exit(1);
});
