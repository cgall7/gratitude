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
  TEXT_ATTRS,
  collectRenderedStrings,
  walkWithAncestry,
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
// App.js IS IN THE UNIVERSE, and it wasn't. This gate walked src/ only while
// check-demo-content-callsites walked `App.js + src/**` — two gates over the
// same tree disagreeing about what the tree IS, which is the divergence one
// shared walker was supposed to end. It holds exactly one prose string
// (`gratitudeText="I am grateful for this beautiful day."`, App.js:220, a
// hardcoded line handed to the Evening route) and that string was outside
// this gate for a reason TEXT_ATTRS could not fix: adding the attribute name
// recovers nothing in a file nobody reads. Two holes, one symptom.
const files = [];
(function walkDir(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (/\.jsx?$/.test(name)) files.push(p);
  }
})(SRC);
files.push(path.join(ROOT, 'App.js'));
files.sort();

const copy = [];
const parsed = [];
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
  parsed.push({ rel, ast });
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
// Named, because the file universe is otherwise unpinned and reverting it is
// a one-line edit no other row observes — the same shape as the vocabulary
// pin below, one layer out. This gate and check-demo-content-callsites must
// stand over the same tree; if App.js is ever legitimately dropped, delete
// this row in the same commit (SELF-DELETING CONTROL, the demo gate's
// convention).
check('App.js is in the file universe (both gates read the same tree)', files.some((f) => path.basename(f) === 'App.js'), true);
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
// THE MINUEND. The row above ties the classifier to the vocabulary; this
// one pins the vocabulary itself, and it is the only assertion in either
// gate that POSITIONS is not free to shrink. Everything else here is
// DERIVED from POSITIONS — the loop below, and the demo gate's
// `POSITIONS.filter(…)` — so deleting a member from both the list and the
// classifier is a coherent edit that leaves every derived control agreeing
// with itself over a smaller universe. Measured by Sage at 257aa2f:
// deleting `jsx-expr` takes 75 strings out of each gate, 33% of rule 1's,
// and both gates exit 0.
//
// It lives HERE rather than beside the demo gate's exclusion pin because
// only this gate's universe IS the whole vocabulary. That pin reads
// `RULE_1_OUT_OF_SCOPE`, which is a literal and does not move when
// POSITIONS does, so a pin on rule 1's own scope would cover the three
// positions it includes and be blind to the two it excludes — deleting
// `alert` would still cost this corpus 34 strings in silence.
//
// A tripwire, not a proof: no behavioural control can catch a scope that
// narrows itself, since narrowing removes the very rows that would object.
// Shrinking this list is legitimate — it just has to be typed here, next
// to what it costs.
//
// Sorted on both sides, because the property is MEMBERSHIP and POSITIONS'
// order carries no meaning: the walker's header lists the five in reading
// order, and a gate that reds when someone reorders a comment-matching
// list is red-on-correct-code with no defect behind it. `POSITIONS
// reordered` is a should-pass mutation on this branch and stays one.
check(
  'the position vocabulary is exactly the five (shrinking it shrinks every derived control — deliberate edit here)',
  [...POSITIONS].sort(),
  ['jsx-text', 'jsx-expr', 'prop', 'alert', 'constant'].sort()
);
for (const position of POSITIONS) {
  check(
    `position "${position}" is represented in the collected set`,
    copy.some((c) => c.position === position),
    true
  );
}

// --- A2. TEXT_ATTRS is a partition, not a list -------------------------
//
// The `prop` position is decided by a NAMED LIST in the walker, and a named
// list has a list's hole: `title` was on it and `eyebrow` was not, so
// ScreenHeader.js rendered one collected string and one invisible one from
// the same call site through the same <Text>. Twenty-one strings were
// outside both gates that way, including LoadState's entire error-state
// surface on all three screens that carry it (Sage, thread 4510c5c8).
//
// Adding the names fixes today. This section is what stops it recurring:
// every attribute name in the tree that carries a string literal must be
// CLASSIFIED — copy (walker's TEXT_ATTRS) or not-copy (below) — and an
// unclassified name reds. A new copy-bearing prop can then ship only after
// somebody has written down which half it is in.
//
// TWO NETS, AND NEITHER IS THE OTHER'S FLOOR, because they fail in
// different directions:
//
//   NAME-level (row 1) catches a NEW attribute. It is the stronger net
//   because it does not read the string at all — which is what makes it
//   see `staleActionLabel="Refresh"`. A prose heuristic cannot: nothing
//   syntactic separates "Refresh" from "contain", "round" or "handled".
//   Sage's sweep, filtered on prose shape, reported 17 strings and named
//   six props; the same sweep run at NAME level reports 21 and seven, and
//   the missing name is exactly the one whose values are single words.
//   A HEURISTIC OVER VALUES CANNOT ENUMERATE A CLASS DEFINED BY ROLE.
//
//   VALUE-level (row 2) catches an OLD attribute that starts carrying copy
//   — `tone="danger"` today, `tone="Something went wrong"` in November.
//   Name-level is blind to that by construction, since the name is already
//   classified. This is the direction an exemption list usually leaks in.
//
// Read against TEXT_ATTRS itself rather than a second copy of the names:
// a gate matching a typed list proves a property of the list.
const NOT_COPY_ATTRS = new Set([
  // RN / component API enums and identifiers
  'accessibilityRole', 'autoCapitalize', 'icon', 'importantForAccessibility',
  'key', 'keyboardShouldPersistTaps', 'keyboardType', 'mode', 'name',
  'pointerEvents', 'preset', 'resizeMode', 'returnKeyType', 'size', 'stage',
  'tint', 'tone',
  // SVG geometry and paint
  'cx', 'cy', 'fill', 'fillRule', 'height', 'offset', 'patternTransform',
  'patternUnits', 'preserveAspectRatio', 'r', 'stopOpacity', 'strokeLinecap',
  'viewBox', 'width', 'x', 'x1', 'x2', 'y', 'y1', 'y2',
]);

// The three attributes that are prose-SHAPED and still not copy. Named, so
// row 2 does not have to guess, and small enough that the exemption is
// reviewable rather than a door: SVG geometry is whitespace-separated
// numbers by grammar, not by authorship.
const GEOMETRY_ATTRS = ['preserveAspectRatio', 'viewBox'];

// Deliberately weak — see the two-nets note. It only has to be true of
// authored sentences, because a single-word copy value is row 1's job.
const looksLikeProse = (s) => /\s/.test(s) || /[.?!…]$/.test(s);

const attrStrings = [];
for (const { rel, ast } of parsed) {
  walkWithAncestry(ast.program, (node) => {
    if (node.type !== 'JSXAttribute' || typeof node.name?.name !== 'string') return;
    const v = node.value;
    const lit =
      v?.type === 'StringLiteral' ? v
      : v?.type === 'JSXExpressionContainer' && v.expression?.type === 'StringLiteral' ? v.expression
      : null;
    if (!lit) return;
    attrStrings.push({ rel, line: node.loc?.start.line, name: node.name.name, value: lit.value });
  });
}

console.log(`\n--- A2. every attribute name carrying a string is classified ---`);
// Universe control first, per the runner's requirement: a sweep that found
// nothing would satisfy both rows below by being empty.
check('JSX attributes carrying string literals were found', attrStrings.length > 0, true);
check(
  'every attribute name carrying a string literal is classified as copy or not-copy',
  [...new Set(
    attrStrings
      .filter((a) => !TEXT_ATTRS.has(a.name) && !NOT_COPY_ATTRS.has(a.name))
      .map((a) => `${a.rel}:${a.line} ${a.name}="${a.value}"`)
  )].sort(),
  []
);
check(
  'no attribute classified not-copy carries a prose-shaped string (except SVG geometry)',
  attrStrings
    .filter((a) => NOT_COPY_ATTRS.has(a.name) && !GEOMETRY_ATTRS.includes(a.name) && looksLikeProse(a.value))
    .map((a) => `${a.rel}:${a.line} ${a.name}="${a.value}"`)
    .sort(),
  []
);
check(
  'the prose-shaped not-copy exemption is exactly SVG geometry',
  [...GEOMETRY_ATTRS].sort(),
  ['preserveAspectRatio', 'viewBox'].sort()
);
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
