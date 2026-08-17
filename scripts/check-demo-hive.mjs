// Gate for the demo hive set (src/constants/demoHive.js).
//
//   npm run check:demo-hive
//
// §18 partitions the feed on date, which turned this decorative file into
// load-bearing data: its day spread decides whether a demo user's Today comb
// closes and whether every day header in the week view has something under
// it. Those invariants are written in demoHive.js's header comment, but a
// comment cannot fail — so they are asserted here.
//
// Two rules this file tries to keep:
//
//   1. RUN THE REAL MODULE. Never re-type its data. Node 22's ESM syntax
//      detection parses demoHive.js as written, so this imports it through
//      Node's own loader; the only gap is that Metro resolves extensionless
//      specifiers ('../utils/dateRanges') and Node does not, which the resolve
//      hook below closes. An earlier version string-replaced the imports away
//      with a regex, which silently mis-parsed the moment a second import was
//      added. Loading the module for real has no such failure mode.
//   2. READ CONSTANTS OUT OF THE FILES THAT OWN THEM. HIVE_SLOTS comes from
//      HoneycombGrid.js and the tint rotation from Avatar.js. If either moves,
//      this fails loudly instead of asserting a number that used to be true.
//
// Asserts against the PUBLIC export only (demoHiveShares), not the internal
// RAW_MEMBERS list — what ships is what gets checked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { FORBIDDEN_WORDS } from './forbidden-words.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

if (typeof registerHooks !== 'function') {
  console.error('Needs Node >= 22.15 for module.registerHooks(). Found ' + process.version);
  process.exit(1);
}

// Metro resolves './foo'; Node requires './foo.js'. Bridge only that.
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
});

const { demoHiveShares } = await import(
  pathToFileURL(path.join(ROOT, 'src/constants/demoHive.js')).href
);

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const at = (iso) => demoHiveShares(new Date(`${iso}T12:00:00`));
const REF = '2026-08-12';
const shares = at(REF);

// Reconstruct each member's daysAgo from the entryDate it actually ships,
// rather than trusting the source list.
const isoMinus = (iso, days) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DAY_ISO = Array.from({ length: 7 }, (_, d) => isoMinus(REF, d));
const daysAgoOf = (share) => DAY_ISO.indexOf(share.entryDate);

// --- 1. Sizing: the invariants demoHive.js's header claims ---
const HIVE_SLOTS = Number(read('src/components/HoneycombGrid.js').match(/HIVE_SLOTS\s*=\s*(\d+)/)[1]);
check('HIVE_SLOTS read from the grid, not typed here', Number.isInteger(HIVE_SLOTS) && HIVE_SLOTS > 0, true);

const byDay = {};
for (const s of shares) byDay[daysAgoOf(s)] = (byDay[daysAgoOf(s)] ?? 0) + 1;
console.log(`     day spread: ${JSON.stringify(byDay)}  (total ${shares.length})`);

check('no member falls outside the 7-day window', shares.filter((s) => daysAgoOf(s) < 0), []);
check(`day 0 fills all ${HIVE_SLOTS} seats`, (byDay[0] ?? 0) >= HIVE_SLOTS, true);
for (let d = 1; d <= 6; d += 1) {
  check(`day ${d} has >= 2 members (week header reads populated)`, (byDay[d] ?? 0) >= 2, true);
}
check('the set spans exactly 7 distinct days', new Set(shares.map((s) => s.entryDate)).size, 7);

// Ordering matters until the spine partitions: the pre-partition call site
// takes the first HIVE_SLOTS of the list, so those must all be day 0.
check('first HIVE_SLOTS entries are all day 0',
  shares.slice(0, HIVE_SLOTS).every((s) => daysAgoOf(s) === 0), true);

// --- 2. The day-0 comb must not go monochrome ---
// hexTintFor is a MOD-2 rotation over hashName with nothing distributing it,
// and the day-0 members are the only cells a fresh demo user ever sees, so a
// name list can hash all one way by accident and paint a one-color comb with
// no error anywhere. Both the rotation and the hash are read out of Avatar.js
// so this tracks the real function rather than a copy of it.
const avatar = read('src/components/Avatar.js');
const HEX_TINTS = avatar.match(/const HEX_TINTS = \[([^\]]*)\]/)[1]
  .split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace('theme.colors.', ''));
const hashName = new Function(`${avatar.match(/const hashName = \(name\) => \{[\s\S]*?\n\};/)[0]}\nreturn hashName;`)();
const tintOf = (name) => HEX_TINTS[hashName(name) % HEX_TINTS.length];

const tally = (names) => names.reduce((acc, n) => ({ ...acc, [tintOf(n)]: (acc[tintOf(n)] ?? 0) + 1 }), {});
const day0Names = shares.filter((s) => daysAgoOf(s) === 0).map((s) => s.author.display_name);
const day0Tints = tally(day0Names);
console.log(`     tints: ${HEX_TINTS.join(' / ')} — day 0 ${JSON.stringify(day0Tints)}, all ${shares.length} ${JSON.stringify(tally(shares.map((s) => s.author.display_name)))}`);

check('every tint in the rotation appears in the day-0 comb',
  HEX_TINTS.filter((t) => !(t in day0Tints)), []);
// A single odd cell in a seven-cell ring reads as an accident, not a rotation:
// two is the floor at which the second tint reads as deliberate.
check('the minority tint holds >= 2 of the day-0 cells',
  Math.min(...HEX_TINTS.map((t) => day0Tints[t] ?? 0)) >= 2, true);

// --- 2b. §21.9.1 (R59): blooming/seeded are authored, not invisible ---
// Both states are decorative-only (no notes/seeds rows back a demo member),
// but a fresh 0-2-connection tester's ONLY comb is this one, so an
// un-authored set ships 6.4 invisible to the round meant to validate it.
const day0Shares = shares.filter((s) => daysAgoOf(s) === 0);
const bloomingCount = day0Shares.filter((s) => s.blooming).length;
console.log(`     day-0 blooming/seeded: ${day0Shares.map((s) => `${s.author.display_name}${s.blooming ? ' B' : ''}${s.seeded ? ' S' : ''}`).join(', ')}`);
check('day 0 has at least one blooming member (states are not invisible)', bloomingCount >= 1, true);
check('§21.9 readable-band invariant: at most 3 of the day-0 seven blooming', bloomingCount <= 3, true);
check('at least one day-0 member carries BOTH states (§21.10 composition case on screen)',
  day0Shares.some((s) => s.blooming && s.seeded), true);

// --- 3. Dates are live, not frozen at import ---
const todayCountOf = (set) => set.filter((s) => s.entryDate === set[0].entryDate).length;
const after = at('2026-08-13');
check('day-0 entryDate tracks the clock across midnight',
  [shares[0].entryDate, after[0].entryDate], ['2026-08-12', '2026-08-13']);
check('the same members are still "today" after midnight',
  [todayCountOf(shares), todayCountOf(after)], [byDay[0], byDay[0]]);

// Month and year boundaries, where naive date math breaks.
check('crosses a month boundary backwards', at('2026-09-02').at(-1).entryDate, '2026-08-27');
check('crosses a year boundary backwards', at('2027-01-03').at(-1).entryDate, '2026-12-28');

// --- 4. §15 word gate: word-boundary AND raw substring ---
// The list is shared with check-copy-rules via scripts/forbidden-words.mjs —
// one rule, two subjects. This gate's subject is the demo fixture set; that
// gate's subject is the copy on real screens. Both arms below stay local:
// raw substring is affordable over nineteen strings we wrote ourselves and is
// red on four legal-page sentences the moment it meets real copy.
const FORBIDDEN = FORBIDDEN_WORDS;
// Everything that renders: the gratitude line and the display name.
const copy = shares.flatMap((s) => [s.content, s.author.display_name]);
check('every string in the set is checked', copy.length, shares.length * 2);

const wordHits = [];
const subHits = [];
for (const word of FORBIDDEN) {
  const boundary = new RegExp(`\\b${word}\\b`, 'i');
  for (const line of copy) {
    if (boundary.test(line)) wordHits.push(`${word} → "${line}"`);
    // Substring is the one that matters: `sin` hides inside ordinary words.
    if (line.toLowerCase().includes(word.toLowerCase())) subHits.push(`${word} → "${line}"`);
  }
}
check('no forbidden word (word boundary)', wordHits.join('; '), '');
check('no forbidden word (raw substring)', subHits.join('; '), '');

// --- 5. Shape parity with a real share, so FeedCard and toGridMember both work ---
const FEEDCARD_READS = ['entryDate', 'author', 'content', 'likeCount', 'likedByMe', 'commentCount', 'id'];
check('carries every field FeedCard reads', FEEDCARD_READS.filter((k) => !(k in shares[0])), []);
check('every id is unique', new Set(shares.map((s) => s.id)).size, shares.length);
check('every member is flagged isDemo', shares.every((s) => s.isDemo === true), true);
check('no demo member is isOwn', shares.every((s) => s.isOwn === false), true);
check('all counts zeroed',
  shares.every((s) => s.likeCount === 0 && s.commentCount === 0 && s.likedByMe === false), true);

// --- 6. Copy hygiene ---
const names = shares.map((s) => s.author.display_name);
check('names are unique', new Set(names).size, names.length);
check('no name longer than 5 chars (hex cell)', names.filter((n) => n.length > 5), []);
const lines = shares.map((s) => s.content);
check('gratitude lines are unique', new Set(lines).size, lines.length);
const lens = lines.map((l) => l.length);
console.log(`     line lengths: ${Math.min(...lens)}–${Math.max(...lens)} chars`);
// The nine originals ran 42–57. Staying inside that band means no new line
// can wrap where an existing one didn't.
check('no line longer than the longest original (57)', lines.filter((l) => l.length > 57), []);
check('every line ends in a period', lines.filter((l) => !l.endsWith('.')), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
