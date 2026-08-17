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
// The positions, and each one is here because something real occupies it:
//
//   JSXText              <Text>Pause.</Text>
//   JSX child expression <Text>{saved ? 'Saved' : 'Save'}</Text>
//   copy-bearing prop    placeholder="Today I was given…", accessibilityLabel
//   Alert.alert(...)     the confirm dialogs
//   src/constants/*      the prompt deck, the spark chips, the legal pages —
//                        authored prose that no screen file contains
//
// That last one is over-inclusive on purpose: it takes any prose-shaped string
// in `src/constants/`, which sweeps up a few things nobody reads. A false
// member of the copy set costs one re-read. A missing member costs the whole
// point of the gate. The over-inclusion is paid for in (2), not by narrowing
// the collector.
//
// (2) THE MATCHER IS PER-WORD, BECAUSE ONE RULE CANNOT FIT ALL TWELVE.
//
// Three matching rules, run over the 451 real copy strings at f0df9c2:
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

const TEXT_ATTRS = new Set([
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityRoleDescription',
  'title',
  'label',
]);

// A colour or a font token is not prose. Everything else prose-shaped in
// src/constants/ is taken.
const isProse = (v) => /\s/.test(v) && /[a-z]{2}/.test(v) && !/^(rgba?\(|#[0-9a-f]{3,8}\b)/i.test(v);

function collect(src, file) {
  const out = [];
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

  const push = (value, node, position) => {
    const v = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (v) out.push({ file, line: node.loc?.start.line, position, text: v });
  };

  // Every string literal reachable from a node without descending into a
  // nested JSX element — that element's own children get collected in their
  // own right, and taking them here would double-count them.
  const strings = (node) => {
    const acc = [];
    const rec = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(rec);
      if (!n.type) return;
      if (n.type === 'StringLiteral') return acc.push(n);
      if (n.type === 'TemplateLiteral') {
        n.quasis.forEach((q) => acc.push({ value: q.value.cooked, loc: q.loc }));
        return n.expressions.forEach(rec);
      }
      if (n.type === 'JSXElement' || n.type === 'JSXFragment') return;
      for (const k of Object.keys(n)) if (k !== 'loc') rec(n[k]);
    };
    rec(node);
    return acc;
  };

  // Hand-rolled walk: @babel/traverse is not installed in this tree, and
  // @babel/parser alone is (check-stat-scope's precedent).
  const seen = new Set();
  const walk = (node, inJsxChildren) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, inJsxChildren));
    if (!node.type) return;
    seen.add(node);

    if (node.type === 'JSXText') push(node.value, node, 'jsx-text');

    if (node.type === 'JSXAttribute' && TEXT_ATTRS.has(node.name?.name)) {
      const v = node.value;
      if (v?.type === 'StringLiteral') push(v.value, v, 'prop');
      if (v?.type === 'JSXExpressionContainer') {
        strings(v.expression).forEach((s) => push(s.value, s, 'prop'));
      }
    }

    if (node.type === 'JSXExpressionContainer' && inJsxChildren) {
      strings(node.expression).forEach((s) => push(s.value, s, 'jsx-expr'));
    }

    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.object?.name === 'Alert'
    ) {
      node.arguments.forEach((a) => strings(a).forEach((s) => push(s.value, s, 'alert')));
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key.endsWith('Comments')) continue;
      const isChildren =
        (node.type === 'JSXElement' || node.type === 'JSXFragment') && key === 'children';
      walk(node[key], isChildren);
    }
  };
  walk(ast.program, false);

  // Authored decks live in src/constants/ as plain literals with no JSX.
  if (path.dirname(file).endsWith(path.join('src', 'constants'))) {
    const rec = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(rec);
      if (n.type === 'StringLiteral' && isProse(n.value)) push(n.value, n, 'constant');
      for (const k of Object.keys(n)) if (k !== 'loc') rec(n[k]);
    };
    rec(ast.program);
  }

  return out;
}

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
for (const file of files) {
  const rel = path.relative(ROOT, file);
  try {
    copy.push(...collect(fs.readFileSync(file, 'utf8'), rel));
  } catch (e) {
    // Unreadable is not the same as passing (check-type-floor's rule).
    parseErrors.push(`${rel}: ${e.message}`);
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
// others — and the total would still look healthy.
for (const position of ['jsx-text', 'jsx-expr', 'prop', 'constant']) {
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
