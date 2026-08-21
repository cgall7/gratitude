// The one sanctioned way to shrink a ratchet baseline (see
// scripts/lib/ratchet.mjs). Re-runs each ratcheted gate's own live sweep via
// `--dump-json` — the exact function that produces the numbers the gate
// checks against, not a hand-maintained copy — and overwrites the baseline
// files with whatever it finds, keeping each file's `owner` field.
//
//   npm run ratchet:update
//
// Run this in the SAME commit that fixes one of the ratcheted violations
// (or, less often, that adds a legitimate new one someone has explicitly
// signed off on) — never as a separate cleanup pass. A baseline edited any
// other way is exactly the "furniture" Lumen's ruling warned against: it
// stops meaning "what's left to fix" and starts meaning "whatever's in the
// file," and check-safe-area.mjs / check-spring-adoption.mjs can no longer
// tell the difference.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES_DIR = path.join(ROOT, 'scripts', 'baselines');

const dumpGate = (script) => {
  const out = execFileSync('node', [path.join(ROOT, 'scripts', script), '--dump-json'], { encoding: 'utf8' });
  return JSON.parse(out);
};

const writeBaseline = (fileName, entries) => {
  const filePath = path.join(BASELINES_DIR, fileName);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const before = existing.entries.length;
  existing.entries = entries;
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n');
  console.log(`${fileName}: ${before} -> ${entries.length}`);
};

const safeArea = dumpGate('check-safe-area.mjs');
writeBaseline('safe-area-padding.json', safeArea.chromePadding);
writeBaseline('safe-area-deprecated-import.json', safeArea.deprecatedSafeAreaView);

const springAdoption = dumpGate('check-spring-adoption.mjs');
writeBaseline('spring-adoption-springs.json', springAdoption.springs);
writeBaseline('spring-adoption-durations.json', springAdoption.durations);

console.log('\nBaselines regenerated from the live sweep. Review the diff before committing —');
console.log('every row removed should correspond to a real fix in this same change.');
