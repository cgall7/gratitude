// Gate for R68 — A STAT'S COMPUTED SET MUST MATCH THE SCOPE ITS SURFACE STATES.
//
//   npm run check:stat-scope
//
// WHY THIS EXISTS, AND WHY IT IS NOT A PROPERTY TEST ON `currentStreak`.
//
// `TodayTab` shipped `currentStreak(yearEntries)` while `RecapTab` shipped
// `currentStreak(allEntries)`, so on January 3rd the same badge in the same
// corner of two tabs read 3 and 40. The gate written for it asserted a relation
// between two calls to `currentStreak` — and it was 15 passed / 0 failed in a
// tree with the defect checked in three directories away. Sage's general form:
//
//   A GATE ASSERTS A PROPERTY OF WHATEVER IT CAN IMPORT, AND THE BUG LIVES AT
//   THE CALL SITE IT COULDN'T.
//
// `TodayTab.js` is React Native + JSX, so plain Node cannot `import` it. Both
// earlier attempts fell back to substring matching. That was never the only
// option: @babel/parser is a real dependency of this repo and parses JSX fine.
// "Can't import" is not "can't inspect." So this reads each screen's AST and
// resolves the first argument of every streak call back to where the set came
// from — through `const` bindings, `Promise.all` array destructuring, `useState`
// setters, and one function-parameter hop.
//
// WHY THE RULE IS NOT "STREAK STATS READ THE UNFILTERED SET".
//
// Because that is false. `PollinateWrapped` computes a year-scoped
// `longestStreak` and is correct to: it is an annual retrospective and says so.
// A blanket predicate would have gone red on a working screen and the repair
// would have been to break it. The rule is agreement, not a preferred scope:
//
//   THE SCOPE OF A STAT IS WHATEVER THE SURFACE SAYS IT IS.
//
// So the table below carries both halves per row — the set the code reads, and
// the words the user reads — and a reason for the pairing. Neither half is
// inferred; both are asserted, and they must agree.
//
// WHY EVERY ROW IS PINNED TO AN EXACT LABEL.
//
// A scope-bearing label is load-bearing text. `Longest Streak` and
// `Longest Streak, 2026` are the same number under two different claims, and
// only one of them is true. Pinning the literal means a label edit turns this
// gate red until someone re-reads the row and confirms the computation still
// agrees. That is the point, not a maintenance cost — and it is one line.
//
// WHAT THIS DELIBERATELY DOES NOT PROVE.
//
//   1. That the pinned label renders *next to* that number. It proves the string
//      is a live string literal in the file (comments are excluded — the check
//      runs over AST nodes, not text). Associating a rendered value with its
//      rendered label across a component boundary needs a renderer this repo
//      does not have, and a resolver that guesses wrong would fail SILENTLY,
//      which is the failure this gate exists to end.
//   2. That a *bare* label is wrong. `IN A ROW` states no scope at all and is
//      correct on Today (one streak on screen) and wrong on Recap (two streaks
//      side by side). That distinction is context, not text.
//   3. Anything about `total` / `THIS YEAR`. It is derived by `.filter().length`
//      with no named function call, so there is no stable AST anchor to pin a
//      row to. Named here so its absence is a decision and not an oversight.
//
// The one thing it cannot do is pass by accident: an unresolvable argument is a
// FAILURE, never a skip, and an uncovered call site is a FAILURE. See §5.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const STREAK_FNS = new Set(['currentStreak', 'longestStreak']);
// Where the streak functions are defined. Excluded from the consumer scan by
// path: the definitions are not call sites, and a row about them would be a
// property test on the function — the exact thing that went 15/0 green over a
// checked-in defect.
const DEFS = 'src/utils/dateRanges.js';

// ---------------------------------------------------------------------------
// THE TABLE. One row per streak call site in `src/`. A row states the set the
// code must read, the words the surface must show, and why that pairing is the
// honest one. A fifth consumer fails §5 until it states its own scope here —
// it does not get to inherit one of these silently.
// ---------------------------------------------------------------------------
const TABLE = [
  {
    file: 'src/screens/TodayTab.js',
    fn: 'currentStreak',
    set: 'ALL-TIME',
    label: 'DAY STREAK',
    why:
      'Today\'s card claims no window — "DAY STREAK", present tense, one streak ' +
      'on the screen. A year-scoped run therefore reset to 1 on January 1st ' +
      'mid-streak while Recap\'s badge still read 40, and the milestone burst ' +
      're-fired at 3/7/14/30 for days already earned.',
  },
  {
    file: 'src/screens/RecapTab.js',
    fn: 'currentStreak',
    set: 'ALL-TIME',
    label: 'CURRENT',
    why:
      '"CURRENT" names a moment, not a window. It sits beside BEST EVER, which ' +
      'is all-time; a year-scoped current streak under it would make the left ' +
      'column silently narrower than its neighbour with nothing saying so.',
  },
  {
    file: 'src/screens/RecapTab.js',
    fn: 'longestStreak',
    set: 'ALL-TIME',
    label: 'BEST EVER',
    why:
      '"EVER" is the widest claim the app makes. This is the row that was fixed ' +
      'first — a record set in December vanished on New Year\'s Day — and the ' +
      'comment above the call site records it.',
  },
  {
    file: 'src/screens/PollinateWrapped.js',
    fn: 'longestStreak',
    set: 'YEAR-SCOPED',
    // Pinned to the FIXED label, which lands with
    // `deezine/wrapped-streak-scope-label@170bce3`. Until that merges this row
    // is red on `Longest Streak` — correctly, because that bare label is the
    // live defect, not a stale table entry.
    label: 'Longest Streak, ${year}',
    why:
      'Wrapped is an annual retrospective, so year-scoping is correct here and ' +
      'a blanket "read the unfiltered set" rule would have broken it. But the ' +
      'year frame lives on slide 1 and Wrapped renders one slide at a time, so ' +
      'the words supplying the scope were off-screen at the moment of the claim ' +
      'while Recap showed a different number under BEST EVER. The scope has to ' +
      'travel with the number, which is why the year is pinned into this label.',
  },
];

// ---------------------------------------------------------------------------
let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  FAIL ${label}`);
  if (detail) console.log(`         ${detail}`);
};
const eq = (label, actual, expected) =>
  actual === expected ? ok(label) : bad(label, `expected ${expected}, got ${actual}`);

// ---------------------------------------------------------------------------
// AST plumbing.
// ---------------------------------------------------------------------------
const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((child) => walk(child, fn));
  if (typeof node.type === 'string') fn(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    walk(node[key], fn);
  }
};

// The scan set is DISCOVERED, not listed. A hardcoded file list has exactly the
// hole this gate exists to close: the prototype enumerated call sites inside
// three known files, so Sage's fifth consumer in a fourth file produced no row
// at all — the gate could not see the one thing it was built to catch.
//
// TypeScript is IN the scan set, and that is not hypothetical tidiness:
// `src/services/NativeLockInterface.ts` is already here and `tsconfig.json`
// extends `expo/tsconfig.base`, so a screen may be written in `.ts`/`.tsx` any
// day. A scan matching `/\.jsx?$/` would produce no row for a consumer written
// in one — the same blindness as a hardcoded file list, one file extension
// over, and it would report "every streak call is declared" while saying it.
const SOURCE_EXT = /\.(jsx?|tsx?)$/;
const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && SOURCE_EXT.test(full) ? [full] : [];
  });

const scanSet = () => {
  const out = sourceFiles(SRC);
  // App.js is a screen host, not a screen, but nothing stops a stat living in
  // it — and it is outside src/, so a scan rooted only at src/ would miss it.
  for (const entry of ['App.js', 'App.jsx', 'App.tsx', 'App.ts']) {
    const full = path.join(ROOT, entry);
    if (fs.existsSync(full)) out.push(full);
  }
  return out;
};

// `.ts` is parsed WITHOUT the jsx plugin on purpose: in a plain `.ts` file
// `<Foo>bar` is a type assertion, and enabling jsx there makes valid TypeScript
// a syntax error. `.tsx` gets both, which is why the two spellings differ.
const pluginsFor = (rel) =>
  rel.endsWith('.ts') ? ['typescript']
  : rel.endsWith('.tsx') ? ['jsx', 'typescript']
  : ['jsx'];

const parseFailures = [];
const parsed = new Map();
const load = (rel) => {
  if (!parsed.has(rel)) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let ast = null;
    try {
      ast = parse(code, { sourceType: 'module', plugins: pluginsFor(rel) });
    } catch (err) {
      // A file this gate cannot read is a file it cannot clear. Record it and
      // fail in §0 — never let an unparsed file drop out of the scan quietly,
      // because a silent drop reads exactly like "no streak call in here."
      parseFailures.push(`${rel} — ${err.message}`);
    }
    parsed.set(rel, { code, ast });
  }
  return parsed.get(rel);
};

const text = (code, node) => code.slice(node.start, node.end);
const lineOf = (code, node) => code.slice(0, node.start).split('\n').length;

// CLASSIFY THE PRODUCER — never "does the text mention a year".
//
// The obvious spelling is `/startOfYear|endOfYear/.test(init) ? YEAR : ALL-TIME`,
// and it defaults to ALL-TIME on ignorance. Move the windowing behind a helper
// in another module — `currentStreak(await loadStreakEntries())` — and that
// version prints a confident ALL-TIME over a year-scoped read. A gate that
// answers when it doesn't know is worse than one that can't see the file at
// all, because the row still reads `ok`.
//
// So: two known producers, and everything else is UNKNOWN, and UNKNOWN is a
// failure. `EntryStore` has exactly two set-returning methods; a third one is a
// change to this table, which is the point.
//
// The argument list is read by BALANCED-PAREN SCAN, not by a regex. A regex has
// to guess how deep the nesting goes: `getEntriesBetween(startOfYear(now), …)`
// is one level, `getEntriesBetween(startOfYear(new Date()), …)` is two, and the
// pattern that handles one silently declines on the other. That decline is safe
// — it lands in `null`, which fails — but it fails a CORRECT year window with
// the words "not a producer this gate can name", which sends the reader after
// the wrong bug. Counting parens has no depth to get wrong.
const argsOf = (text, fnName) => {
  const at = text.search(new RegExp(`\\b${fnName}\\s*\\(`));
  if (at < 0) return null;
  const open = text.indexOf('(', at);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null; // unbalanced — truncated source, or a paren inside a string
};

const classifySet = (init) => {
  if (/\bgetAllEntries\s*\(\s*\)/.test(init)) return 'ALL-TIME';
  if (/\bgetEntriesBetween\s*\(/.test(init)) {
    const args = argsOf(init, 'getEntriesBetween');
    if (args === null) return null;
    if (/startOfYear/.test(args) && /endOfYear/.test(args)) return 'YEAR-SCOPED';
    return null; // a window this gate has no name for — say so, don't guess
  }
  // The in-file year window. Both tabs derive `THIS YEAR` this way rather than
  // with a second store read, so it is a real producer and not a hypothetical:
  // re-pointing a streak at `thisYear` is a one-word edit inside a JSX prop.
  if (/\.filter\([\s\S]{0,120}?startsWith\(\s*currentYear/.test(init)) return 'YEAR-SCOPED';
  return null;
};
// A label states a year if it carries one — a literal year, an interpolated
// `year`, or the words "this year".
const YEAR_WORDS = /\b(?:19|20)\d{2}\b|\$\{[^}]*\byear\b[^}]*\}|\bthis year\b/i;

// Every string a file actually renders, reconstructed from AST nodes so that a
// label surviving only inside a comment cannot satisfy §3.
const literalsIn = (rel) => {
  const { code, ast } = load(rel);
  const out = new Set();
  if (!ast) return out;
  walk(ast.program, (n) => {
    if (n.type === 'StringLiteral') out.add(n.value);
    // Labels written as JSX children — `<Text>IN A ROW</Text>` — are JSXText,
    // not StringLiteral. Recap keeps its labels in an object literal and Today
    // writes them inline, and a check that only saw one of those spellings
    // would report a live label missing.
    if (n.type === 'JSXText' && n.value.trim()) out.add(n.value.trim());
    if (n.type === 'TemplateLiteral') {
      out.add(
        n.quasis
          .map((q, i) => q.value.cooked + (n.expressions[i] ? '${' + text(code, n.expressions[i]) + '}' : ''))
          .join('')
      );
    }
  });
  return out;
};

// Resolve the first argument of a streak call back to the expression that
// produced the set. Returns { init, via } or { unresolved: <reason> }.
const resolveArg = (rel, call) => {
  const { code, ast } = load(rel);
  if (!ast) return { unresolved: `${rel} did not parse` };
  const bindings = new Map();
  const params = new Map();

  walk(ast.program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init) return;
    if (n.id.type === 'Identifier') {
      bindings.set(n.id.name, text(code, n.init));
      if (n.init.type === 'ArrowFunctionExpression' || n.init.type === 'FunctionExpression') {
        n.init.params.forEach((p, i) => {
          if (p.type === 'Identifier') params.set(p.name, { fnName: n.id.name, index: i });
        });
      }
    }
    if (n.id.type === 'ArrayPattern') {
      // `const [a, b] = await Promise.all([x, y])` — take the matching element,
      // not the whole call, or every destructured name resolves identically.
      const inner = n.init.type === 'AwaitExpression' ? n.init.argument : n.init;
      const elements =
        inner.type === 'CallExpression' && inner.arguments[0]?.type === 'ArrayExpression'
          ? inner.arguments[0].elements
          : null;
      n.id.elements.forEach((el, i) => {
        if (el?.type === 'Identifier') {
          bindings.set(el.name, elements?.[i] ? text(code, elements[i]) : text(code, n.init));
        }
      });
    }
  });

  const arg = call.arguments[0];
  if (!arg) return { unresolved: 'called with no arguments' };
  // Written inline — `currentStreak(await EntryStore.getEntriesBetween(…))`.
  // There is no binding to follow, but there is nothing to follow it TO: the
  // producer is right there. Classify it directly rather than declining. Sage's
  // probe at 626a66b is this shape, and it is the shape the EntryStore ->
  // Supabase rewrite makes likely, because an unbounded `getAllEntries()` over
  // the network is exactly the pressure that moves a query to the call site.
  if (arg.type !== 'Identifier') {
    const inline = text(code, arg).replace(/\s+/g, ' ');
    if (classifySet(inline) === null) {
      return { unresolved: `first argument is \`${inline.slice(0, 96)}\` — not a plain identifier, and not a producer this gate can name` };
    }
    return { init: inline, via: ' (inline at the call site)' };
  }

  let via = '';
  let init = bindings.get(arg.name);

  // A parameter carries no set of its own — hop out to the call site.
  if (init === undefined && params.has(arg.name)) {
    const { fnName, index } = params.get(arg.name);
    let outer = null;
    walk(ast.program, (c) => {
      if (c.type === 'CallExpression' && c.callee.type === 'Identifier' && c.callee.name === fnName) {
        outer = c.arguments[index];
      }
    });
    if (!outer) return { unresolved: `\`${arg.name}\` is a parameter of ${fnName}() and no call to it was found` };
    via = ` (param ${index} of ${fnName}(), passed \`${text(code, outer)}\`)`;
    init = outer.type === 'Identifier' ? bindings.get(outer.name) ?? text(code, outer) : text(code, outer);
  }

  if (init === undefined) return { unresolved: `cannot resolve \`${arg.name}\`` };

  // A `useState` seed says nothing about what the screen PUTS in the state.
  // Reading it gave the right answer for the wrong reason once already; resolve
  // through the setter instead.
  if (/^useState\s*\(/.test(init.trim())) {
    const setter = `set${arg.name[0].toUpperCase()}${arg.name.slice(1)}`;
    let assigned = null;
    walk(ast.program, (c) => {
      if (c.type === 'CallExpression' && c.callee.type === 'Identifier' && c.callee.name === setter) {
        assigned = c.arguments[0];
      }
    });
    if (!assigned) return { unresolved: `\`${arg.name}\` is state and no ${setter}() call was found` };
    via += ` (state, via ${setter}())`;
    init = assigned.type === 'Identifier' ? bindings.get(assigned.name) ?? text(code, assigned) : text(code, assigned);
  }

  return { init: init.replace(/\s+/g, ' '), via };
};

// ---------------------------------------------------------------------------
// Find every streak call in src/, once, and index it by file + function.
// ---------------------------------------------------------------------------
// Detect by IMPORT, not by call-site spelling. `import { longestStreak as best }`
// renames the callee, and a completeness check that matches only the canonical
// name has precisely the hole it exists to close. Sage found this in their own
// first draft; the probe at 2c98af0 is the aliased shape.
//
// KEY OFF THE NAME IMPORTED, NEVER THE PATH IT CAME FROM.
//
// The first version of this gated the whole thing on `/dateRanges$/` against the
// import source — and `'../utils/dateRanges.js'` does not end in `dateRanges`.
// Every import in the repo is extensionless today, so it was green; write the
// same aliased fifth consumer with the extension on and the gate reported 4 call
// sites and 22 passed over it. A spelling of a path standing in for "is this the
// streak function", which is the substitution this whole gate exists to refuse.
//
// So the source is not consulted. `longestStreak` imported under any name from
// any module IS the streak function — there is one of each in this repo, and
// §0's re-export assertion below is what keeps that true. A second module
// exporting the name would produce a false row, which fails loudly and is
// fixable; the path check produced a silent miss, which is neither.
const aliasesIn = (rel) => {
  const { ast } = load(rel);
  const local = new Map(); // local name -> canonical name
  if (!ast) return local;
  walk(ast.program, (n) => {
    if (n.type !== 'ImportDeclaration') return;
    for (const sp of n.specifiers) {
      if (sp.type === 'ImportSpecifier' && STREAK_FNS.has(sp.imported.name)) {
        local.set(sp.local.name, sp.imported.name);
      }
      // `import * as D from './dateRanges'` — the member spelling survives, so
      // `D.currentStreak(...)` is still matched below by property name.
    }
  });
  return local;
};

// The one route an alias can take that the import scan above cannot model: a
// name that arrives already renamed, from a module that is not where the
// function lives. `export { longestStreak as best } from '../utils/dateRanges'`
// in `src/utils/index.js`, then `import { best } from '../utils'`, and the local
// name matches nothing — the specifier says `best`, not `longestStreak`.
//
// This is not hypothetical tidiness: `LoadState.js:38` and `SeedsStore.js:54`
// both re-export utils this way today, so it is an established habit in the
// repo, one module over.
//
// The gate cannot follow the chain, so it asserts the precondition instead: no
// module re-exports a streak function, and nothing does `export *` at all (an
// `export *` re-exports names that cannot be enumerated statically, so it is
// opaque to the alias scan by construction). Both are zero on this tree. The
// day either stops being zero, this goes red and someone teaches the gate the
// route rather than discovering it in January.
// Two arms, two assertions, because they fail for different reasons and a
// conjunction reported under one headline names the wrong half half the time.
// This thread has produced that exact defect three times in one 40-line block.
const namedReexports = [];
const starExports = [];
for (const abs of scanSet()) {
  const rel = path.relative(ROOT, abs);
  if (rel === DEFS) continue;
  const { code, ast } = load(rel);
  if (!ast) continue;
  walk(ast.program, (n) => {
    if (n.type === 'ExportAllDeclaration') {
      starExports.push(`${rel}:${lineOf(code, n)} — \`export * from '${n.source.value}'\``);
    }
    if (n.type === 'ExportNamedDeclaration' && n.source) {
      for (const sp of n.specifiers) {
        if (sp.type === 'ExportSpecifier' && STREAK_FNS.has(sp.local.name)) {
          namedReexports.push(`${rel}:${lineOf(code, n)} — re-exports ${sp.local.name} as \`${sp.exported.name}\``);
        }
      }
    }
  });
}

const found = [];
for (const abs of scanSet()) {
  const rel = path.relative(ROOT, abs);
  if (rel === DEFS) continue;
  const { code, ast } = load(rel);
  if (!ast) continue;
  const alias = aliasesIn(rel);
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression') return;
    const callee = n.callee;
    const spelled =
      callee.type === 'Identifier' ? callee.name
      : callee.type === 'MemberExpression' && callee.property.type === 'Identifier' ? callee.property.name
      : null;
    if (!spelled) return;
    // An alias resolves to its canonical name; a bare canonical spelling still
    // counts even without a matching import, so this can only widen coverage.
    const fn = alias.get(spelled) ?? (STREAK_FNS.has(spelled) ? spelled : null);
    if (!fn) return;
    found.push({ rel, fn, spelled, line: lineOf(code, n), node: n, src: text(code, n) });
  });
}

// ---------------------------------------------------------------------------
// §0 — THE SCAN REACHED A REAL TREE.
//
// Everything below is quantified over `found`, and every quantifier over an
// empty set is true. Point this at the wrong root, or let a future refactor
// move the screens out of `src/`, and §5 reports "no streak call escapes the
// table" over nothing at all. Bumble hit exactly this in the RLS gate today —
// zero tables enumerated, and "every table has RLS enabled" asserting nothing.
// A gate's own reach is the first thing it should assert, not the last.
// ---------------------------------------------------------------------------
console.log('\n§0  the scan reached a real tree\n');

const scanned = scanSet();
if (scanned.length === 0) bad('§0 the scan set is non-empty', `no source files under ${SRC}`);
else {
  const byExt = scanned.reduce((acc, f) => {
    const ext = path.extname(f);
    acc[ext] = (acc[ext] ?? 0) + 1;
    return acc;
  }, {});
  ok(`§0 scanned ${scanned.length} files under src/ + App.* (${Object.entries(byExt).map(([e, n]) => `${n}${e}`).join(', ')})`);
}

// A file that failed to parse is a file that produced no call sites, which is
// indistinguishable in §5's output from a file that genuinely has none.
if (parseFailures.length === 0) ok(`§0 every scanned file parsed`);
else bad('§0 every scanned file parsed', `${parseFailures.length} did not, so §5 cannot speak for them:\n         ${parseFailures.join('\n         ')}`);

// The definitions file is the anchor the whole table hangs off. If it moved,
// every alias lookup below silently stops matching and coverage goes quiet.
if (fs.existsSync(path.join(ROOT, DEFS))) ok(`§0 ${DEFS} is where the streak functions are declared to live`);
else bad(`§0 ${DEFS} exists`, 'the streak definitions moved; alias detection keys off this path and is now blind');

if (namedReexports.length === 0) ok('§0 no module re-exports a streak function under another name');
else
  bad(
    '§0 no module re-exports a streak function under another name',
    'a consumer importing the re-exported name is invisible to the alias scan — the specifier says the new name, not the streak function\'s:\n         ' +
      namedReexports.join('\n         ')
  );

if (starExports.length === 0) ok('§0 nothing in the scan set does `export *`');
else
  bad(
    '§0 nothing in the scan set does `export *`',
    '`export *` re-exports names that cannot be enumerated statically, so any streak function travelling through one is opaque to the alias scan:\n         ' +
      starExports.join('\n         ')
  );

if (found.length === 0) bad('§0 at least one streak call site exists', 'found none — a gate over an empty set passes by asserting nothing');
else ok(`§0 ${found.length} streak call site(s) found to check`);

console.log('\n§1-§4  every declared stat: the set it reads, the words it shows\n');

for (const row of TABLE) {
  const matches = found.filter((c) => c.rel === row.file && c.fn === row.fn);
  const id = `${row.file} ${row.fn}()`;

  // §1 — the row points at exactly one call. Two calls to the same function in
  // one file means the row is ambiguous about which one it is describing.
  if (matches.length !== 1) {
    bad(`§1 ${id} — exactly one call site`, `found ${matches.length}; the table row cannot say which`);
    continue;
  }
  ok(`§1 ${id}:${matches[0].line} — one call site`);

  // §2 — the set. Resolved from the AST, never from a spelling.
  const resolved = resolveArg(row.file, matches[0].node);
  if (resolved.unresolved) {
    // Not a skip. An argument this gate cannot follow is an argument nobody
    // reviewing a diff can follow either.
    bad(`§2 ${id} — set resolves`, resolved.unresolved);
  } else if (classifySet(resolved.init) === null) {
    bad(
      `§2 ${id} — set resolves`,
      `produced by \`${resolved.init.slice(0, 96)}\`${resolved.via}, which is not a set this gate can name.\n` +
        '         Known producers: EntryStore.getAllEntries() = ALL-TIME, ' +
        'EntryStore.getEntriesBetween(startOfYear(…), endOfYear(…)) = YEAR-SCOPED.\n' +
        '         Anything else has to be classified here before it can ship — an unnamed window passes silently otherwise.'
    );
  } else {
    const actual = classifySet(resolved.init);
    if (actual === row.set) {
      ok(`§2 ${id} — reads ${actual}: \`${resolved.init.slice(0, 72)}\`${resolved.via}`);
    } else {
      bad(
        `§2 ${id} — reads ${actual}, table says ${row.set}`,
        `\`${resolved.init.slice(0, 96)}\`${resolved.via}\n         ${row.why}`
      );
    }
  }

  // §3 — the words. The pinned label must still be a live string in the file.
  const literals = literalsIn(row.file);
  if (literals.has(row.label)) {
    ok(`§3 ${id} — label "${row.label}" is still on the surface`);
  } else {
    // A bare "not found" makes the reader go hunting for a string that by
    // definition isn't there. Offer the near misses — a label edit is almost
    // always a small edit, and naming the candidate turns this red into a diff.
    const near = [...literals]
      .filter((s) => s.length < 64 && s.toLowerCase().includes(row.label.toLowerCase().split(/[,${]/)[0].trim()))
      .slice(0, 4);
    bad(
      `§3 ${id} — label "${row.label}" no longer exists`,
      'a scope-bearing label changed; re-read the row and confirm the computation still agrees, then update it' +
        (near.length ? `\n         nearest live strings in the file: ${near.map((s) => JSON.stringify(s)).join(', ')}` : '')
    );
  }

  // §4 — agreement. This is the whole rule; §2 and §3 exist to make it real.
  const statesYear = YEAR_WORDS.test(row.label);
  if (row.set === 'YEAR-SCOPED') {
    eq(`§4 ${id} — year-scoped set, and "${row.label}" says so`, statesYear, true);
  } else {
    eq(`§4 ${id} — all-time set, and "${row.label}" claims no year`, statesYear, false);
  }
}

// ---------------------------------------------------------------------------
// §5 — COMPLETENESS. The half that makes the table a gate instead of a comment.
// A fifth consumer of a streak function has to state its scope; it does not get
// to inherit one of the four above by being new.
// ---------------------------------------------------------------------------
console.log('\n§5  completeness — no streak call escapes the table\n');

const covered = new Set(TABLE.map((r) => `${r.file}|${r.fn}`));
const uncovered = found.filter((c) => !covered.has(`${c.rel}|${c.fn}`));
if (uncovered.length === 0) {
  ok(`every ${[...STREAK_FNS].join('/')} call in src/ is declared (${found.length} call sites)`);
} else {
  bad(
    'every streak call in src/ is declared',
    uncovered
      .map((c) => {
        const as = c.spelled === c.fn ? '' : ` (imported as \`${c.spelled}\`)`;
        return `${c.rel}:${c.line} calls ${c.fn}()${as} — ${c.src.slice(0, 88)}\n           add a row stating its scope and the words that justify it`;
      })
      .join('\n         ')
  );
}

const orphans = TABLE.filter((r) => !found.some((c) => c.rel === r.file && c.fn === r.fn));
if (orphans.length === 0) {
  ok('every table row still points at a real call site');
} else {
  bad(
    'every table row still points at a real call site',
    orphans.map((r) => `${r.file} ${r.fn}() — the call is gone; delete the row`).join('\n         ')
  );
}

console.log(`\ncheck-stat-scope: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
