// Direct unit coverage for src/utils/hiveState.js's `isBlooming` (issue:
// client layer has zero runtime tests) — a pure recency check with no
// direct assertion anywhere before this. It decides whether a Honeycomb
// cell reads as Blooming, so its two edges (the window boundary, and a
// clock-skew future timestamp) are exactly the cases worth pinning: get the
// boundary's `<=` vs `<` wrong and a cell either blooms one tick too long
// or drops one tick early, and get the "elapsedMs >= 0" guard wrong and a
// server clock a few seconds ahead of the client blooms a cell that hasn't
// received anything yet.
//
//   npm run check:hive-state-utils
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { isBlooming, HIVE_BLOOMING_WINDOW_HOURS } = await import(path.join(ROOT, 'src/utils/hiveState.js'));

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};
const eq = (label, actual, expected) => {
  if (actual === expected) ok(label);
  else bad(label, `got ${actual}, expected ${expected}`);
};

eq('window constant matches R59\'s ruled value', HIVE_BLOOMING_WINDOW_HOURS, 48);

const now = new Date(2026, 7, 13, 12, 0, 0);
const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);

eq('null lastNoteReceivedAt -> false', isBlooming(null, now), false);
eq('undefined lastNoteReceivedAt -> false', isBlooming(undefined, now), false);
eq('a note received right now -> true', isBlooming(now, now), true);
eq('a note received well inside the window -> true', isBlooming(hoursAgo(24), now), true);
eq(
  'a note received exactly at the window edge -> true (inclusive)',
  isBlooming(hoursAgo(HIVE_BLOOMING_WINDOW_HOURS), now),
  true
);
eq(
  'a note received one second past the window edge -> false',
  isBlooming(new Date(hoursAgo(HIVE_BLOOMING_WINDOW_HOURS).getTime() - 1000), now),
  false
);
eq('a note from well outside the window -> false', isBlooming(hoursAgo(200), now), false);
eq(
  'a future timestamp (clock skew) -> false, not a negative-elapsed true',
  isBlooming(new Date(now.getTime() + 60 * 60 * 1000), now),
  false
);
eq('a string-typed date (as it arrives over JSON from Supabase) works the same as a Date', isBlooming(hoursAgo(1).toISOString(), now), true);
eq('a custom window narrower than the default is honored', isBlooming(hoursAgo(10), now, 5), false);
eq('a custom window wider than the default is honored', isBlooming(hoursAgo(60), now, 72), true);

console.log(`\ncheck-hive-state-utils: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
