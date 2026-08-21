// The one sanctioned way to shrink a ratchet baseline (see
// scripts/lib/ratchet.mjs). Re-runs each ratcheted gate's own live sweep via
// `--dump-json` — the exact function that produces the numbers the gate
// checks against, not a hand-maintained copy — and rewrites the baseline
// files, keeping each file's `owner` field.
//
//   npm run ratchet:update
//
// Run this in the SAME commit that fixes one of the ratcheted violations —
// never as a separate cleanup pass. A baseline edited any other way is
// exactly the "furniture" Lumen's R15 ruling warned against: it stops
// meaning "what's left to fix" and starts meaning "whatever's in the file."
//
// R16b (Lumen, 2026-08-21) — MONOTONE BY DEFAULT. The previous version of
// this script overwrote a baseline's `entries` with the entire live sweep,
// unconditionally. That is not "shrink," it's "replace" — a genuinely new
// violation sitting alongside a real fix (or even alongside a cosmetic
// line shift, under the old line-sensitive key) got written in exactly as
// readily as the fix did, with nothing but a `14 -> 15` line scrolling by
// to notice it. See `computeMonotoneUpdate` in lib/ratchet.mjs for the
// mechanism: a live row is kept only if it (a) matches a baseline row's
// key exactly, (b) matches a retired baseline row on every field but
// `line` (same violation, moved), or (c) is explicitly named below. Every
// live row that fails all three BLOCKS the write — the baseline file is
// left untouched and the script exits nonzero — rather than being folded
// in silently.
//
//   npm run ratchet:update -- --accept-new <file>:<key>[,<file>:<key>...]
//
// Use `--accept-new` only for a violation someone has actually signed off
// on as legitimate new debt (per R15's "named owner" condition) — never as
// a way to get past a block you haven't looked at.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { computeMonotoneUpdate } from './lib/ratchet.mjs';
import { paddingKeyOf, deprecatedImportKeyOf, springKeyOf, durationKeyOf } from './lib/ratchet-keys.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES_DIR = path.join(ROOT, 'scripts', 'baselines');

const acceptNewKeys = new Set();
process.argv.forEach((arg, i) => {
  if (arg === '--accept-new') {
    (process.argv[i + 1] ?? '').split(',').filter(Boolean).forEach((k) => acceptNewKeys.add(k));
  } else if (arg.startsWith('--accept-new=')) {
    arg.slice('--accept-new='.length).split(',').filter(Boolean).forEach((k) => acceptNewKeys.add(k));
  }
});

const dumpGate = (script) => {
  const out = execFileSync('node', [path.join(ROOT, 'scripts', script), '--dump-json'], { encoding: 'utf8' });
  return JSON.parse(out);
};

let blocked = false;

const updateBaseline = (fileName, liveEntries, keyOf) => {
  const filePath = path.join(BASELINES_DIR, fileName);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { next, rekeyed, genuinelyNew, accepted, retired } = computeMonotoneUpdate(
    liveEntries,
    existing.entries,
    keyOf,
    acceptNewKeys
  );

  if (genuinelyNew.length) {
    blocked = true;
    console.log(`\n${fileName}: REFUSED — not written. ${genuinelyNew.length} live violation(s) match no retired baseline row:`);
    for (const e of genuinelyNew) console.log(`  ${keyOf(e)}`);
    console.log('  If these are real new debt someone has signed off on, re-run with:');
    console.log(`    npm run ratchet:update -- --accept-new ${genuinelyNew.map(keyOf).join(',')}`);
    return;
  }

  const before = existing.entries.length;
  existing.entries = next;
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n');
  const bits = [`${fileName}: ${before} -> ${next.length}`];
  if (rekeyed.length) bits.push(`${rekeyed.length} re-keyed (same violation, line moved)`);
  if (retired.length) bits.push(`${retired.length} retired`);
  if (accepted.length) bits.push(`${accepted.length} accepted as new (--accept-new)`);
  console.log(bits.join('  |  '));
};

const safeArea = dumpGate('check-safe-area.mjs');
updateBaseline('safe-area-padding.json', safeArea.chromePadding, paddingKeyOf);
updateBaseline('safe-area-deprecated-import.json', safeArea.deprecatedSafeAreaView, deprecatedImportKeyOf);

const springAdoption = dumpGate('check-spring-adoption.mjs');
updateBaseline('spring-adoption-springs.json', springAdoption.springs, springKeyOf);
updateBaseline('spring-adoption-durations.json', springAdoption.durations, durationKeyOf);

if (blocked) {
  console.log('\nOne or more baselines were left untouched — resolve the new violation(s) above or name them with --accept-new.');
  process.exit(1);
}

console.log('\nBaselines regenerated from the live sweep (monotone: retire or re-key only; new rows need --accept-new).');
console.log('Review the diff before committing — every row removed should correspond to a real fix in this same change.');
