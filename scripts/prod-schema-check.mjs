#!/usr/bin/env node
// prod-schema-check — is every migration in this tree actually applied to prod?
//
// PRE-MERGE COMMAND, NOT A GATE. This file is deliberately NOT named
// `scripts/check-*.mjs`: run-checks.mjs:124-125 enumerates that pattern off
// disk with no opt-out, and this probe must not be in the `npm test` chain —
// prod being behind is not a code defect, CI has no prod reach, and a red
// that means "the DB is behind" would sit in the suite as a standing red,
// burying every real failure behind it. Run it by hand (or from a PR
// checklist) before merging any branch that ships client code depending on a
// migration:
//
//   npm run preflight:prod-schema
//
// Exit codes:
//   0  every migration is applied — directly probed live, or implied by a
//      later live probe. This requires the LAST row to be live: order can
//      only vouch backwards.
//   1  prod is BEHIND this tree, or a migration on disk has no sentinel here
//   2  the instrument itself failed (env missing, network, calibration) —
//      NOT a statement about prod either way
//   3  INDETERMINATE: nothing probed missing, but the tail after the last
//      live probe — including the tip — has no anon-visible surface, so
//      this script structurally cannot answer "is the tip applied". Not a
//      pass: a deploy that dies mid-push right after the last probeable
//      migration looks exactly like this. `supabase migration list`
//      (authenticated) is the instrument that settles it; this one cannot.
//
// Three design rules, each paid for by a prior incident:
//
// 1. EVERY PROBE IS CALIBRATED. Before any verdict, the run must see a
//    known-good column answer 200, a fabricated column answer 42703, and a
//    fabricated RPC answer PGRST202 — in this same run, against this same
//    URL/key. Without that, a revoked grant, a typo'd table, or a dead relay
//    reads identically to "migration missing". No calibration, no verdict:
//    the run exits 2, never 0. (An instrument that can't tell "broken" from
//    "green" is the CI-skip hole with a different hat.)
//
// 2. THE ENUMERATOR IS THE DISK, NOT THIS LIST. Sentinels below must cover
//    exactly the files in supabase/migrations/ — an unmapped migration exits
//    1 by itself. That is the point: a branch adding a migration must add its
//    sentinel here in the same commit, and the new probe then holds the merge
//    until prod catches up. A hand-kept list with no enumerator was short the
//    day it mattered (the four-migration gate that missed cover_theme).
//
// 3. ORDER DOES THE VOUCHING FOR WHAT ANON CANNOT SEE — AND ONLY BACKWARDS.
//    Policies, triggers, grants, constraints and comments have no
//    anon-visible surface. The CLI applies migrations in version order, so a
//    later LIVE probe implies the unprobeable ones before it (IMPLIED).
//    Unprobeable versions AFTER the last LIVE probe are a different thing:
//    nothing vouches for them, a partial deploy that died right after the
//    last probeable migration produces exactly this table, and an earlier
//    draft of this script printed "prod is not behind" over that state and
//    exited 0 (Sage, 2026-08-17). An UNVERIFIED tail is exit 3, never 0.
//    The premise, stated so it can be attacked: order vouching holds ONLY if
//    the remote migration history is clean — prod's earliest schema predates
//    deploy-migrations.sh, so `supabase migration list` is the instrument
//    for that half, not this script.
//
// Sentinel names were read from the migration SQL, not the file names —
// 20260809000002's file says find_profile_by_email; the function it creates
// is find_connectable_profile.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

// ---------------------------------------------------------------------------
// Sentinels — one entry per migration file, in version order.
//   column : GET /rest/v1/<table>?select=<column>&limit=1
//   rpc    : POST /rest/v1/rpc/<fn>; expect 'exists' (anything but PGRST202)
//            or an exact PostgREST error code that only the migration produces
//   storage: GET /storage/v1/object/public/<bucket>/<nonsense>; a live public
//            bucket answers "Object not found", a missing one "Bucket not found"
//   order  : no anon-visible surface; status comes from version order (rule 3)
// ---------------------------------------------------------------------------
const SENTINELS = {
  '20260808000001_honeycombs_core_schema': { kind: 'column', table: 'entries', column: 'id' },
  '20260809000001_avatar_storage': { kind: 'storage', bucket: 'avatars' },
  '20260809000002_find_profile_by_email': { kind: 'rpc', fn: 'find_connectable_profile', args: { lookup_email: 'calibration@example.invalid' }, expect: 'exists' },
  '20260809000003_fix_likes_comments_visibility': { kind: 'order', reason: 'policy replace only' },
  '20260809000004_fix_shares_insert_recursion': { kind: 'order', reason: 'policy replace + function revoke' },
  '20260809000005_profiles_select_pending_counterparties': { kind: 'order', reason: 'policy replace only' },
  '20260810000001_content_length_caps': { kind: 'order', reason: 'check constraints; anon cannot insert to trip them' },
  '20260811000001_correct_unused_column_comments': { kind: 'order', reason: 'COMMENT ON only' },
  '20260813000001_notes_schema': { kind: 'column', table: 'notes', column: 'id' },
  '20260813000002_seeds_schema': { kind: 'column', table: 'seeds', column: 'id' },
  '20260813000003_hive_state_facts': { kind: 'rpc', fn: 'list_hive_state', args: {}, expect: 'exists' },
  '20260813000004_entries_hive_visibility': { kind: 'column', table: 'entries', column: 'hive_id' },
  // 42501 is this migration WORKING: it revokes definer-function execute from
  // anon, so the function answering "permission denied" to the anon key is the
  // observable. A 200 here would mean the revoke is NOT applied — but 'exists'
  // for 000003 above would still hold, which is why these are two rows.
  '20260813000005_revoke_definer_execute_from_anon': { kind: 'rpc', fn: 'list_hive_state', args: {}, expect: '42501' },
  '20260813000006_entries_theme_column': { kind: 'column', table: 'entries', column: 'theme' },
  '20260813000007_entries_one_per_day_dedupe': { kind: 'order', reason: 'unique index; anon cannot insert to trip it' },
  '20260815000001_private_hives': { kind: 'column', table: 'private_hives', column: 'owner_id' },
  '20260815000002_private_hives_entries_ownership_guard': { kind: 'order', reason: 'policy replace only' },
  '20260815000003_private_hives_sealed_at': { kind: 'column', table: 'private_hives', column: 'sealed_at' },
  '20260815000004_private_hives_sealed_at_guard': { kind: 'order', reason: 'trigger only' },
  '20260815000005_private_hives_sealed_entries_readonly': { kind: 'order', reason: 'policy replace only' },
  '20260815000006_private_hives_sealed_entries_immutable': { kind: 'order', reason: 'policy replace only' },
  '20260817000001_harden_definer_search_path': { kind: 'order', reason: 'ALTER FUNCTION SET search_path only' },
};

// ---------------------------------------------------------------------------
// Env — process.env first, then ./.env. Missing creds are exit 2, never a
// green skip: a preflight that "passes" because it could not run is the
// authorised-skip hole this repo already closed once in CI.
// ---------------------------------------------------------------------------
const readEnvFile = () => {
  const path = resolve(ROOT, '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*(EXPO_PUBLIC_SUPABASE_(?:URL|ANON_KEY))\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

const fileEnv = readEnvFile();
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const die = (code, msg) => {
  console.error(`\nprod-schema-check: ${msg}`);
  console.error({
    1: 'Prod is behind this tree (or a migration has no sentinel). Do not merge client code that reads the missing surface.',
    2: 'This is an instrument failure — it says nothing about prod either way.',
    3: 'INDETERMINATE — not a pass. Nothing probed missing, but nothing vouches for the tail either; a deploy that died mid-push looks exactly like this. Settle it with an authenticated `supabase migration list`.',
  }[code]);
  process.exit(code);
};

if (!URL_ || !ANON) {
  die(2, 'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set and not found in .env — cannot probe. (Not a pass: exit 2.)');
}

// ---------------------------------------------------------------------------
// HTTP — one classifier for every probe, so a surprising answer is reported
// as what came back, not guessed into a verdict.
// ---------------------------------------------------------------------------
const req = async (path, init = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10000),
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }
  return { status: res.status, code: body?.code ?? body?.statusCode ?? null, message: body?.message ?? '' };
};

const MISSING_CODES = new Set(['42703', '42P01', 'PGRST202', 'PGRST205']);

// LIVE / MISSING / INSTRUMENT(detail)
const classify = (probe, r) => {
  if (probe.kind === 'column') {
    if (r.status === 200) return 'LIVE';
    // 42501 is a GRANT answer, not a policy one (RLS denial is 200 []), and
    // column resolution precedes the privilege check, so reaching 42501
    // proves the column exists. Measured on embedded-postgres 18.4, plain
    // role, no RLS/PostgREST (Sage, 2026-08-17):
    //   granted table, fabricated column            -> 42703
    //   no-grant table, real column                 -> 42501
    //   no-grant table, fabricated column           -> 42703
    //   column-grant on id only, ungranted real col -> 42501
    //   column-grant on id only, fabricated column  -> 42703
    if (r.code === '42501') return 'LIVE';
    if (MISSING_CODES.has(r.code)) return 'MISSING';
    return `INSTRUMENT(${r.status}/${r.code ?? '??'})`;
  }
  if (probe.kind === 'rpc') {
    if (r.code === 'PGRST202') return 'MISSING';
    if (probe.expect === 'exists') return r.status < 500 ? 'LIVE' : `INSTRUMENT(${r.status}/${r.code ?? '??'})`;
    return r.code === probe.expect ? 'LIVE' : `MISSING (fn answered ${r.status}/${r.code ?? 'ok'}, expected ${probe.expect})`;
  }
  if (probe.kind === 'storage') {
    if (/object not found/i.test(r.message)) return 'LIVE';
    if (/bucket not found/i.test(r.message)) return 'MISSING';
    return `INSTRUMENT(${r.status}/${r.code ?? '??'}: ${r.message.slice(0, 60)})`;
  }
  throw new Error(`unknown probe kind ${probe.kind}`);
};

const runProbe = (probe) => {
  if (probe.kind === 'column') return req(`/rest/v1/${probe.table}?select=${probe.column}&limit=1`);
  if (probe.kind === 'rpc') return req(`/rest/v1/rpc/${probe.fn}`, { method: 'POST', body: JSON.stringify(probe.args ?? {}) });
  if (probe.kind === 'storage') return req(`/storage/v1/object/public/${probe.bucket}/prod-schema-check-calibration`);
};

// ---------------------------------------------------------------------------
const main = async () => {
  // Rule 2: the disk is the enumerator.
  const onDisk = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map((f) => f.replace(/\.sql$/, '')).sort();
  const mapped = Object.keys(SENTINELS).sort();
  const unmapped = onDisk.filter((v) => !SENTINELS[v]);
  const orphaned = mapped.filter((v) => !onDisk.includes(v));
  if (unmapped.length) die(1, `migration(s) on disk with no sentinel entry — add one (or an explicit 'order' entry with its reason) to SENTINELS:\n  ${unmapped.join('\n  ')}`);
  if (orphaned.length) die(1, `sentinel entr${orphaned.length > 1 ? 'ies' : 'y'} whose migration file is gone — remove from SENTINELS:\n  ${orphaned.join('\n  ')}`);

  // Rule 1: calibrate before any verdict. The reachability+auth control is
  // the fabricated rpc, NOT a table: every public table here is created by
  // some migration in the set under test, so a table-based known-good probe
  // makes its own row unfalsifiable — if that migration were missing, the
  // run would exit 2 blaming the key instead of reporting the row (Sage,
  // 2026-08-17). PGRST202 can only be spoken by PostgREST itself with the
  // key already accepted (a bad key dies at the gateway as 401 before
  // PostgREST answers; a wrong URL never says PGRST202), and a fabricated
  // name belongs to no migration by construction. (The OpenAPI root at
  // /rest/v1/ was tried for this job and is service_role-gated on Supabase —
  // anon reads 401 "Invalid API key" even with a valid key. Do not "fix" the
  // control back to it.) entries.id is therefore a *sentinel* probe wearing
  // a calibration hat: with PGRST202 already proving key+URL+PostgREST, a
  // missing-object answer on it is a verdict about 20260808000001, not an
  // instrument failure.
  console.log(`prod-schema-check against ${URL_}\n\ncalibration`);
  let cal;
  try {
    cal = await Promise.all([
      req('/rest/v1/entries?select=id&limit=1'),
      req('/rest/v1/entries?select=prod_schema_check_fabricated_column&limit=1'),
      req('/rest/v1/rpc/prod_schema_check_fabricated_fn', { method: 'POST', body: '{}' }),
    ]);
  } catch (e) {
    die(2, `network failure during calibration: ${e.message}`);
  }
  const [known, fabCol, fabFn] = cal;
  if (fabFn.code !== 'PGRST202') die(2, `fabricated rpc answered ${fabFn.status}/${fabFn.code ?? '??'}, expected PGRST202 — key revoked, URL wrong, prod unreachable, or the missing-object signal is not trustworthy in this run.`);
  if (MISSING_CODES.has(known.code)) {
    // PGRST202 above proved key+URL+PostgREST: the base schema itself is absent.
    die(1, `entries.id answered ${known.status}/${known.code} with PostgREST reachable and the key accepted — 20260808000001_honeycombs_core_schema is not on prod. Everything after it is not on prod either.`);
  }
  if (known.status !== 200) die(2, `known-good probe (entries.id) answered ${known.status}/${known.code ?? '??'}, expected 200 — not a missing-object code, so this is the instrument, not a verdict.`);
  if (fabCol.code !== '42703') die(2, `fabricated column answered ${fabCol.status}/${fabCol.code ?? '??'}, expected 42703 — the missing-column signal is not trustworthy in this run.`);
  console.log('  ok      fabricated rpc -> PGRST202 (proves key+URL+PostgREST); entries.id -> 200; fabricated column -> 42703');

  // Probe in version order.
  const rows = [];
  for (const version of onDisk) {
    const probe = SENTINELS[version];
    if (probe.kind === 'order') { rows.push({ version, probe, status: 'ORDER' }); continue; }
    let r;
    try { r = await runProbe(probe); } catch (e) { die(2, `network failure probing ${version}: ${e.message}`); }
    rows.push({ version, probe, status: classify(probe, r) });
  }

  // Rule 3: order does the vouching.
  const lastLive = rows.reduce((acc, row, i) => (row.status === 'LIVE' ? i : acc), -1);
  for (const [i, row] of rows.entries()) {
    if (row.status === 'ORDER') row.status = i < lastLive ? 'IMPLIED' : 'UNVERIFIED';
  }

  const label = (row) => {
    const p = row.probe;
    if (p.kind === 'column') return `${p.table}.${p.column}`;
    if (p.kind === 'rpc') return `rpc/${p.fn}${p.expect !== 'exists' ? ` -> ${p.expect}` : ''}`;
    if (p.kind === 'storage') return `storage bucket "${p.bucket}"`;
    return p.reason;
  };
  console.log('\nmigrations (version order)');
  for (const row of rows) {
    const mark = row.status === 'LIVE' ? 'live   ' : row.status === 'IMPLIED' ? 'implied' : row.status === 'UNVERIFIED' ? 'unverif' : 'MISSING';
    console.log(`  ${mark}  ${row.version}  [${label(row)}]${row.status.startsWith('MISSING (') ? ` — ${row.status.slice(8)}` : ''}`);
  }

  const missing = rows.filter((r) => r.status.startsWith('MISSING'));
  const instrument = rows.filter((r) => r.status.startsWith('INSTRUMENT'));
  const unverified = rows.filter((r) => r.status === 'UNVERIFIED');

  if (unverified.length || rows.some((r) => r.status === 'IMPLIED')) {
    console.log('\n  premise: implied/unverified statuses assume migrations reach prod in version'
      + '\n  order via the CLI. If `supabase migration list` shows a dirty remote history,'
      + '\n  order vouches for nothing — probe the surfaces yourself.');
  }
  if (instrument.length) die(2, `probe(s) answered something this script cannot classify: ${instrument.map((r) => `${r.version} ${r.status}`).join('; ')}`);
  if (missing.length) {
    die(1, `prod is missing ${missing.length} migration(s), earliest ${missing[0].version}. Everything at or after it is not on prod.`);
  }
  // Exit 0 demands the LAST row be live: order vouching only points backwards,
  // so an UNVERIFIED tail — which is what a deploy dying right after the last
  // probeable migration produces — can never be spoken for. An earlier draft
  // printed "prod is not behind this tree" over exactly that state.
  if (unverified.length) {
    die(3, `the tip is unverifiable from the anon surface: ${unverified.length} migration(s) after the last live probe (${unverified.map((r) => r.version).join(', ')}) have no probeable object. Whether prod has them is unknown to this script.`);
  }
  console.log(`\n  ${rows.length} migration(s): ${rows.filter((r) => r.status === 'LIVE').length} probed live, ${rows.filter((r) => r.status === 'IMPLIED').length} implied by a later live probe, tip probed live. Prod is not behind this tree.`);
};

main().catch((e) => die(2, `unexpected failure: ${e.stack ?? e.message}`));
