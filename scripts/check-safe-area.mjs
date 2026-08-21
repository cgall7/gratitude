// Gate 2 of the luxury pass (Lumen, thread 6596d9c2, Lane G): the top of the
// app must not physically jump as you navigate.
//
//   npm run check:safe-area
//
// WHY THIS EXISTS
//
// Lumen's audit found safe-area handling on 3 of 23 screens; the other 20
// either hand-guess a top padding or carry none. Fourteen of those hand
// guesses land on one of five values — 48, 60, 64, 72, 100 — which is the
// jump: navigate from a screen at 60 to one at 100 and the header visibly
// steps down. Nothing reads cheaper than chrome that won't hold still.
//
// R15 (Lumen, 2026-08-21): THE LOCATING RULE, NOT A FILE-LEVEL EXEMPTION
//
// The first version of this gate asked one question per FILE — "does this
// screen derive safe area anywhere?" — and applied the answer to every
// paddingTop in the file. That's a membership test wearing a locating
// test's name: TodayTab.js:281 (`content.paddingTop = 72`, the ScrollView's
// `contentContainerStyle`, nothing between it and the device edge but a
// transparent `PerchField`) IS a chrome-jump guess, and HiveDetail.js:286
// (`emptyList.paddingTop = 48`, a `<View>` inside `FlatList`'s
// `ListEmptyComponent`, itself inside a FlatList whose own
// `contentContainerStyle` already carries `padding: 24`) is ordinary
// interior spacing on an empty-state caption sitting well below the top of
// the screen — and the old file-level version could not tell them apart
// unless the WHOLE file happened to derive safe area somewhere.
//
// The rule is per NODE, not per file: a hard-coded paddingTop is chrome
// compensation iff no ANCESTOR between the screen's returned root and that
// node already contributes top spacing. Depth alone doesn't decide it —
// TodayTab's content sits two levels down and is still chrome-adjacent,
// because the thing between it and the root (`PerchField`) contributes
// nothing. `elementContributesTopSpacing` below walks every `*Style`
// attribute on each ancestor (`style`, `contentContainerStyle`, and any
// other prop ending in "Style" — deliberately name-shaped rather than a
// fixed list, so a differently-named style prop on a future component isn't
// silently invisible to it) and treats a present, nonzero-or-dynamic
// `paddingTop`/`padding`/`marginTop`/`margin` as a contribution, plus any
// `<SafeAreaView>` ancestor unconditionally (it pads for insets internally
// regardless of what its own style object says).
//
// A SIDE EFFECT OF THIS RULE: THE HOOK-BASED ESCAPE HATCH NEEDS NO SPECIAL
// CASE ANYMORE
//
// The old file-level version separately tracked `useSafeAreaInsets()` calls
// so a screen built with the hook instead of `<SafeAreaView>` wouldn't false
// positive. That tracking is now redundant and has been deleted: `insets.top`
// can only exist inside the component body (StyleSheet.create runs at
// module scope, before any hook has fired), so it is structurally always an
// INLINE style expression, never a StyleSheet.create key. A candidate is
// only ever raised from a StyleSheet.create paddingTop that folds to a
// literal >= the threshold (see below) — `paddingTop: insets.top` doesn't
// fold, so it was never going to be flagged as a candidate in the first
// place, hook or no hook. And if `insets.top` is used on some ANCESTOR's
// inline style, `elementContributesTopSpacing` already treats an unfoldable
// paddingTop/marginTop as a contribution (can't prove it's zero, so assume
// it isn't) — which is exactly "a screen built this way tomorrow passes
// without a gate update," the guarantee the old code wrote in prose. This is
// R12's shape one level up: delete the special case instead of guarding it,
// once the general mechanism already covers it.
//
// A THIRD, DEPRECATED MECHANISM — COUNTED, BUT FLAGGED SEPARATELY
//
// Legal.js imports `SafeAreaView` from bare `react-native`, not
// `react-native-safe-area-context`. Account.js's own comment (the file that
// switched away from it) says why: "react-native's own SafeAreaView is
// deprecated and warns on every render... react-native-safe-area-context is
// already a dependency." It still applies real insets on iOS, so it counts
// as an ancestor contribution the same as the modern component — the defect
// isn't that Legal.js's top chrome jumps, it's that the API it's built on is
// going away. That's a separate, named, non-blocking check (`Legal.js does
// not import the deprecated react-native SafeAreaView`) so the two claims
// can't be read as one.
//
// THE THRESHOLD, AND WHY IT'S A NUMBER AT ALL
//
// This gate flags a StyleSheet.create paddingTop — literal or a
// constant-folded arithmetic expression — at or above 40, on a node with no
// spacing-contributing ancestor. Measured on this tree: every hand-guessed
// chrome padding sits at 48-100; every unrelated interior padding not
// already shielded by an ancestor (PackageOpen's centered-card nudge at 24,
// MonthlyRecap's 14) sits at 24 or below. 40 is not a device measurement —
// the real iOS status-bar/notch range is ~44-59pt — it's picked to sit in
// the 24-48 gap this tree happens to have. TUNED TO TODAY'S TREE: if a
// legitimate non-chrome padding in the 24-40 range ever gets added
// unshielded, this constant needs revisiting, the same caution Lumen flagged
// about her own 200pt press-depth threshold.
//
// EVALUATE THE CONSTANT, DON'T REGEX IT (Lumen's own instruction) —
// `paddingTop: 44 + 16` is the same defect as `paddingTop: 60` and a digit
// pattern won't see it. `evalConst` below constant-folds NumericLiteral and
// +/- BinaryExpression trees; anything else (a variable, `insets.top`, a
// ternary) is left alone as not-a-literal, which is correct — those are
// exactly the shapes a real fix looks like.
//
// CALIBRATION: this gate runs its own detector against Account.js — the
// file Lumen names as already correct — and asserts zero paddingTop
// violations. Two synthetic recall fixtures reproduce the TodayTab shape
// (unshielded, must be caught) and the HiveDetail shape (shielded by an
// ancestor's `contentContainerStyle`, must not be caught) structurally, so
// the locating rule itself — not just the threshold — has a run-not-modelled
// check.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { loadBaseline, diffAgainstBaseline } from './lib/ratchet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = path.join(ROOT, 'src', 'screens');
const CHROME_THRESHOLD = 40;
const TOP_SPACING_KEYS = ['paddingTop', 'padding', 'marginTop', 'margin'];

// `--dump-json` (ratchet-update.mjs) wants only the final JSON on stdout —
// silence every console.log from here down; the dump call site below
// restores it right before printing the one line that matters.
const DUMP_JSON = process.argv.includes('--dump-json');
const realLog = console.log;
if (DUMP_JSON) console.log = () => {};

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') walk(val, visit);
  }
};

// Constant-folds a NumericLiteral or a +/- tree of them. Returns null for
// anything else (identifier, member expression, ternary, call) — those are
// not literals and are exactly what a real fix should look like.
const evalConst = (n) => {
  if (!n) return null;
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'UnaryExpression' && n.operator === '-' && n.argument?.type === 'NumericLiteral') return -n.argument.value;
  if (n.type === 'BinaryExpression' && (n.operator === '+' || n.operator === '-')) {
    const l = evalConst(n.left);
    const r = evalConst(n.right);
    if (l === null || r === null) return null;
    return n.operator === '+' ? l + r : l - r;
  }
  return null;
};

// `style` itself doesn't end in "Style" (lowercase s) — has to be matched
// on its own, plus anything ending in the suffix (`contentContainerStyle`,
// a future `headerStyle`, etc).
const isStyleProp = (name) => typeof name === 'string' && (name === 'style' || name.endsWith('Style'));

const getPropValue = (objExprNode, propName) => {
  if (!objExprNode || objExprNode.type !== 'ObjectExpression') return null;
  for (const prop of objExprNode.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = prop.key?.name ?? prop.key?.value;
    if (key === propName) return prop.value;
  }
  return null;
};

// Does this resolved style object push its own content (and everything
// inside it) down from wherever it starts? Any of paddingTop/padding/
// marginTop/margin, present and either non-foldable (assume it contributes —
// that's the `insets.top` case) or foldable-nonzero.
const hasTopSpacing = (objExprNode) => {
  for (const name of TOP_SPACING_KEYS) {
    const v = getPropValue(objExprNode, name);
    if (!v) continue;
    const folded = evalConst(v);
    if (folded === null || folded !== 0) return true;
  }
  return false;
};

// Every top-level key of `StyleSheet.create({ ... })`, keyed by name, value
// = the ObjectExpression node (not evaluated — callers resolve what they
// need, since ancestor-contribution and candidate-detection need different
// properties off the same object).
const getStylesMap = (ast) => {
  const map = new Map();
  walk(ast, (n) => {
    if (
      n.type === 'CallExpression' &&
      n.callee?.type === 'MemberExpression' &&
      n.callee.object?.name === 'StyleSheet' &&
      n.callee.property?.name === 'create' &&
      n.arguments[0]?.type === 'ObjectExpression'
    ) {
      for (const prop of n.arguments[0].properties) {
        if (prop.type !== 'ObjectProperty' || prop.value?.type !== 'ObjectExpression') continue;
        const key = prop.key?.name ?? prop.key?.value ?? '?';
        map.set(key, prop.value);
      }
    }
  });
  return map;
};

// Resolves a style-attribute expression (styles.X, an inline object, an
// array of either, a ternary's two branches, a `cond && styles.X`'s right
// side) down to the ObjectExpression node(s) it can actually be. A spread or
// a call it can't see into is silently skipped — not resolvable, so it
// can't be proven to contribute, which biases toward still flagging rather
// than toward a false "shielded."
const resolveStyleRefs = (exprNode, stylesMap, out = []) => {
  if (!exprNode) return out;
  if (exprNode.type === 'JSXExpressionContainer') return resolveStyleRefs(exprNode.expression, stylesMap, out);
  if (exprNode.type === 'MemberExpression' && exprNode.object?.type === 'Identifier' && exprNode.object.name === 'styles' && exprNode.property?.name) {
    const node = stylesMap.get(exprNode.property.name);
    if (node) out.push(node);
    return out;
  }
  if (exprNode.type === 'ObjectExpression') {
    out.push(exprNode);
    return out;
  }
  if (exprNode.type === 'ArrayExpression') {
    for (const el of exprNode.elements) resolveStyleRefs(el, stylesMap, out);
    return out;
  }
  if (exprNode.type === 'ConditionalExpression') {
    resolveStyleRefs(exprNode.consequent, stylesMap, out);
    resolveStyleRefs(exprNode.alternate, stylesMap, out);
    return out;
  }
  if (exprNode.type === 'LogicalExpression') {
    resolveStyleRefs(exprNode.left, stylesMap, out);
    resolveStyleRefs(exprNode.right, stylesMap, out);
    return out;
  }
  return out;
};

// Does this JSX element, as an ANCESTOR of some candidate node, already
// contribute top spacing? `<SafeAreaView>` counts unconditionally (it pads
// for insets internally); otherwise any `*Style`-suffixed attribute whose
// resolved style has top spacing (see `hasTopSpacing`) counts.
const elementContributesTopSpacing = (el, stylesMap) => {
  const opening = el.openingElement;
  if (opening?.name?.type === 'JSXIdentifier' && opening.name.name === 'SafeAreaView') return true;
  for (const attr of opening?.attributes ?? []) {
    if (attr.type !== 'JSXAttribute') continue;
    if (!isStyleProp(attr.name?.name)) continue;
    const refs = resolveStyleRefs(attr.value, stylesMap);
    if (refs.some(hasTopSpacing)) return true;
  }
  return false;
};

// Nearest-JSX-ancestor map, built by an explicit stack rather than the
// generic per-key `walk` above — a `ListEmptyComponent={<View/>}` prop value
// is exactly as much this element's ancestor as a `children` entry is (it's
// what actually ends up rendered underneath it), so the descent doesn't
// distinguish "reached via children" from "reached via an attribute."
const buildJsxParents = (ast) => {
  const parents = new Map();
  const stack = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'JSXElement') {
      parents.set(node, stack[stack.length - 1] ?? null);
      stack.push(node);
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
        visit(node[key]);
      }
      stack.pop();
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      visit(node[key]);
    }
  };
  visit(ast);
  return parents;
};

// The real locating rule: every JSX element whose `*Style` attribute
// directly references a StyleSheet.create key with a literal
// paddingTop >= CHROME_THRESHOLD is a candidate; a candidate is a violation
// iff no ancestor between it and the top of its render tree contributes top
// spacing.
const findChromePaddingViolations = (ast, stylesMap, jsxParents) => {
  const chromeKeys = new Map();
  for (const [key, node] of stylesMap.entries()) {
    const v = getPropValue(node, 'paddingTop');
    if (!v) continue;
    const folded = evalConst(v);
    if (folded !== null && folded >= CHROME_THRESHOLD) {
      chromeKeys.set(key, { line: v.loc.start.line, value: folded });
    }
  }
  if (chromeKeys.size === 0) return [];

  const collectKeyRefs = (n, out) => {
    if (!n) return;
    if (n.type === 'JSXExpressionContainer') return collectKeyRefs(n.expression, out);
    if (n.type === 'MemberExpression' && n.object?.type === 'Identifier' && n.object.name === 'styles' && n.property?.name) {
      if (chromeKeys.has(n.property.name)) out.push(n.property.name);
      return;
    }
    if (n.type === 'ArrayExpression') return n.elements.forEach((el) => collectKeyRefs(el, out));
    if (n.type === 'ConditionalExpression') {
      collectKeyRefs(n.consequent, out);
      collectKeyRefs(n.alternate, out);
      return;
    }
    if (n.type === 'LogicalExpression') {
      collectKeyRefs(n.left, out);
      collectKeyRefs(n.right, out);
    }
  };

  const violations = [];
  const seen = new Set();
  walk(ast, (node) => {
    if (node.type !== 'JSXElement') return;
    for (const attr of node.openingElement?.attributes ?? []) {
      if (attr.type !== 'JSXAttribute') continue;
      if (!isStyleProp(attr.name?.name)) continue;
      const keyRefs = [];
      collectKeyRefs(attr.value, keyRefs);
      for (const key of keyRefs) {
        const dedupeKey = `${key}@${node.start}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        let shielded = false;
        let ancestor = jsxParents.get(node);
        while (ancestor) {
          if (elementContributesTopSpacing(ancestor, stylesMap)) {
            shielded = true;
            break;
          }
          ancestor = jsxParents.get(ancestor);
        }
        if (!shielded) {
          const info = chromeKeys.get(key);
          violations.push({ styleKey: key, line: info.line, value: info.value });
        }
      }
    }
  });
  return violations;
};

const deprecatedSafeAreaViewUsage = (ast) => {
  let importsDeprecated = false;
  let usesJsx = false;
  walk(ast, (n) => {
    if (n.type === 'ImportDeclaration' && n.source.value === 'react-native') {
      for (const spec of n.specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'SafeAreaView') importsDeprecated = true;
      }
    }
    if (n.type === 'JSXOpeningElement' && n.name?.type === 'JSXIdentifier' && n.name.name === 'SafeAreaView') {
      usesJsx = true;
    }
  });
  return importsDeprecated && usesJsx;
};

// --- calibration: known-clean file stays quiet -----------------------------
const accountSrc = fs.readFileSync(path.join(SCREENS_DIR, 'Account.js'), 'utf8');
const accountAst = parse(accountSrc, { sourceType: 'module', plugins: ['jsx'] });
const accountStylesMap = getStylesMap(accountAst);
const accountParents = buildJsxParents(accountAst);
check(
  'calibration: Account.js (Lumen-cited as correct) has zero chrome-padding violations',
  findChromePaddingViolations(accountAst, accountStylesMap, accountParents),
  []
);

// --- calibration: TodayTab shape — a candidate under a transparent
// wrapper, no ancestor contributes, must still be caught -------------------
const UNSHIELDED_FIXTURE = `
import { StyleSheet, View, ScrollView } from 'react-native';
export const Screen = () => (
  <View style={styles.container}>
    <Wrapper>
      <ScrollView contentContainerStyle={styles.content} />
    </Wrapper>
  </View>
);
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 44 + 16 },
});
`;
const unshieldedAst = parse(UNSHIELDED_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
const unshieldedStylesMap = getStylesMap(unshieldedAst);
const unshieldedParents = buildJsxParents(unshieldedAst);
check(
  'calibration: TodayTab shape — unshielded arithmetic paddingTop (44+16=60) two levels under a transparent wrapper is caught',
  findChromePaddingViolations(unshieldedAst, unshieldedStylesMap, unshieldedParents),
  [{ styleKey: 'content', line: 12, value: 60 }]
);

// --- calibration: HiveDetail shape — a candidate inside a FlatList whose
// own contentContainerStyle already carries `padding`, must NOT be caught --
const SHIELDED_FIXTURE = `
import { StyleSheet, View, FlatList } from 'react-native';
export const Screen = () => (
  <View style={styles.container}>
    <FlatList
      contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.emptyList} />}
    />
  </View>
);
const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 24 },
  emptyList: { alignItems: 'center', paddingTop: 48 },
});
`;
const shieldedAst = parse(SHIELDED_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
const shieldedStylesMap = getStylesMap(shieldedAst);
const shieldedParents = buildJsxParents(shieldedAst);
check(
  'calibration: HiveDetail shape — paddingTop shielded by an ancestor FlatList\'s contentContainerStyle padding is NOT caught',
  findChromePaddingViolations(shieldedAst, shieldedStylesMap, shieldedParents),
  []
);

// --- calibration: SafeAreaView ancestor shields unconditionally, even with
// no top-spacing style of its own --------------------------------------
const SAFE_AREA_VIEW_FIXTURE = `
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export const Screen = () => (
  <SafeAreaView style={styles.root}>
    <View style={styles.content} />
  </SafeAreaView>
);
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 60 },
});
`;
const safeAreaViewAst = parse(SAFE_AREA_VIEW_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
const safeAreaViewStylesMap = getStylesMap(safeAreaViewAst);
const safeAreaViewParents = buildJsxParents(safeAreaViewAst);
check(
  'calibration: a SafeAreaView ancestor with no top-spacing style of its own still shields',
  findChromePaddingViolations(safeAreaViewAst, safeAreaViewStylesMap, safeAreaViewParents),
  []
);

// --- the real sweep ---------------------------------------------------------
const screenFiles = fs.readdirSync(SCREENS_DIR).filter((f) => /\.jsx?$/.test(f)).sort();
check('screen files found under src/screens/', screenFiles.length > 0, true);

const violations = [];
const deprecatedApiFiles = [];
const parseErrors = [];
for (const name of screenFiles) {
  const file = path.join(SCREENS_DIR, name);
  const rel = path.relative(ROOT, file);
  let ast;
  try {
    ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    parseErrors.push(`${rel}: ${e.message}`);
    continue;
  }
  if (deprecatedSafeAreaViewUsage(ast)) deprecatedApiFiles.push({ file: rel });
  const stylesMap = getStylesMap(ast);
  const jsxParents = buildJsxParents(ast);
  for (const hit of findChromePaddingViolations(ast, stylesMap, jsxParents)) {
    violations.push({ file: rel, ...hit });
  }
}
check('every screen file parsed', parseErrors, []);
violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
deprecatedApiFiles.sort((a, b) => a.file.localeCompare(b.file));

// `--dump-json` (used by ratchet-update.mjs to regenerate the baselines) —
// print the two live violation sets and exit, skip every check() below.
// Kept separate from the assertions so a baseline can only ever be
// regenerated as an explicit, visible step, never as a side effect of a
// normal `npm run check:safe-area`.
if (DUMP_JSON) {
  realLog(JSON.stringify({ chromePadding: violations, deprecatedSafeAreaView: deprecatedApiFiles }));
  process.exit(0);
}

console.log(`\n--- unshielded hard-coded chrome paddingTop (>= ${CHROME_THRESHOLD}pt, no spacing-contributing ancestor) (${violations.length}) ---`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line}  styles.${v.styleKey}.paddingTop = ${v.value}`);
}

console.log(`\n--- screens on the deprecated react-native SafeAreaView (${deprecatedApiFiles.length}) ---`);
for (const v of deprecatedApiFiles) console.log(`  ${v.file}`);

// R15's merge-gate consequence: both sweeps above are real, pre-existing
// product debt (Fizz, wave 2 — GUIDES/HEX_TAP_SPEC_LUXURY_PASS.md
// "R14 Execution Review + Safe-Area Ruling"), not a defect in this gate.
// Ratchet each against its checked-in baseline instead of hard-failing on
// every entry, so the suite can protect the other 35+ gates again while
// this one shrinks as a tracked debt rather than staying invisible behind
// a permanently red suite.
const paddingBaseline = loadBaseline(path.join(ROOT, 'scripts', 'baselines', 'safe-area-padding.json'));
const paddingKeyOf = (v) => `${v.file}:${v.line}`;
const paddingDiff = diffAgainstBaseline(violations, paddingBaseline.entries, paddingKeyOf);
console.log(`\n${paddingDiff.stillOpen} already in the baseline (owner: ${paddingBaseline.owner}) — ${paddingDiff.added.length} new, ${paddingDiff.stale.length} baseline rows no longer reproduced`);
for (const v of paddingDiff.added) console.log(`  NEW, not in baseline: ${paddingKeyOf(v)}  styles.${v.styleKey}.paddingTop = ${v.value}`);
for (const v of paddingDiff.stale) console.log(`  STALE baseline row, run \`npm run ratchet:update\` to retire it: ${paddingKeyOf(v)}`);
check('no unshielded chrome paddingTop beyond the checked-in ratchet baseline', paddingDiff.added, []);
check('every ratchet-baselined paddingTop entry still reproduces (or has been retired via ratchet:update)', paddingDiff.stale, []);

const deprecatedBaseline = loadBaseline(path.join(ROOT, 'scripts', 'baselines', 'safe-area-deprecated-import.json'));
const deprecatedKeyOf = (v) => v.file;
const deprecatedDiff = diffAgainstBaseline(deprecatedApiFiles, deprecatedBaseline.entries, deprecatedKeyOf);
console.log(`\n${deprecatedDiff.stillOpen} already in the baseline (owner: ${deprecatedBaseline.owner}) — ${deprecatedDiff.added.length} new, ${deprecatedDiff.stale.length} baseline rows no longer reproduced`);
for (const v of deprecatedDiff.added) console.log(`  NEW, not in baseline: ${deprecatedKeyOf(v)}`);
for (const v of deprecatedDiff.stale) console.log(`  STALE baseline row, run \`npm run ratchet:update\` to retire it: ${deprecatedKeyOf(v)}`);
check('no screen newly imports the deprecated react-native SafeAreaView beyond the ratchet baseline', deprecatedDiff.added, []);
check('every ratchet-baselined deprecated-import entry still reproduces (or has been retired via ratchet:update)', deprecatedDiff.stale, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
