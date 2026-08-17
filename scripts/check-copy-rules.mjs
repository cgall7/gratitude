// Colin's copy rules, enforced against the words a user actually reads.
//
//   npm run check:copy-rules
//
// WHY THIS FILE EXISTS
//
// Two gates already carried the forbidden-word list and neither one checked a
// screen.
//
//   1. `check-demo-hive.mjs` runs the list over `demoHiveShares` — nineteen
//      fabricated demo records. Its comment says "everything that renders";
//      what it means is everything IN THAT FIXTURE that renders, and the two
//      are a launch apart. That gate is right about its own subject (the demo
//      set is authored copy too) and is left alone; it now imports the list
//      from here instead of keeping a second copy of it.
//
//   2. An untracked script in one agent's scratch directory ran the list over
//      `Onboarding.js` by regex, invisible to `npm test`. It had been red
//      since it was written — on an IMPORT STATEMENT, `import { LockScreen }
//      from './CoreRitual'`, which its line-based predicate could not tell
//      apart from a rendered word. A gate that always says "1 failed" with a
//      written explanation beside it trains everyone to read past its output,
//      and the next real red arrives in a slot people have learned to skip.
//      That script is retired by this file.
//
// So the coverage was upside down: eighteen tracked gates covered type floors,
// RLS, streak math and nav depth, and the thing Colin reviews more than all of
// them combined — the actual sentences — was enforced on fake data.
//
// TWO DESIGN DECISIONS, BOTH MEASURED RATHER THAN ASSUMED.
//
// (1) THE ENUMERATION IS A PROPERTY OF POSITION, NOT OF PATH.
//
// The obvious scope is "the screens with authored copy", written out as a
// list. Measured against `src/` at f0df9c2, a position-based collector finds
// copy in 26 files, and 7 of them are not screens: `AccountDoor.js`,
// `SealCrack.js`, `ThemeCardFlip.js`, `IdeasAccordion.js`, `HoneycombGrid.js`,
// `FeedCard.js`, `DevVersionTag.js`. A hand-written list of screens misses
// every one, and misses them silently — the gate stays green because it never
// looked. So this walks all of `src/` and filters by POSITION: a string is
// copy if it reaches a user's eyes or a screen reader, wherever it lives.
//
// The five positions, and what each one holds, are documented at the walker:
// scripts/lib/rendered-strings.mjs. This gate asks for ALL of them, because
// its question — does a user read a forbidden word — is indifferent to which
// slot the word sits in. The demo-content gate asks the same walker for two
// of them, because its question is not.
//
// `constant` is over-inclusive on purpose: it takes any prose-shaped string
// in `src/constants/`, which sweeps up a few things nobody reads. A false
// member of the copy set costs one re-read. A missing member costs the whole
// point of the gate. The over-inclusion is paid for in (2), not by narrowing
// the collector.
//
// (2) THE MATCHER IS PER-WORD, BECAUSE ONE RULE CANNOT FIT ALL TWELVE.
//
// Three matching rules, run over the real copy strings — 451 at f0df9c2 with
// this gate's own collector, 446 at b5e7754 once it moved to the shared
// walker (five strings, all of them a double count or a sentence collected
// in halves; the walker header has both effects measured, and no string was
// lost). All three arms return the same hits over either corpus:
//
//   raw substring          4 hits, all false — "single", "Using",
//                          "advertising", "consequential" all contain `sin`
//   \bword\b (boundary)    0 hits — but it cannot see "praying", "blessings",
//                          "faithful", "churches", which are the register the
//                          ban is actually about
//   \bword  (prefix)       1 hit, false — "single"
//
// `check-demo-hive` asserts the RAW SUBSTRING arm, and is correct to: over
// nineteen hand-written fixtures the false-positive rate is zero and the arm
// is free. It does not transfer. Ported unchanged to real copy it is red on
// four legal-page sentences on day one, which is how a gate acquires an
// allowlist that grows forever.
//
// So each word carries its own pattern. Eleven of them are prefix-at-word-
// boundary, which catches inflections and cannot fire mid-word. `sin` is the
// one word short enough to be the start of ordinary English, so it is spelled
// out with its inflections instead. The patterns are not trusted on their
// face: section B runs each one over words it MUST catch and words it must
// NOT, so recall and precision are asserted, not assumed.
//
// WHAT THIS GATE CANNOT DO. It reads literals in the source. Copy assembled
// at runtime from parts, or arriving from the network, is invisible to it —
// and a `CANNOT TELL` must not look like a clean pass, so section A asserts
// the collector's own universe is non-empty in every position before section
// C reports zero hits over it. A collector that silently stopped working
// would otherwise report a perfectly green rule over nothing at all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { FORBIDDEN } from './forbidden-words.mjs';
import {
  POSITIONS,
  PositionVocabularyError,
  collectRenderedStrings,
} from './lib/rendered-strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}` +
      (ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)
  );
};

// --- A. Collect the copy -----------------------------------------------

// THE COLLECTOR LIVES IN scripts/lib/rendered-strings.mjs, and its POSITION
// VOCABULARY is declared there once and used twice: the walker refuses to
// emit a position that is not in POSITIONS, and section A below derives one
// control per member of it. Neither half is decoration.
//
// The first draft named the controls in a hand-written list of four, and the
// collector emitted five. Sage measured the gap (2026-08-17): disabling
// `alert` collection dropped 34 strings — 7.5% of the corpus — and every
// assertion stayed green, over the one position that holds
// 'Demo: onboarding flow'. A gate arguing that a CANNOT TELL must not look
// like a clean pass had a clean pass sitting exactly there.
//
// Adding `'alert'` to that list would have fixed the count and kept the
// shape: the sixth position added in November lands in the same hole. So the
// two sets are tied together instead. A position cannot exist without a
// control, and a control cannot exist without a position — one goes red
// either way. This is section A's own argument applied to section A.
//
// This gate asks for ALL of POSITIONS rather than a written-out list of
// five, so a position added at the walker arrives here already covered: the
// question "does a user read a forbidden word" is indifferent to which slot
// the word sits in, and that indifference is the reason it may spread its
// scope automatically where the demo gate may not.
const files = [];
(function walkDir(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (/\.jsx?$/.test(name)) files.push(p);
  }
})(SRC);

const copy = [];
const parseErrors = [];
const vocabularyErrors = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  // Two try blocks, not one, so each row's name stays true of everything it
  // reports. Unreadable is not the same as passing (check-type-floor's
  // rule); a walker whose classifier and vocabulary disagree is a third
  // thing again; and a bad argument at this call site is a defect in the
  // gate rather than in the tree, so it dies loudly instead of being filed
  // under either.
  let ast;
  try {
    ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    parseErrors.push(`${rel}: ${e.message}`);
    continue;
  }
  try {
    for (const s of collectRenderedStrings(ast, { file: rel, positions: POSITIONS })) {
      copy.push({ file: rel, line: s.line, position: s.position, text: s.value });
    }
  } catch (e) {
    if (!(e instanceof PositionVocabularyError)) throw e;
    vocabularyErrors.push(`${rel}: ${e.message}`);
  }
}

console.log(`\n--- A. the universe this gate is standing over ---`);
// The enumerator asserts its own count before anything loops over it: a rule
// reported green over zero strings is the failure this section exists to make
// impossible.
check('source files found under src/', files.length > 0, true);
check('every file parsed', parseErrors, []);
check('copy strings collected', copy.length > 0, true);

// Per-position, because the collector can lose one position and keep the
// others — and the total would still look healthy. Derived from POSITIONS,
// never hand-listed: see the note beside it for the 34 strings that walked
// out of a hand-listed version of this loop.
//
// The other direction of the same tie: the walker throws rather than
// filtering when its classifier emits a position POSITIONS does not
// declare, because an undeclared position is in nobody's requested set and
// would otherwise leave silently. This row reports that throw under its own
// name — a file that will not parse and a walker whose two halves disagree
// are different findings.
check('every position the collector emits is declared in POSITIONS', vocabularyErrors, []);
for (const position of POSITIONS) {
  check(
    `position "${position}" is represented in the collected set`,
    copy.some((c) => c.position === position),
    true
  );
}
// Files, not just strings: one screen contributing everything would pass the
// count above.
const filesWithCopy = new Set(copy.map((c) => c.file));
check('copy found in more than one file', filesWithCopy.size > 1, true);
console.log(
  `     ${copy.length} string(s) across ${filesWithCopy.size} file(s), ${files.length} scanned`
);

// --- B. The matcher, before it is trusted with a verdict ----------------
//
// A pattern list is a classifier, and a classifier is worth what its recall
// and precision are — not what its author intended. Both are asserted here on
// fixtures, so a tightened pattern that stops catching "praying" fails in this
// section rather than going quietly green in section C.
console.log(`\n--- B. the matcher's own recall and precision ---`);

const MUST_CATCH = {
  God: ['God', 'a gift from God', 'godly'],
  Jesus: ['Jesus', 'jesus'],
  Lord: ['the Lord', 'Lords'],
  pray: ['pray', 'praying', 'a prayer', 'prayers'],
  scripture: ['scripture', 'scriptural', 'Scriptures'],
  church: ['church', 'churches'],
  faith: ['faith', 'faithful', 'faithfully'],
  blessed: ['blessed', 'blessing', 'blessings', 'bless'],
  worship: ['worship', 'worshipping'],
  sin: ['sin', 'sins', 'sinful', 'a sinner'],
  hallelujah: ['hallelujah', 'Hallelujah!'],
  ritual: ['ritual', 'rituals', 'your daily ritual'],
};

// Real sentences, drawn from copy that ships. Every one of these is a string
// a naive matcher flags: the four `sin` lines are the exact false positives
// the raw-substring arm produces on src/constants/legalCopy.js today.
const MUST_NOT_CATCH = [
  'a single line a day',
  'since you started',
  'Using the app',
  'We do not show advertising.',
  'indirect or consequential loss',
  'sincerely yours',
  'It sends the entry and nothing else.',
  'good morning',
  'a good day',
  'This is the whole thing.',
];

check('every forbidden word has a pattern', FORBIDDEN.length, 12);
check(
  'every pattern has recall fixtures',
  FORBIDDEN.filter((f) => !MUST_CATCH[f.word]?.length).map((f) => f.word),
  []
);

const missedRecall = [];
for (const { word, re } of FORBIDDEN) {
  for (const sample of MUST_CATCH[word] || []) if (!re.test(sample)) missedRecall.push(`${word} misses ${JSON.stringify(sample)}`);
}
check('every pattern catches its own inflections', missedRecall, []);

const falseFires = [];
for (const { word, re } of FORBIDDEN) {
  for (const sample of MUST_NOT_CATCH) if (re.test(sample)) falseFires.push(`${word} fires on ${JSON.stringify(sample)}`);
}
check('no pattern fires on ordinary English', falseFires, []);

// The claim that justifies the per-word design. If a future edit makes the
// patterns raw substrings again, this row goes red and names the reason.
const rawSubstringFires = MUST_NOT_CATCH.filter((s) =>
  FORBIDDEN.some((f) => s.toLowerCase().includes(f.word.toLowerCase()))
);
check(
  'raw substring matching would fire on ordinary English (why the patterns are per-word)',
  rawSubstringFires.length > 0,
  true
);

// --- C. The rule -------------------------------------------------------
console.log(`\n--- C. no forbidden word in copy a user reads ---`);
const hits = [];
for (const { word, re } of FORBIDDEN) {
  for (const c of copy) if (re.test(c.text)) hits.push(`${word} → ${c.file}:${c.line} [${c.position}] ${JSON.stringify(c.text.slice(0, 90))}`);
}
check('no forbidden word in rendered copy', hits, []);

// An import path is not a string in text position, so `import { LockScreen }
// from './CoreRitual'` is outside the collected set BY CONSTRUCTION rather
// than by an allowlist that has to grow every time someone imports that
// module somewhere new. This asserts the construction, so a future collector
// that starts scanning source lines fails here and not by going red on an
// import three months later.
const importPaths = copy.filter((c) => /^\.{1,2}\//.test(c.text));
check('no import path is in the copy set', importPaths, []);

// --- D. Copy frozen by a ruling is still on screen ----------------------
//
// The other half of a copy gate: a forbidden word must not appear, and a
// ruled line must not quietly disappear. These four are frozen — R15's thesis
// and its bookend, and §27's two opening screens (merged 51fb6e7). A rewrite
// of any of them is a ruling, so it should cost a deliberate edit here.
console.log(`\n--- D. copy frozen by a ruling ---`);
const FROZEN = [
  ['R15 thesis on Welcome', 'Start with what you were given.'],
  ['R15 entry placeholder', 'Today I was given…'],
  ['§27.2 Welcome subhead', "One line a day. That's how it starts."],
  ['§27.1 write gate', 'Think of someone.'],
];
const texts = new Set(copy.map((c) => c.text));
for (const [label, line] of FROZEN) check(`${label} is still rendered`, texts.has(line), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
