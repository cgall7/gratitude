// Pre-flight for `npm run deploy:migrations`.
//
// WHAT WAS NOT COVERED, AND WHY IT MATTERS TODAY
//
// Two gates already run real migrations: check-seeds-rls and check-hive-state-rls.
// Both apply a HAND-PICKED SUBSET (`APPLY = [...]`, four files of eleven) — the
// ones the behaviour under test depends on. That is correct for what they assert
// and it leaves the deploy uncovered: `supabase db push` applies EVERY file in
// supabase/migrations/, in filename order, against one database. No test anywhere
// executes that sequence.
//
// So "the migrations are one command away" has been true and unverified at the
// same time. This gate executes the whole ordered sequence on a clean cluster and
// then asserts that the objects the app 404s on today actually exist afterwards —
// i.e. that the one command fixes the thing it is claimed to fix.
//
// It does NOT test the remote's migration-history table, which is the other half
// of the deploy risk (see supabase/README.md and the header of
// scripts/deploy-migrations.sh). That failure is about what prod has recorded,
// not about what these files do, and it cannot be reproduced locally.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const require = createRequire(import.meta.url);

if (process.env.SKIP_PG_GATES === '1') {
  console.log('check-migrations-apply: SKIPPED — SKIP_PG_GATES=1. The deploy is UNVERIFIED in this run.');
  process.exit(0);
}

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require('embedded-postgres').default;
  require('pg');
} catch (e) {
  console.error(
    `check-migrations-apply: FAILED — cannot load embedded-postgres/pg (${e.message.split('\n')[0]}).\n` +
      '  These are devDependencies of this repo; run `npm install`.\n' +
      '  This gate proves the prod deploy will apply, so it fails rather than skipping.\n' +
      '  To bypass deliberately: SKIP_PG_GATES=1 npm test'
  );
  process.exit(1);
}

// What Supabase provides before any migration runs. Same shim as the RLS gates,
// plus the `storage` schema — 20260809000001_avatar_storage.sql is the only
// migration that touches it, and without the shim this gate would fail on a file
// that is already applied and healthy in prod.
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
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid
  );
  alter table storage.objects enable row level security;
  -- Supabase ships this helper; the avatar policy calls it. Scoped honestly:
  -- this stands in for the NAME AND SIGNATURE, not the behaviour. This gate
  -- asserts that the migrations APPLY, and a policy predicate only has to
  -- resolve and typecheck to do that — no assertion here depends on what
  -- foldername returns. Do not grow a behavioural test on top of this shim
  -- without checking it against the real implementation first.
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
  $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

// What the app must find after a deploy — READ OUT OF THE CLIENT, not typed here.
//
// The first version of this file hand-listed these, and I seeded that list from a
// prod-probe table in chat rather than from the repo. It contained `list_my_seeds`,
// which this gate then reported missing — correctly, because it does not exist in
// any migration, in `src/`, or on any of the 109 remote refs. Nothing calls it and
// nothing ever did. The gate caught its own author copying a name, which is the
// argument for deriving the list instead of maintaining one:
//
//   a hand-kept expectation list inherits every typo it is seeded from, and goes
//   stale in the direction of whatever someone last remembered.
//
// So: every `.rpc('x')` and `.from('x')` in src/ must resolve after a full apply.
const clientSource = () => {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src'));
  return out.join('\n');
};

const SRC = clientSource();
const scrape = (re) => [...new Set([...SRC.matchAll(re)].map((m) => m[1]))].sort();

const EXPECTED_FUNCTIONS = scrape(/\.rpc\('([a-z_]+)'/g);
// PostgREST embeds (`profiles!fk(...)`, `seed_contents(content)`) name a relation
// without ever going through `.from()`, so a scrape misses them. These two are
// listed by hand BECAUSE the mechanical sweep cannot see them — not because the
// sweep was incomplete. Scoped: found by reading the select strings in
// src/services/, not by a grep that would catch a future third one.
const EMBED_ONLY_TABLES = ['profiles', 'seed_contents'];
const EXPECTED_TABLES = [...new Set([...scrape(/\.from\('([a-z_]+)'/g), ...EMBED_ONLY_TABLES])].sort();

let failures = 0;
const ok = (name) => console.log(`  ok   ${name}`);
const bad = (name, why) => {
  failures += 1;
  console.log(`  FAIL ${name}\n       ${why}`);
};

const main = async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(ROOT, '.migrations-apply-pgdata'),
    user: 'postgres',
    password: 'postgres',
    port: 55433,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');
  const client = pg.getPgClient('app');
  await client.connect();

  console.log(`\n${(await client.query('select version()')).rows[0].version.split(',')[0]}\n`);
  await client.query(SUPABASE_ENV);

  // Exactly what `db push` does: every .sql file, filename order, one database.
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    bad('migration set is non-empty', 'no .sql files found in supabase/migrations/');
  }

  console.log(`  applying ${files.length} migrations in filename order\n`);
  for (const file of files) {
    try {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
      ok(`applies: ${file}`);
    } catch (e) {
      bad(`applies: ${file}`, e.message.split('\n')[0]);
      // Stop here — db push stops here too, so every later result would be a
      // fiction about a database that never got built.
      console.log('\n  (stopped: db push halts on the first failure, so the rest is unknown)');
      break;
    }
  }

  if (failures === 0) {
    console.log('');
    for (const t of EXPECTED_TABLES) {
      const { rows } = await client.query(
        "select 1 from pg_tables where schemaname = 'public' and tablename = $1", [t]);
      rows.length ? ok(`table exists: public.${t}`) : bad(`table exists: public.${t}`, 'missing after full apply');
    }
    for (const f of EXPECTED_FUNCTIONS) {
      const { rows } = await client.query(
        "select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = $1", [f]);
      rows.length ? ok(`function exists: public.${f}`) : bad(`function exists: public.${f}`, 'missing after full apply');
    }

    // Every table the app reads must have RLS on. A table that applies cleanly
    // with RLS off is the worst deploy outcome available: green push, working
    // app, everyone's data readable by anyone holding the anon key.
    console.log('');
    for (const t of EXPECTED_TABLES) {
      const { rows } = await client.query(
        "select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'public' and c.relname = $1", [t]);
      rows[0]?.relrowsecurity
        ? ok(`RLS enabled: public.${t}`)
        : bad(`RLS enabled: public.${t}`, 'table applied with row level security OFF');
    }
  }

  await client.end();
  await pg.stop();

  const total = failures === 0 ? 'all' : failures;
  console.log(`\ncheck-migrations-apply: ${failures === 0 ? 'passed' : `${total} failed`}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error(`check-migrations-apply: ERRORED — ${e.message}`);
  process.exit(1);
});
