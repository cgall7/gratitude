// Gate: every migration on disk has a sentinel, and every sentinel has a
// migration on disk.
//
//   npm run check:migration-sentinels
//
// WHY (Sage, 2026-08-17): prod-schema-check.mjs is deliberately outside the
// test chain — it needs network and real credentials CI doesn't have — so
// the one instrument that answers "is prod behind this tree" runs only when
// someone remembers. The event that silently breaks it is purely on disk: a
// branch adds a migration and doesn't map it in SENTINELS. Until this gate,
// the only thing holding that invariant was a coordination note hand-carried
// in two PR bodies. The network probe stays manual; the completeness of its
// enumerator is what goes red here.
//
// BOTH DIRECTIONS, deliberately. A migration without a sentinel makes the
// preflight exit 1 the next time it runs — this gate just moves that red to
// commit time. A sentinel without a migration file is worse: a phantom in
// the probe list reads as a missing deployment and would send someone to
// deploy a migration that does not exist (the calibration-list phantom from
// the 2026-08-17 prod probes, as a standing hazard).
//
// SCOPE OF THE CLAIM. This is an existence check on names plus a shape check
// on entries — it does NOT validate that a sentinel probes the right object
// for its migration's SQL. A sentinel pointing at a column the migration
// never touched is green here and wrong; that half only falls out of running
// the real preflight against prod. Existence is the cheap half, and this
// gate says so rather than pretending otherwise.
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SENTINELS } from './lib/prod-schema-sentinels.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label}`);
};

const onDisk = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''))
  .sort();

// Empty universe is a broken enumerator, not a pass.
if (onDisk.length === 0) {
  bad('enumerate supabase/migrations', 'zero .sql files found — the glob or the layout moved, not that there are no migrations');
} else {
  ok(`enumerated ${onDisk.length} migration file(s) in supabase/migrations/`);
}

// Direction 1: every migration file is mapped. This is the commit-time
// version of prod-schema-check's exit-1-on-unmapped rule.
for (const version of onDisk) {
  if (SENTINELS[version]) {
    ok(`${version} has a sentinel`);
  } else {
    bad(
      `${version} has no SENTINELS entry`,
      'add one to scripts/lib/prod-schema-sentinels.mjs in the same commit as the migration — ' +
        'an anon-probeable object it creates, or kind "order" with the reason it has no anon surface. ' +
        'Until then the prod preflight cannot vouch for this tree.',
    );
  }
}

// Direction 2: every sentinel maps a real file. A phantom entry reads as a
// missing deployment the next time the preflight runs.
const diskSet = new Set(onDisk);
for (const version of Object.keys(SENTINELS)) {
  if (diskSet.has(version)) {
    ok(`${version} sentinel maps a file on disk`);
  } else {
    bad(
      `SENTINELS['${version}'] has no migration file`,
      'supabase/migrations/ has no matching .sql — a phantom probe reads as "prod is missing a migration" ' +
        'that cannot be deployed. Remove the entry or restore the file.',
    );
  }
}

// Shape: an entry of an unknown kind, or missing the fields its kind probes
// with, is as unusable to the preflight as a missing one.
const REQUIRED_FIELDS = {
  column: ['table', 'column'],
  rpc: ['fn', 'expect'],
  storage: ['bucket'],
  order: ['reason'],
};
for (const [version, probe] of Object.entries(SENTINELS)) {
  const fields = REQUIRED_FIELDS[probe.kind];
  if (!fields) {
    bad(`SENTINELS['${version}'] kind '${probe.kind}'`, `not one of ${Object.keys(REQUIRED_FIELDS).join('/')}`);
    continue;
  }
  const missing = fields.filter((f) => probe[f] === undefined);
  if (missing.length) {
    bad(`SENTINELS['${version}'] (${probe.kind})`, `missing field(s): ${missing.join(', ')}`);
  } else {
    ok(`${version} sentinel shape is probeable (${probe.kind})`);
  }
}

console.log(`\ncheck-migration-sentinels: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
