// Gate for Lumen's design assessment (thread 37fb8ef6, WP-8): "Recap's stat
// labels are 10px uppercase" — theme.type.label is fontSize 12, but two
// call sites (MonthlyRecap.js revealTheme, RecapTab.js statLabel) spread it
// and then override to 10. A comment can't fail; this can.
//
//   npm run check:type-floor
//
// Asserts no `fontSize: N` literal under src/ falls below the 11px floor.
// Scans source text directly rather than importing StyleSheet objects — the
// values that matter here are what ships in the bundle, and a literal is
// the same number whether or not the module that holds it can be imported
// standalone (several screens pull in navigation/native deps this gate has
// no reason to stand up).
//
// Deliberately narrow to what it can state with certainty: a numeric
// literal directly after `fontSize:`. A computed value (`fontSize: scale(9)`,
// a theme-token reference) is not a literal this gate can evaluate, so it is
// left alone rather than guessed at — the same call made in check-nav-depth
// for sites the import walk can't reach: unreadable is not the same as
// passing, so those are reported separately, not silently skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FLOOR = 11;

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(name)) files.push(p);
  }
})(SRC);

let pass = 0;
let fail = 0;
const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/fontSize:\s*(-?\d+(?:\.\d+)?)\s*[,}]/);
    if (!m) return;
    const size = Number(m[1]);
    const rel = path.relative(ROOT, file);
    if (size < FLOOR) {
      fail += 1;
      failures.push(`${rel}:${i + 1} — fontSize: ${size} (floor is ${FLOOR})`);
    } else {
      pass += 1;
    }
  });
}

if (fail) {
  console.log('Below floor:');
  failures.forEach((f) => console.log(`  FAIL ${f}`));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
