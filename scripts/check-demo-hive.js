// Gate for the demo hive set (src/constants/demoHive.js). Runs the real
// module rather than re-typing its data, so what's asserted is what ships.
// Promoted from an untracked .scratch copy: an assertion nobody can run
// guards nothing against the next editor.
//
//   node scripts/check-demo-hive.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const FILE = path.join(ROOT, 'constants', 'demoHive.js');
const src = fs.readFileSync(FILE, 'utf8');

// Execute the ESM module as CJS: the only import is toISODate, and the only
// export is the builder. Substitute both rather than reimplementing them.
const dateRanges = fs.readFileSync(path.join(ROOT, 'utils', 'dateRanges.js'), 'utf8');
const toISODateSrc = dateRanges.match(/export const toISODate = [\s\S]*?\n};/)[0].replace('export ', '');

const shim = `${toISODateSrc}\n${src
  .replace(/^import .*$/gm, '')
  .replace('export const demoHiveShares', 'const demoHiveShares')}\nmodule.exports = { demoHiveShares, RAW_MEMBERS };`;

const mod = { exports: {} };
new Function('module', 'exports', shim)(mod, mod.exports);
const { demoHiveShares, RAW_MEMBERS } = mod.exports;

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// --- 1. Sizing: the invariants the header comment claims ---
const HIVE_SLOTS = Number(
  fs.readFileSync(path.join(ROOT, 'components', 'HoneycombGrid.js'), 'utf8').match(/HIVE_SLOTS\s*=\s*(\d+)/)[1],
);
check('HIVE_SLOTS read from the grid, not typed here', HIVE_SLOTS, 7);

const byDay = {};
for (const m of RAW_MEMBERS) byDay[m.daysAgo] = (byDay[m.daysAgo] ?? 0) + 1;
console.log(`     day spread: ${JSON.stringify(byDay)}  (total ${RAW_MEMBERS.length})`);

check(`day 0 fills all ${HIVE_SLOTS} seats`, byDay[0] >= HIVE_SLOTS, true);
for (let d = 1; d <= 6; d += 1) {
  check(`day ${d} has >= 2 members (week header reads populated)`, (byDay[d] ?? 0) >= 2, true);
}
check('no member older than 6 days (outside the 7-day window)',
  RAW_MEMBERS.every((m) => m.daysAgo >= 0 && m.daysAgo <= 6), true);

// Ordering matters until the spine partitions: the pre-partition call site
// takes the first HIVE_SLOTS of the list, so those must all be day 0.
check('first HIVE_SLOTS entries are all day 0',
  RAW_MEMBERS.slice(0, HIVE_SLOTS).every((m) => m.daysAgo === 0), true);

// --- 2. Dates are live, not frozen at import ---
const at = (iso) => demoHiveShares(new Date(`${iso}T12:00:00`));
const todayOf = (shares) => shares.filter((s) => s.entryDate === shares[0].entryDate).length;

const before = at('2026-08-12');
const after = at('2026-08-13');
check('day-0 entryDate tracks the clock across midnight',
  [before[0].entryDate, after[0].entryDate], ['2026-08-12', '2026-08-13']);
check('the same members are still "today" after midnight',
  [todayOf(before), todayOf(after)], [HIVE_SLOTS, HIVE_SLOTS]);

// Month and year boundaries, where naive date math breaks.
check('crosses a month boundary backwards', at('2026-09-02')[RAW_MEMBERS.length - 1].entryDate, '2026-08-27');
check('crosses a year boundary backwards', at('2027-01-03')[RAW_MEMBERS.length - 1].entryDate, '2026-12-28');

// --- 3. Partition sanity: seven distinct days, comb closes on day 0 ---
const shares = at('2026-08-12');
const days = [...new Set(shares.map((s) => s.entryDate))].sort().reverse();
check('the set spans exactly 7 distinct days', days.length, 7);
check('day-0 bucket closes the comb', shares.filter((s) => s.entryDate === days[0]).length >= HIVE_SLOTS, true);

// --- 4. Comb tint coverage: the day-0 seven must not go monochrome ---
// hexTintFor is a mod-2 rotation over hashName (Avatar.js), and the day-0
// seven are the only cells a fresh demo user ever sees. A name list can
// hash all one way by accident with no error anywhere — assert both tints
// are represented rather than trusting a hand count in a comment.
const avatarSrc = fs.readFileSync(path.join(ROOT, 'components', 'Avatar.js'), 'utf8');
const hashName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 2147483647;
  return hash;
};
const HEX_TINT_COUNT = avatarSrc.match(/const HEX_TINTS = \[([^\]]*)\]/)[1].split(',').filter(Boolean).length;
check('Avatar.js still defines a two-tint HEX_TINTS rotation', HEX_TINT_COUNT, 2);
const dayZeroTints = new Set(
  RAW_MEMBERS.filter((m) => m.daysAgo === 0).map((m) => hashName(m.name) % HEX_TINT_COUNT),
);
check('both hex tints appear among the day-0 seven', dayZeroTints.size, HEX_TINT_COUNT);

// --- 5. §15 word gate: word-boundary AND raw substring ---
const FORBIDDEN = [
  'God', 'Jesus', 'Lord', 'pray', 'scripture', 'church',
  'faith', 'blessed', 'worship', 'sin', 'hallelujah', 'ritual',
];
// Everything that renders: the gratitude line and the display name.
const copy = shares.flatMap((s) => [s.content, s.author.display_name]);
check('every string in the set is checked', copy.length, RAW_MEMBERS.length * 2);

const wordHits = [];
const subHits = [];
for (const word of FORBIDDEN) {
  const boundary = new RegExp(`\\b${word}\\b`, 'i');
  for (const line of copy) {
    if (boundary.test(line)) wordHits.push(`${word} → "${line}"`);
    if (line.toLowerCase().includes(word.toLowerCase())) subHits.push(`${word} → "${line}"`);
  }
}
check('no forbidden word (word boundary)', wordHits.join('; '), '');
check('no forbidden word (raw substring)', subHits.join('; '), '');

// --- 6. Shape parity with a real share, so FeedCard and toGridMember both work ---
const FEEDCARD_READS = ['entryDate', 'author', 'content', 'likeCount', 'likedByMe', 'commentCount', 'id'];
check('carries every field FeedCard reads',
  FEEDCARD_READS.filter((k) => !(k in shares[0])), []);
check('every id is unique', new Set(shares.map((s) => s.id)).size, RAW_MEMBERS.length);
check('every member is flagged isDemo', shares.every((s) => s.isDemo === true), true);
check('no demo member is isOwn', shares.every((s) => s.isOwn === false), true);
check('all counts zeroed', shares.every((s) => s.likeCount === 0 && s.commentCount === 0 && s.likedByMe === false), true);

// --- 7. Copy hygiene ---
const names = RAW_MEMBERS.map((m) => m.name);
check('names are unique', new Set(names).size, names.length);
check('no name longer than 5 chars (hex cell)', names.filter((n) => n.length > 5), []);
const lines = RAW_MEMBERS.map((m) => m.gratitude);
check('gratitude lines are unique', new Set(lines).size, lines.length);
const lens = lines.map((l) => l.length);
console.log(`     line lengths: ${Math.min(...lens)}–${Math.max(...lens)} chars`);
// The originals ran 42–57. Staying inside that band means no new line
// can wrap where an existing one didn't.
check('no line longer than the longest original (57)', lines.filter((l) => l.length > 57), []);
check('every line ends in a period', lines.filter((l) => !l.endsWith('.')), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
