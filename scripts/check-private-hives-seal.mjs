// Gate for private_hives.sealed_at's write-guard
// (supabase/migrations/20260815000004_private_hives_sealed_at_guard.sql)
// and the sealed-hive entries lockout
// (supabase/migrations/20260815000005_private_hives_sealed_entries_readonly.sql).
//
//   npm run check:private-hives-seal
//
// `private_hives_update_own` (20260815000001) is a full-row UPDATE policy:
// it gates which ROW an owner can touch, not which COLUMN. Under Pixel's
// admission test (finished/kept/singular, WP-2), sealed_at is the fact that
// makes a hive card gold -- and "finished" that a client can write back to
// null isn't finished. This gate proves the one-way trigger actually holds,
// the same way check-hive-state-rls.mjs proves an RLS inheritance claim
// instead of trusting the comment that states it.
//
// Pixel's follow-up finding (same thread, replying to 000004): the flag
// alone doesn't stop authoring -- entries_insert_own/entries_update_own
// admitted a hive entry on ownership alone, no reference to seal state. So
// this gate also proves a sealed hive rejects both a new entry and an edit
// to an existing one, with an unsealed-hive control alongside so the
// negative isn't just "the whole table is now unwritable."
//
// Modeled on check-hive-state-rls.mjs/check-seeds-rls.mjs for the harness
// shape: real migrations off disk, mutations run as `authenticated` (never
// the table owner), and the trigger's refusal is checked by catching the
// raised exception, not by a query returning zero rows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const require = createRequire(import.meta.url);

if (process.env.SKIP_PG_GATES === '1') {
  console.log('check-private-hives-seal: SKIPPED — SKIP_PG_GATES=1 set explicitly');
  process.exit(0);
}

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require('embedded-postgres').default;
  require('pg');
} catch (e) {
  console.error(
    `check-private-hives-seal: FAILED — embedded-postgres/pg not installed (${e.message.split('\n')[0]}).\n` +
      '  Run `npm install` (both are devDependencies), or set SKIP_PG_GATES=1 to skip deliberately\n' +
      '  on a machine that genuinely cannot run a local Postgres.'
  );
  process.exit(1);
}

// The full chain, in order: private_hives (20260815000001) depends on
// entries.hive_id (20260813000004), which depends on entries itself
// (20260808000001) -- listed explicitly, not globbed, so a future
// migration can't silently change what this gate replays.
const APPLY = [
  '20260808000001_honeycombs_core_schema.sql',
  '20260809000001_avatar_storage.sql',
  '20260809000002_find_profile_by_email.sql',
  '20260809000003_fix_likes_comments_visibility.sql',
  '20260809000004_fix_shares_insert_recursion.sql',
  '20260809000005_profiles_select_pending_counterparties.sql',
  '20260810000001_content_length_caps.sql',
  '20260811000001_correct_unused_column_comments.sql',
  '20260813000001_notes_schema.sql',
  '20260813000002_seeds_schema.sql',
  '20260813000003_hive_state_facts.sql',
  '20260813000004_entries_hive_visibility.sql',
  '20260813000005_revoke_definer_execute_from_anon.sql',
  '20260813000006_entries_theme_column.sql',
  '20260813000007_entries_one_per_day_dedupe.sql',
  '20260815000001_private_hives.sql',
  '20260815000002_private_hives_entries_ownership_guard.sql',
  '20260815000003_private_hives_sealed_at.sql',
  '20260815000004_private_hives_sealed_at_guard.sql',
  '20260815000005_private_hives_sealed_entries_readonly.sql',
];

const OWNER = '11111111-1111-1111-1111-111111111111';
const STRANGER = '22222222-2222-2222-2222-222222222222';

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
const firstLine = (e) => e.message.split('\n')[0].slice(0, 96);

// Same shape as the other PG gates, plus the `storage` shim
// check-share-visibility.mjs uses: 20260809000001_avatar_storage.sql
// references storage.objects/storage.foldername(), which don't exist
// outside Supabase.
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
  create function storage.foldername(n text) returns text[] language sql immutable as $$
    select string_to_array(n, '/');
  $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function main() {
  const dataDir = path.join(ROOT, '.private-hives-seal-pgdata');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54332, // seeds-rls 54329, hive-state 54330, share-visibility 54331; distinct so gates can run concurrently
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');
  const client = pg.getPgClient('app');
  await client.connect();

  try {
    await client.query(SUPABASE_ENV);
    for (const file of APPLY) {
      const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
      await client.query(sql);
    }

    // 20260808000001's on_auth_user_created trigger auto-creates the
    // matching profiles row from raw_user_meta_data — an explicit profiles
    // insert here would collide with it.
    await client.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $3), ($2, $4)",
      [OWNER, STRANGER, JSON.stringify({ display_name: 'Owner' }), JSON.stringify({ display_name: 'Stranger' })]
    );

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

    // Seed one in-progress hive as the owner, bypassing RLS as `postgres`
    // (this gate is about the trigger, not the insert policy).
    const { rows } = await client.query(
      "insert into public.private_hives (owner_id, subject_name) values ($1, 'Kid') returning id",
      [OWNER]
    );
    const hiveId = rows[0].id;

    // 1. Owner can update an unrelated column while unsealed.
    try {
      await asUser(OWNER, () =>
        client.query('update public.private_hives set subject_name = $1 where id = $2', ['Kiddo', hiveId])
      );
      ok('owner may edit subject_name while unsealed');
    } catch (e) {
      bad('owner may edit subject_name while unsealed', firstLine(e));
    }

    // 2. Owner can seal (null -> timestamp).
    try {
      await asUser(OWNER, () =>
        client.query('update public.private_hives set sealed_at = now() where id = $1', [hiveId])
      );
      ok('owner may seal (null -> timestamp)');
    } catch (e) {
      bad('owner may seal (null -> timestamp)', firstLine(e));
    }

    // 3. Owner CANNOT unseal (timestamp -> null) — the finding this gate exists for.
    try {
      await asUser(OWNER, () =>
        client.query('update public.private_hives set sealed_at = null where id = $1', [hiveId])
      );
      bad('owner may not unseal (timestamp -> null)', 'update succeeded; sealed_at is not immutable');
    } catch (e) {
      if (/sealed_at cannot be changed/.test(e.message)) {
        ok('owner may not unseal (timestamp -> null)');
      } else {
        bad('owner may not unseal (timestamp -> null)', `wrong error: ${firstLine(e)}`);
      }
    }

    // 4. Owner CANNOT re-seal to a different timestamp either.
    try {
      await asUser(OWNER, () =>
        client.query("update public.private_hives set sealed_at = now() + interval '1 day' where id = $1", [hiveId])
      );
      bad('owner may not re-seal to a different timestamp', 'update succeeded; sealed_at is not immutable');
    } catch (e) {
      if (/sealed_at cannot be changed/.test(e.message)) {
        ok('owner may not re-seal to a different timestamp');
      } else {
        bad('owner may not re-seal to a different timestamp', `wrong error: ${firstLine(e)}`);
      }
    }

    // 5. Sealed row is not frozen wholesale — other columns still editable.
    try {
      await asUser(OWNER, () =>
        client.query('update public.private_hives set subject_name = $1 where id = $2', ['Kiddo (sealed)', hiveId])
      );
      ok('owner may still edit other columns after sealing');
    } catch (e) {
      bad('owner may still edit other columns after sealing', firstLine(e));
    }

    // Second hive, left unsealed, as the control for tests 6-9: proves the
    // policy change scopes to the sealed hive, not to hive_id in general.
    const { rows: openRows } = await client.query(
      "insert into public.private_hives (owner_id, subject_name) values ($1, 'Second Kid') returning id",
      [OWNER]
    );
    const openHiveId = openRows[0].id;

    // 6. Owner CANNOT insert a new entry into a sealed hive.
    try {
      await asUser(OWNER, () =>
        client.query(
          "insert into public.entries (user_id, content, entry_date, hive_id) values ($1, 'late entry', current_date, $2)",
          [OWNER, hiveId]
        )
      );
      bad('owner may not insert an entry into a sealed hive', 'insert succeeded');
    } catch (e) {
      if (/row-level security/.test(e.message)) {
        ok('owner may not insert an entry into a sealed hive');
      } else {
        bad('owner may not insert an entry into a sealed hive', `wrong error: ${firstLine(e)}`);
      }
    }

    // 7. Control: owner CAN insert a new entry into a hive that isn't sealed.
    let openEntryId;
    try {
      const { rows: entryRows } = await asUser(OWNER, () =>
        client.query(
          "insert into public.entries (user_id, content, entry_date, hive_id) values ($1, 'open hive entry', current_date, $2) returning id",
          [OWNER, openHiveId]
        )
      );
      openEntryId = entryRows[0].id;
      ok('owner may insert an entry into an unsealed hive (control)');
    } catch (e) {
      bad('owner may insert an entry into an unsealed hive (control)', firstLine(e));
    }

    // 8. Owner CANNOT edit an existing entry that belongs to a sealed hive.
    // Seed the row as postgres first (bypassing RLS, same as the hive setup
    // above) so this isolates the update policy from the insert policy.
    const { rows: sealedEntryRows } = await client.query(
      "insert into public.entries (user_id, content, entry_date, hive_id) values ($1, 'pre-seal entry', current_date - 1, $2) returning id",
      [OWNER, hiveId]
    );
    const sealedEntryId = sealedEntryRows[0].id;
    try {
      await asUser(OWNER, () =>
        client.query('update public.entries set content = $1 where id = $2', ['edited after seal', sealedEntryId])
      );
      bad('owner may not edit an entry in a sealed hive', 'update succeeded');
    } catch (e) {
      if (/row-level security/.test(e.message)) {
        ok('owner may not edit an entry in a sealed hive');
      } else {
        bad('owner may not edit an entry in a sealed hive', `wrong error: ${firstLine(e)}`);
      }
    }

    // 9. Control: owner CAN edit an entry in a hive that isn't sealed.
    try {
      await asUser(OWNER, () =>
        client.query('update public.entries set content = $1 where id = $2', ['edited, still open', openEntryId])
      );
      ok('owner may edit an entry in an unsealed hive (control)');
    } catch (e) {
      bad('owner may edit an entry in an unsealed hive (control)', firstLine(e));
    }

    console.log(`\ncheck-private-hives-seal: ${pass} passed, ${failures.length} failed`);
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('check-private-hives-seal: FAILED —', e.message);
  process.exit(1);
});
