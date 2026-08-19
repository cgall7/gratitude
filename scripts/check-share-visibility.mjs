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
const CAROL = '33333333-3333-3333-3333-333333333333'; // connected to Alice, not the send's recipient
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

  // 'p' as well as 'r': a partitioned parent is relkind 'p'. Its leaves are
  // 'r' and would be caught anyway (verified — a partitioned table with no RLS
  // fails this check via its leaf), but policies live on the parent, so the
  // parent is the object that should carry the flag.
  const tables = (
    await client.query(`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
      order by 1
    `)
  ).rows;
  const rlsOff = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
  // A completeness assertion that passes over an empty universe asserts
  // nothing. Same guard as the SECURITY DEFINER count below.
  if (tables.length === 0) {
    bad('every table in `public` has RLS enabled', 'enumerated 0 tables — the query is wrong, or the migrations did not build a schema');
  } else if (rlsOff.length === 0) {
    ok(`every table in \`public\` has row level security enabled (${tables.length} checked)`);
  } else {
    bad('every table in `public` has RLS enabled', `RLS is OFF on: ${rlsOff.join(', ')}`);
  }

  // RLS is a property of tables, and a view is not a table. A view runs with
  // the privileges of its OWNER unless it is declared `security_invoker`, so
  // an ordinary view over `entries` hands every row to anyone granted SELECT
  // on the view — the underlying policies are never consulted. Measured, not
  // assumed: an unconnected user reads another user's private journal entry
  // straight through such a view, while the RLS assertion above still passes,
  // because the view is relkind 'v' and was never in its universe.
  //
  // There are no views in `public` today. This is here so that the first one
  // has to declare itself, rather than arriving green — the same reason the
  // SECURITY DEFINER check exists.
  const leakyViews = (
    await client.query(`
      select c.relname, c.relkind,
        coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'unset') as security_invoker
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and (c.relkind = 'm'
             or (c.relkind = 'v'
                 and coalesce((select option_value from pg_options_to_table(c.reloptions)
                               where option_name = 'security_invoker'), 'false') <> 'true'))
      order by 1
    `)
  ).rows;
  if (leakyViews.length === 0) {
    ok('no view in `public` bypasses RLS (every view is `security_invoker`, and there are no materialized views)');
  } else {
    bad(
      'no view in `public` bypasses RLS',
      leakyViews
        .map((v) =>
          v.relkind === 'm'
            ? `${v.relname} is a MATERIALIZED view — it stores its own copy of the rows and has no security_invoker option, so RLS on the source table cannot apply to reads of it at all`
            : `${v.relname} is a view with security_invoker=${v.security_invoker} — it runs as its owner, so the policies on its source tables are never consulted; add \`with (security_invoker = true)\``
        )
        .join('; ')
    );
  }

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
  await client.query('insert into auth.users (id) select * from unnest($1::uuid[])', [[ALICE, BOB, CAROL, MALLORY]]);
  await client.query(
    `insert into public.profiles (id, display_name)
     values ($1,'Alice'),($2,'Bob'),($3,'Carol'),($4,'Mallory') on conflict (id) do nothing`,
    [ALICE, BOB, CAROL, MALLORY]
  );
  await client.query(
    `insert into public.honeycomb_connections (requester_id, addressee_id, status)
     values ($1, $2, 'accepted')`,
    [ALICE, BOB]
  );
  await client.query(
    `insert into public.honeycomb_connections (requester_id, addressee_id, status)
     values ($1, $2, 'accepted')`,
    [ALICE, CAROL]
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

  // --- send_hive (8b.5, 20260819000001_private_hives_send) -------------------
  // The recipient read-access ruling's whole point: flipping visibility to
  // 'sent' has to actually deliver the entry, and only to the hive's
  // subject, and only once send_hive() has run. ALICE/BOB's accepted
  // connection above is reused as owner/subject.
  console.log('\n  send_hive (8b.5 recipient read-access ruling)');

  const insertHive = async (subjectId, subjectName) =>
    (
      await readAs(
        ALICE,
        `insert into public.private_hives (owner_id, subject_name, subject_profile_id)
         values ($1, $2, $3) returning id`,
        [ALICE, subjectName, subjectId]
      )
    )[0].id;
  const sealHive = (id) => readAs(ALICE, 'update public.private_hives set sealed_at = now() where id = $1', [id]);
  const insertEntry = async (hiveId, content, visibility = 'packaged') =>
    (
      await readAs(
        ALICE,
        `insert into public.entries (user_id, hive_id, content, entry_date, visibility)
         values ($1, $2, $3, '2026-08-01', $4) returning id`,
        [ALICE, hiveId, content, visibility]
      )
    )[0].id;

  const hiveId = await insertHive(BOB, 'Bob');
  const packagedEntry = await insertEntry(hiveId, 'grateful for Bob');
  await sealHive(hiveId);

  const bobBeforeHive = await readAs(BOB, 'select id from public.private_hives where id = $1', [hiveId]);
  if (bobBeforeHive.length === 0) ok('the subject cannot read the hive before send_hive');
  else bad('the subject cannot read the hive before send_hive', `LEAK: Bob read ${JSON.stringify(bobBeforeHive)}`);

  const bobBeforeEntry = await readAs(BOB, 'select id from public.entries where id = $1', [packagedEntry]);
  if (bobBeforeEntry.length === 0) ok('the subject cannot read a packaged entry before send_hive');
  else bad('the subject cannot read a packaged entry before send_hive', `LEAK: Bob read ${JSON.stringify(bobBeforeEntry)}`);

  try {
    await readAs(ALICE, 'select public.send_hive($1)', [hiveId]);
    ok('send_hive succeeds for the owner of a sealed hive with a connected subject');
  } catch (e) {
    bad('send_hive succeeds for the owner', e.message.split('\n')[0]);
  }

  const bobReadsHive = await readAs(BOB, 'select sent_at from public.private_hives where id = $1', [hiveId]);
  if (bobReadsHive.length === 1 && bobReadsHive[0].sent_at) ok('the subject reads the hive once sent_at is set');
  else bad('the subject reads the hive once sent', `Bob read ${JSON.stringify(bobReadsHive)}`);

  const bobReadsEntry = await readAs(BOB, 'select content from public.entries where id = $1', [packagedEntry]);
  if (bobReadsEntry.length === 1) ok('the subject reads the sent entry');
  else bad('the subject reads the sent entry', `Bob read ${JSON.stringify(bobReadsEntry)}`);

  const malloryReadsHive = await readAs(MALLORY, 'select id from public.private_hives where id = $1', [hiveId]);
  if (malloryReadsHive.length === 0) ok('an unconnected user cannot read the sent hive');
  else bad('an unconnected user cannot read the sent hive', `LEAK: Mallory read ${JSON.stringify(malloryReadsHive)}`);

  const malloryReadsEntry = await readAs(MALLORY, 'select content from public.entries where id = $1', [packagedEntry]);
  if (malloryReadsEntry.length === 0) ok('an unconnected user cannot read the sent entry');
  else bad('an unconnected user cannot read the sent entry', `LEAK: Mallory read ${JSON.stringify(malloryReadsEntry)}`);

  // send_hive only flips 'packaged' rows — an entry left at the default
  // 'private' in a sent hive is never delivered, curated or not.
  const hiveId2 = await insertHive(BOB, 'Bob again');
  const unpackagedEntry = await insertEntry(hiveId2, 'not curated', 'private');
  await sealHive(hiveId2);
  await readAs(ALICE, 'select public.send_hive($1)', [hiveId2]);
  const bobReadsUnpackaged = await readAs(BOB, 'select content from public.entries where id = $1', [unpackagedEntry]);
  if (bobReadsUnpackaged.length === 0) ok('send_hive never delivers an entry that was never packaged');
  else bad('send_hive never delivers an unpackaged entry', `LEAK: Bob read ${JSON.stringify(bobReadsUnpackaged)}`);

  // Guard rails: unsealed, unconnected-subject, and double-send all refuse,
  // each for the stated reason rather than any error.
  const unsealedHive = await insertHive(BOB, 'Draft');
  try {
    await readAs(ALICE, 'select public.send_hive($1)', [unsealedHive]);
    bad('send_hive refuses an unsealed hive', 'the send succeeded');
  } catch (e) {
    /sealed/.test(e.message)
      ? ok('send_hive refuses an unsealed hive')
      : bad('send_hive refuses an unsealed hive', `wrong reason: ${e.message.split('\n')[0]}`);
  }

  const noConnHive = await insertHive(MALLORY, 'Mallory');
  await sealHive(noConnHive);
  try {
    await readAs(ALICE, 'select public.send_hive($1)', [noConnHive]);
    bad('send_hive refuses a subject who is not a connected friend', 'the send succeeded');
  } catch (e) {
    /connected/.test(e.message)
      ? ok('send_hive refuses a subject who is not a connected friend')
      : bad('send_hive refuses a subject who is not a connected friend', `wrong reason: ${e.message.split('\n')[0]}`);
  }

  try {
    await readAs(ALICE, 'select public.send_hive($1)', [hiveId]);
    bad('send_hive refuses to send an already-sent hive twice', 'the second send succeeded');
  } catch (e) {
    /already been sent/.test(e.message)
      ? ok('send_hive refuses to send an already-sent hive twice')
      : bad('send_hive refuses to send an already-sent hive twice', `wrong reason: ${e.message.split('\n')[0]}`);
  }

  // --- hive_send_events (8b.7, 20260819000002_hive_send_events) --------------
  // send_hive (hiveId, above) already ran for ALICE -> BOB. Its insert into
  // hive_send_events happened in the same transaction — this is the content-
  // free feed event's own round trip, not a re-test of send_hive itself.
  console.log('\n  hive_send_events (8b.7 content-free feed event on send)');

  const sendEvent = (
    await readAs(ALICE, 'select id, sender_id, recipient_id from public.hive_send_events where sender_id = $1 and recipient_id = $2', [ALICE, BOB])
  )[0];
  if (sendEvent) ok('send_hive inserts exactly one hive_send_events row for the owner/subject pair');
  else bad('send_hive inserts a hive_send_events row', 'no row landed for sender=Alice, recipient=Bob');

  const eventCols = sendEvent ? Object.keys(sendEvent) : [];
  const hasContentRef = eventCols.some((c) => /entry|hive_id|content/i.test(c));
  if (!hasContentRef) ok('hive_send_events carries no entry/hive/content reference (content-free by construction)');
  else bad('hive_send_events carries no entry/hive/content reference', `found column(s): ${eventCols.join(', ')}`);

  const bobReadsEvent = await readAs(BOB, 'select id from public.hive_send_events where id = $1', [sendEvent?.id]);
  if (bobReadsEvent.length === 1) ok('the recipient reads their own send event');
  else bad('the recipient reads their own send event', `Bob read ${JSON.stringify(bobReadsEvent)}`);

  const carolReadsEvent = await readAs(CAROL, 'select id from public.hive_send_events where id = $1', [sendEvent?.id]);
  if (carolReadsEvent.length === 1) ok('a connection of the sender (not the recipient) reads the send event — community visibility');
  else bad('a connection of the sender reads the send event', `Carol read ${JSON.stringify(carolReadsEvent)}`);

  const malloryReadsEvent = await readAs(MALLORY, 'select id from public.hive_send_events where id = $1', [sendEvent?.id]);
  if (malloryReadsEvent.length === 0) ok('an unconnected user cannot read the send event');
  else bad('an unconnected user cannot read the send event', `LEAK: Mallory read ${JSON.stringify(malloryReadsEvent)}`);

  try {
    await readAs(ALICE, 'insert into public.hive_send_events (sender_id, recipient_id) values ($1, $2)', [ALICE, BOB]);
    bad('hive_send_events cannot be inserted directly by any authenticated caller', 'the direct insert succeeded — send_hive is not the only writer');
  } catch (e) {
    ok('hive_send_events cannot be inserted directly by any authenticated caller');
  }

  // No UPDATE/ALL policy means RLS's USING clause evaluates false for every
  // row, so the update touches 0 rows rather than raising — a throw is not
  // the right assertion. Target CAROL (a value that would actually show up)
  // and read the row back as ALICE (a party, unconditional select) to prove
  // nothing changed.
  await asUser(BOB, () =>
    client.query('update public.hive_send_events set recipient_id = $1 where id = $2', [CAROL, sendEvent?.id])
  );
  const afterUpdateAttempt = (
    await readAs(ALICE, 'select recipient_id from public.hive_send_events where id = $1', [sendEvent?.id])
  )[0];
  if (afterUpdateAttempt?.recipient_id === BOB) ok('hive_send_events cannot be updated by a participant');
  else bad('hive_send_events cannot be updated by a participant', `recipient_id is now ${afterUpdateAttempt?.recipient_id} — the direct update took effect`);

  // --- entries_update_own mirror guard: shares -> hive_id closes (20260819000001) ---
  // Direction one (hive entry can't acquire a shares row) was already closed
  // by owns_entry(); this is direction two.
  console.log('\n  entries_update_own mirror guard (a shared entry cannot acquire a hive_id)');

  const guardHive = await insertHive(null, 'Guard');

  try {
    await readAs(ALICE, 'update public.entries set hive_id = $1 where id = $2', [guardHive, unshared]);
    ok('an entry with no shares row can still acquire a hive_id (control)');
  } catch (e) {
    bad('an entry with no shares row can still acquire a hive_id (control)', e.message.split('\n')[0]);
  }

  try {
    await readAs(ALICE, 'update public.entries set hive_id = $1 where id = $2', [guardHive, shared]);
    bad('an entry with a shares row cannot acquire a hive_id', 'the reparent succeeded — direction two of the feed/hive coupling is open');
  } catch (e) {
    ok('an entry with a shares row cannot acquire a hive_id');
  }

  try {
    await readAs(ALICE, "update public.entries set content = 'edited, still shared' where id = $1", [shared]);
    ok('editing a shared journal entry (no hive_id change) still succeeds');
  } catch (e) {
    bad('editing a shared journal entry (no hive_id change) still succeeds', e.message.split('\n')[0]);
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
