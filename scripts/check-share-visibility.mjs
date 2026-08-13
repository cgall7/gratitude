// The whole-schema gate: does a share still reach the hive it was published to?
//
//   npm run check:share-visibility
//
// Every other check-*.mjs gate in this repo verifies one migration. This one
// verifies the SCHEMA — the state you get after applying everything in
// supabase/migrations, in the order Supabase applies it — against the two
// things the app's own share path has to keep being true:
//
//   1. an accepted connection can read what you shared
//   2. nobody else can
//
// Privacy suites get written almost entirely out of rule 2, which is how a
// change that over-blocks ships green (Sage, thread 19e90cf8, 2026-08-13).
// Rule 1 is the assertion that catches it, and it is the reason this file
// exists.
//
// WHY THIS GATE GLOBS WHERE THE OTHERS LIST
//
// check-hive-state-rls.mjs and check-seeds-rls.mjs name their migrations
// explicitly, so an unrelated new migration can't silently change what they
// test. That is right for a gate scoped to one feature. It is exactly wrong
// here: a new migration IS the thing that can break a share round-trip, and
// a listed set would keep passing while the file that broke it sat one
// directory over, unapplied. So this globs *.sql in filename order and
// tests whatever is actually on disk.
//
// The concrete case that motivated it: a `visibility` column plus an
// `as restrictive` SELECT policy on `entries` (P0-2). Both are correct in
// isolation — Postgres ORs permissive policies, so a `visibility` check
// written permissively can only widen access and enforces nothing; the
// keyword is required. But `shareEntry` never writes the column, so every
// share made after that deploy lands 'private' and is invisible to the
// honeycomb it was published to. No error is raised anywhere: the insert
// succeeds, the author's UI says shared, and the hive sees nothing. The
// rule the two halves add up to — a column that gates reads gets its writer
// in the same migration that creates it — is not checkable from a schema
// diff. It is checkable by sharing an entry and reading it back, which is
// all this file does.
//
// Requires `embedded-postgres` and `pg` — both are devDependencies, so
// `npm install` fetches them on any normal checkout, and a missing install
// FAILS this gate rather than skipping it. Set SKIP_PG_GATES=1 to opt out
// deliberately on a machine that genuinely cannot run a local Postgres;
// that has to be a flag, never a default.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const require = createRequire(import.meta.url);

if (process.env.SKIP_PG_GATES === '1') {
  console.log('check-share-visibility: SKIPPED — SKIP_PG_GATES=1 set explicitly');
  process.exit(0);
}

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require('embedded-postgres').default;
  require('pg');
} catch (e) {
  console.error(
    `check-share-visibility: FAILED — embedded-postgres/pg not installed (${e.message.split('\n')[0]}).\n` +
      '  Run `npm install` (both are devDependencies), or set SKIP_PG_GATES=1 to skip deliberately\n' +
      '  on a machine that genuinely cannot run a local Postgres.'
  );
  process.exit(1);
}

const ALICE = '11111111-1111-1111-1111-111111111111'; // the author
const BOB = '22222222-2222-2222-2222-222222222222'; // accepted connection
const MALLORY = '44444444-4444-4444-4444-444444444444'; // no connection at all

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

// Same Supabase-shaped environment as the other PG gates, plus a `storage`
// shim: 20260809000001_avatar_storage.sql references storage.objects and
// storage.foldername(), which don't exist outside Supabase. The listed
// gates never hit it because they never apply that file; a glob does.
const SUPABASE_ENV = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to postgres;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid;
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(n text) returns text[] language sql immutable as $$
    select string_to_array(n, '/');
  $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function main() {
  const dataDir = path.join(ROOT, '.share-visibility-pgdata');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54331, // seeds-rls 54329, hive-state 54330; distinct so gates can run concurrently
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
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: 'authenticated' }),
      ]);
      const result = await fn();
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  };
  const readAs = (uid, sql, params = []) =>
    asUser(uid, () => client.query(sql, params)).then((r) => r.rows);

  console.log(`\n${(await client.query('select version()')).rows[0].version.split(',')[0]}\n`);
  await client.query(SUPABASE_ENV);

  // --- The whole schema, off disk, in the order Supabase applies it ----------
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.error('check-share-visibility: FAILED — no migrations found in supabase/migrations');
    process.exit(1);
  }
  for (const file of files) {
    try {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    } catch (e) {
      console.error(`\ncheck-share-visibility: MIGRATION FAILED — ${file}\n  ${e.message}\n`);
      await client.end();
      await pg.stop();
      process.exit(1);
    }
  }
  console.log(`  applied ${files.length} migrations, ${files[0]} … ${files[files.length - 1]}`);

  // --- Structural invariants, read off the catalog ---------------------------
  // These hold for whatever tables and functions exist, so a new migration
  // is covered the day it lands rather than the day someone writes its gate.
  console.log('\n  schema-wide');

  const rlsOff = (
    await client.query(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      order by 1
    `)
  ).rows.map((r) => r.relname);
  if (rlsOff.length === 0) ok('every table in `public` has row level security enabled');
  else bad('every table in `public` has RLS enabled', `RLS is OFF on: ${rlsOff.join(', ')}`);

  // `revoke ... from public` does not reach anon: anon holds its own grant
  // from ALTER DEFAULT PRIVILEGES, so it has to be revoked by name. Asserted
  // against has_function_privilege rather than inferred from a call, because
  // a function that errors for an unrelated reason looks identical to one
  // that refused.
  const definers = (
    await client.query(`
      select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
      order by 1
    `)
  ).rows.map((r) => r.sig);
  const anonCanRun = [];
  for (const sig of definers) {
    const { rows } = await client.query('select has_function_privilege($1, $2, $3) as e', [
      'anon',
      sig,
      'execute',
    ]);
    if (rows[0].e) anonCanRun.push(sig);
  }
  if (definers.length === 0) {
    bad(
      '`anon` cannot execute any SECURITY DEFINER function',
      'found no SECURITY DEFINER functions at all — the query is wrong, or the schema changed shape'
    );
  } else if (anonCanRun.length === 0) {
    ok(`\`anon\` cannot execute any of the ${definers.length} SECURITY DEFINER functions in \`public\``);
  } else {
    bad('`anon` cannot execute any SECURITY DEFINER function', `signed-out callers can run: ${anonCanRun.join(', ')}`);
  }

  // --- Fixtures --------------------------------------------------------------
  await client.query('insert into auth.users (id) select * from unnest($1::uuid[])', [[ALICE, BOB, MALLORY]]);
  await client.query(
    `insert into public.profiles (id, display_name)
     values ($1,'Alice'),($2,'Bob'),($3,'Mallory') on conflict (id) do nothing`,
    [ALICE, BOB, MALLORY]
  );
  await client.query(
    `insert into public.honeycomb_connections (requester_id, addressee_id, status)
     values ($1, $2, 'accepted')`,
    [ALICE, BOB]
  );

  // --- The share round-trip --------------------------------------------------
  // Exactly HoneycombStore.shareEntry: insert an entry with
  // {user_id, content, entry_date}, then insert a shares row. Columns the
  // client does not send are deliberately not sent here either — the whole
  // class of bug this gate is for is a column the schema requires and the
  // client doesn't know about.
  console.log('\n  share round-trip (HoneycombStore.shareEntry)');

  const shared = (
    await readAs(
      ALICE,
      `insert into public.entries (user_id, content, entry_date)
       values ($1, 'grateful for Mateo', '2026-08-13') returning id`,
      [ALICE]
    )
  )[0].id;
  let shareInsertFailed = null;
  try {
    await readAs(ALICE, 'insert into public.shares (entry_id, user_id) values ($1, $2)', [shared, ALICE]);
    ok('shareEntry’s two inserts both succeed as the signed-in author');
  } catch (e) {
    shareInsertFailed = e.message.split('\n')[0];
    bad('shareEntry’s two inserts both succeed', `the shares insert raised: ${shareInsertFailed}`);
  }

  // An entry the author never shared, as the control for both directions.
  const unshared = (
    await readAs(
      ALICE,
      `insert into public.entries (user_id, content, entry_date)
       values ($1, 'just for me', '2026-08-12') returning id`,
      [ALICE]
    )
  )[0].id;

  // RULE 1 — the assertion that catches over-blocking. If a migration adds a
  // condition the client doesn't satisfy, this is the only test in the repo
  // that goes red.
  const bobReads = await readAs(BOB, 'select content from public.entries where id = $1', [shared]);
  if (bobReads.length === 1) {
    ok('an accepted connection READS the shared entry');
  } else {
    bad(
      'an accepted connection READS the shared entry',
      'the share was written with no error and the hive cannot see it. Something in the schema now ' +
        'requires state that HoneycombStore.shareEntry does not write — check for a column added with ' +
        'a default that the client never sets, or a policy added `as restrictive` over one.'
    );
  }

  // RULE 2 — the boundary itself.
  const malloryReads = await readAs(MALLORY, 'select content from public.entries where id = $1', [shared]);
  if (malloryReads.length === 0) ok('an unconnected user cannot read the shared entry');
  else bad('an unconnected user cannot read the shared entry', `LEAK: Mallory read ${JSON.stringify(malloryReads)}`);

  const bobReadsUnshared = await readAs(BOB, 'select content from public.entries where id = $1', [unshared]);
  if (bobReadsUnshared.length === 0) ok('an accepted connection cannot read an entry that was never shared');
  else bad('an accepted connection cannot read an unshared entry', `LEAK: Bob read ${JSON.stringify(bobReadsUnshared)}`);

  const aliceReadsOwn = await readAs(ALICE, 'select content from public.entries where id = $1', [unshared]);
  if (aliceReadsOwn.length === 1) ok('the author still reads her own unshared entry (no over-block)');
  else bad('the author reads her own unshared entry', 'the author is locked out of her own journal');

  // --- The two feed shapes must agree ----------------------------------------
  // listFeed selects `entries(...)` — a to-one embed, LEFT JOIN — so an entry
  // filtered by RLS comes back as a null embed and toFeedShare renders a card
  // with an author and no words. listFeedSince selects `entries!inner(...)`,
  // so the same row is pruned and the share vanishes. Both are silent. The
  // defect is not either shape; it is that they disagree, so that is the
  // assertion.
  console.log('\n  feed shapes (listFeed vs listFeedSince)');

  const leftJoin = await readAs(
    BOB,
    `select s.id, e.content
     from public.shares s
     left join public.entries e on e.id = s.entry_id
     order by s.created_at desc`
  );
  const innerJoin = await readAs(
    BOB,
    `select s.id, e.content
     from public.shares s
     join public.entries e on e.id = s.entry_id
     order by s.created_at desc`
  );

  const nulled = leftJoin.filter((r) => r.content === null);
  if (nulled.length === 0) ok('listFeed’s embed is never null — no authored card arrives without its words');
  else
    bad(
      'listFeed’s embed is never null',
      `${nulled.length} share row(s) survive with a null entries embed. toFeedShare uses optional chaining, ` +
        'so this renders as a FeedCard with a name, an avatar and no gratitude in it — no crash, no warning.'
    );

  if (leftJoin.length === innerJoin.length) {
    ok(`listFeed and listFeedSince agree: ${innerJoin.length} share(s) visible to the hive`);
  } else {
    bad(
      'listFeed and listFeedSince agree on what exists',
      `Today view returns ${leftJoin.length} share(s), week view returns ${innerJoin.length}. The same share is ` +
        'visible on one screen and absent on the other, one toggle apart, with no error on either path.'
    );
  }

  await client.end();
  await pg.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log(`\ncheck-share-visibility: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\ncheck-share-visibility: harness error —', e);
  process.exit(1);
});
