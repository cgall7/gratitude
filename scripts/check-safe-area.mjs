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
// WHAT COUNTS AS "A SCREEN ROOT DERIVES SAFE AREA"
//
// Two live mechanisms in this codebase, both accepted:
//   - `<SafeAreaView>` imported from `react-native-safe-area-context`, used
//     as a JSX element in the file (Account.js).
//   - `useSafeAreaInsets()` called and its result referenced (no current
//     screen does this, but the assertion is Lumen's literal wording and a
//     screen built this way tomorrow should pass without a gate update).
//
// A THIRD, DEPRECATED MECHANISM — COUNTED, BUT FLAGGED SEPARATELY
//
// Legal.js imports `SafeAreaView` from bare `react-native`, not
// `react-native-safe-area-context`. Account.js's own comment (the file that
// switched away from it) says why: "react-native's own SafeAreaView is
// deprecated and warns on every render... react-native-safe-area-context is
// already a dependency." It still applies real insets on iOS, so it counts
// toward "this screen derives safe area" for the paddingTop assertion below
// — the defect isn't that Legal.js's top chrome jumps, it's that the API
// it's built on is going away. That's a separate, named, non-blocking check
// (`Legal.js does not import the deprecated react-native SafeAreaView`) so
// the two claims can't be read as one.
//
// THE THRESHOLD, AND WHY IT'S A NUMBER AT ALL
//
// Lumen's spec says "no literal paddingTop on a screen root" — but a
// literal `paddingTop: 12` two levels inside a screen that already wraps
// itself in `SafeAreaView` (Account.js's `topBar`/`content`, 8 and 12) is
// ordinary interior spacing, not a chrome-jump guess, and reding it would
// make the gate loud on the one file Lumen cites as done right — exactly
// the "calibrate before you trust its reds" failure she warned about.
//
// So: screens that already derive safe area from one of the two mechanisms
// above are EXEMPT from the paddingTop sweep entirely (their interior
// padding is none of this gate's business). For the 20 that don't, this
// gate flags any StyleSheet paddingTop — literal or a constant-folded
// arithmetic expression — at or above 40. Measured on this tree: every
// hand-guessed chrome padding sits at 48-100; every unrelated interior
// padding on a non-safe-area screen (PackageOpen's centered-card nudge at
// 24, MonthlyRecap's 14) sits at 24 or below. 40 is not a device
// measurement — the real iOS status-bar/notch range is ~44-59pt — it's
// picked to sit in the 24-48 gap this tree happens to have. TUNED TO
// TODAY'S TREE: if a legitimate non-chrome padding in the 24-40 range ever
// gets added to a non-safe-area screen, this constant needs revisiting, the
// same caution Lumen flagged about her own 200pt press-depth threshold.
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
// violations, the "run against a file you know is clean" check.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = path.join(ROOT, 'src', 'screens');
const CHROME_THRESHOLD = 40;

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

const hasSafeAreaRoot = (ast) => {
  let importsContextSafeAreaView = false;
  let importsDeprecatedSafeAreaView = false;
  let importsUseInsetsHook = false;
  let usesSafeAreaViewJsx = false;
  let callsUseInsetsHook = false;

  walk(ast, (n) => {
    if (n.type === 'ImportDeclaration') {
      const fromContext = n.source.value === 'react-native-safe-area-context';
      const fromCore = n.source.value === 'react-native';
      for (const spec of n.specifiers) {
        if (spec.type !== 'ImportSpecifier') continue;
        if (spec.imported?.name === 'SafeAreaView' && fromContext) importsContextSafeAreaView = true;
        if (spec.imported?.name === 'SafeAreaView' && fromCore) importsDeprecatedSafeAreaView = true;
        if (spec.imported?.name === 'useSafeAreaInsets' && fromContext) importsUseInsetsHook = true;
      }
    }
    if (n.type === 'JSXOpeningElement' && n.name?.type === 'JSXIdentifier' && n.name.name === 'SafeAreaView') {
      usesSafeAreaViewJsx = true;
    }
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && n.callee.name === 'useSafeAreaInsets') {
      callsUseInsetsHook = true;
    }
  });

  const derivesSafeArea =
    ((importsContextSafeAreaView || importsDeprecatedSafeAreaView) && usesSafeAreaViewJsx) ||
    (importsUseInsetsHook && callsUseInsetsHook);

  return { derivesSafeArea, importsDeprecatedSafeAreaView, usesSafeAreaViewJsx };
};

// Every top-level key of `StyleSheet.create({ ... })` that carries a
// paddingTop constant-folding to >= CHROME_THRESHOLD.
const findChromePaddings = (ast) => {
  const found = [];
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
        for (const inner of prop.value.properties) {
          if (inner.type !== 'ObjectProperty') continue;
          const innerKey = inner.key?.name ?? inner.key?.value;
          if (innerKey !== 'paddingTop') continue;
          const value = evalConst(inner.value);
          if (value !== null && value >= CHROME_THRESHOLD) {
            found.push({ styleKey: key, line: inner.loc.start.line, value });
          }
        }
      }
    }
  });
  return found;
};

// --- calibration: known-clean file stays quiet -----------------------------
const accountSrc = fs.readFileSync(path.join(SCREENS_DIR, 'Account.js'), 'utf8');
const accountAst = parse(accountSrc, { sourceType: 'module', plugins: ['jsx'] });
check('calibration: Account.js (Lumen-cited as correct) resolves derivesSafeArea', hasSafeAreaRoot(accountAst).derivesSafeArea, true);
// Belt-and-suspenders: even if the derivesSafeArea exemption were ever
// removed, Account.js's own interior paddings (8, 12) sit below the
// threshold and would not false-fire — this is what "confirm it stays
// quiet" means for a threshold-based check, not just "the exemption fired."
check('calibration: Account.js interior paddingTop values sit below the chrome threshold on their own', findChromePaddings(accountAst), []);

// --- calibration: recall fixture (a screen with no safe-area root and a
// hand-guessed 60pt top padding must still be caught) ----------------------
const RECALL_FIXTURE = `
import { StyleSheet, View } from 'react-native';
export const Screen = () => (
  <View style={styles.container}><View style={styles.header} /></View>
);
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 44 + 16 },
});
`;
const recallAst = parse(RECALL_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
check('calibration: recall fixture resolves derivesSafeArea false', hasSafeAreaRoot(recallAst).derivesSafeArea, false);
check('calibration: recall fixture catches the arithmetic paddingTop (44+16=60)', findChromePaddings(recallAst), [{ styleKey: 'header', line: 8, value: 60 }]);

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
  const { derivesSafeArea, importsDeprecatedSafeAreaView, usesSafeAreaViewJsx } = hasSafeAreaRoot(ast);
  if (importsDeprecatedSafeAreaView && usesSafeAreaViewJsx) deprecatedApiFiles.push(rel);
  if (derivesSafeArea) continue;
  for (const hit of findChromePaddings(ast)) {
    violations.push({ file: rel, ...hit });
  }
}
check('every screen file parsed', parseErrors, []);

console.log(`\n--- screens with no safe-area root and a >= ${CHROME_THRESHOLD}pt hard-coded paddingTop (${violations.length}) ---`);
for (const v of violations.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`  ${v.file}:${v.line}  styles.${v.styleKey}.paddingTop = ${v.value}`);
}
check('no screen hard-codes a chrome-sized paddingTop without deriving safe area', violations, []);

console.log(`\n--- screens on the deprecated react-native SafeAreaView (${deprecatedApiFiles.length}) ---`);
for (const f of deprecatedApiFiles) console.log(`  ${f}`);
check('no screen imports SafeAreaView from react-native (use react-native-safe-area-context)', deprecatedApiFiles, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
