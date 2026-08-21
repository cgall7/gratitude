// Gate 3 of the luxury pass (Lumen, thread 6596d9c2, Lane G): every spring
// and every collected timing duration comes from `motion.js`, never an
// inline literal.
//
//   npm run check:spring-adoption
//
// WHY THIS EXISTS
//
// `motion.js`'s own docstring claims it centralized PressableScale,
// CelebrationRays, AnimatedStat, BeeTransition and CelebrationBadge — "this
// first pass centralizes the curves already ratified and in live use...
// with zero behavior change." All five still hold literals. A module that
// documents an adoption it never performed is worse than one that admits it
// hasn't started, because nothing else in the tree contradicts the claim —
// which is exactly why an enumerator has to be the thing that checks it,
// not another paragraph of prose.
//
// TWO INDEPENDENT SWEEPS, BOTH STRUCTURAL (walk every `Animated.spring` /
// `Animated.timing` call site by NAME, then classify what's inside — never
// grep for a specific known-bad number, which is Lumen's own instruction
// for this gate: "sweep the name, not the values — a heuristic over
// numbers can't enumerate a role." The values only enter once a real call
// site has already been found by shape.)
//
// PART A — SPRINGS. Every `Animated.spring(anim, { ... })` whose config
// object carries inline `friction`/`tension` NumericLiteral properties is a
// violation; the compliant shape spreads a declared curve
// (`...SPRINGS.press`). Two severities, per Lumen's ruling on
// `TabBarButton:22`'s `{6, 220}`: a literal pair that reproduces a declared
// spring's exact numbers is a MISS (the curve exists, nobody pointed at
// it); a literal pair that matches no declared spring's numbers at all is a
// STRAY CURVE (a sixth curve arrived by hand, worse, because fixing it
// requires a ruling — which of the two Colin now has — not just a
// find-and-replace).
//
// PART B — DURATIONS. `Animated.timing(anim, { duration: <literal> })`
// where the literal number exactly matches a declared `DURATIONS` value.
// Walks into both arms of a ternary independently (the shape every
// `useReducedMotion` call site uses: `reduced ? DURATIONS.x : <literal>`),
// since HoneycombGrid's known violation lives in the non-reduced arm only.
//
// A value can match MORE than one declared name — `DURATIONS.quick` and
// `DURATIONS.reducedMotionFade` are both 200. Where that happens the
// violation names every matching key rather than guessing one; CoreRitual's
// three `duration: 200` sites (an unlock-overlay fade, not one of
// `motion.js`'s five claimed files, and not gated by `reduced`) fall in
// this ambiguous bucket. They are still reported — an inline literal that
// duplicates a declared constant needs a human's naming decision, not this
// gate's — but kept visually distinct from the direct hits below, which
// carry an in-file comment tying the exact number to the exact constant
// (AnimatedStat.js:28 "~400ms" == `arrival`, :41's numeral count-up ==
// `reveal`, CelebrationRays.js:97 "~500ms" == `celebrate`,
// HoneycombGrid.js:340 == `revealGlide`, all four inside files `motion.js`
// itself names as already collected).
//
// WHY THE CONSTANTS ARE READ FROM `motion.js` ITSELF, NOT HAND-COPIED HERE
//
// A second copy of SPRINGS/DURATIONS in this file would drift from the
// first exactly the way `motion.js`'s docstring already drifted from the
// call sites. `loadConstObject` below partially evaluates the two
// `export const` object literals directly out of the parsed source — plain
// numbers only; anything it can't evaluate (a computed key, a spread, a
// function) throws, so a `motion.js` restructure reds this gate loudly
// instead of silently reading zero curves.
//
// CALIBRATION: a recall fixture with one inline spring literal (matching a
// declared curve), one undeclared inline pair, one compliant spread, and
// one inline duration literal — the detector must classify all four
// correctly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const MOTION_FILE = path.join(SRC, 'constants', 'motion.js');

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

// Partial evaluator: NumericLiteral, and ObjectExpression of those (one
// level, which is all SPRINGS/DURATIONS need). Throws on anything it
// doesn't recognize rather than silently skipping it.
const evalLiteral = (n) => {
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'ObjectExpression') {
    const obj = {};
    for (const prop of n.properties) {
      if (prop.type !== 'ObjectProperty') throw new Error(`unexpected property type ${prop.type} in ${n.loc?.start.line}`);
      obj[prop.key.name ?? prop.key.value] = evalLiteral(prop.value);
    }
    return obj;
  }
  throw new Error(`cannot evaluate node type ${n.type} at line ${n.loc?.start.line}`);
};

const loadConstObject = (ast, exportName) => {
  let found = null;
  walk(ast, (n) => {
    if (
      n.type === 'VariableDeclarator' &&
      n.id?.type === 'Identifier' &&
      n.id.name === exportName &&
      n.init?.type === 'ObjectExpression'
    ) {
      found = evalLiteral(n.init);
    }
  });
  if (!found) throw new Error(`could not find "export const ${exportName} = {...}" in motion.js`);
  return found;
};

const motionSrc = fs.readFileSync(MOTION_FILE, 'utf8');
const motionAst = parse(motionSrc, { sourceType: 'module', plugins: ['jsx'] });
const SPRINGS = loadConstObject(motionAst, 'SPRINGS');
const DURATIONS = loadConstObject(motionAst, 'DURATIONS');

check('SPRINGS loaded from motion.js has entries', Object.keys(SPRINGS).length > 0, true);
check('DURATIONS loaded from motion.js has entries', Object.keys(DURATIONS).length > 0, true);

const springNamesMatching = (friction, tension) =>
  Object.entries(SPRINGS)
    .filter(([, v]) => v.friction === friction && v.tension === tension)
    .map(([k]) => k);

const durationNamesMatching = (value) =>
  Object.entries(DURATIONS)
    .filter(([, v]) => v === value)
    .map(([k]) => k);

const isSpringsSpread = (prop) =>
  prop.type === 'SpreadElement' &&
  prop.argument?.type === 'MemberExpression' &&
  prop.argument.object?.type === 'Identifier' &&
  prop.argument.object.name === 'SPRINGS';

// --- Part A: springs ---------------------------------------------------
const scanSprings = (ast, rel) => {
  const violations = [];
  walk(ast, (n) => {
    if (
      n.type !== 'CallExpression' ||
      n.callee?.type !== 'MemberExpression' ||
      n.callee.object?.name !== 'Animated' ||
      n.callee.property?.name !== 'spring'
    ) return;
    const config = n.arguments[1];
    if (config?.type !== 'ObjectExpression') return;
    const frictionProp = config.properties.find((p) => p.type === 'ObjectProperty' && p.key?.name === 'friction');
    const tensionProp = config.properties.find((p) => p.type === 'ObjectProperty' && p.key?.name === 'tension');
    if (!frictionProp || !tensionProp) return;
    if (frictionProp.value.type !== 'NumericLiteral' || tensionProp.value.type !== 'NumericLiteral') return;
    const friction = frictionProp.value.value;
    const tension = tensionProp.value.value;
    const matches = springNamesMatching(friction, tension);
    violations.push({
      file: rel,
      line: n.loc.start.line,
      friction,
      tension,
      severity: matches.length ? 'MISS (duplicates declared)' : 'STRAY CURVE (matches no SPRINGS entry)',
      matches,
    });
  });
  return violations;
};

// --- Part B: durations ---------------------------------------------------
const scanDurationNode = (node, out, rel) => {
  if (!node) return;
  if (node.type === 'NumericLiteral') {
    const matches = durationNamesMatching(node.value);
    if (matches.length) out.push({ file: rel, line: node.loc.start.line, value: node.value, matches });
    return;
  }
  if (node.type === 'ConditionalExpression') {
    scanDurationNode(node.consequent, out, rel);
    scanDurationNode(node.alternate, out, rel);
  }
  // Anything else (Identifier, MemberExpression, CallExpression) is not an
  // inline literal — compliant or out of scope, either way not this gate's business.
};

const scanDurations = (ast, rel) => {
  const violations = [];
  walk(ast, (n) => {
    if (
      n.type !== 'CallExpression' ||
      n.callee?.type !== 'MemberExpression' ||
      n.callee.object?.name !== 'Animated' ||
      n.callee.property?.name !== 'timing'
    ) return;
    const config = n.arguments[1];
    if (config?.type !== 'ObjectExpression') return;
    const durationProp = config.properties.find((p) => p.type === 'ObjectProperty' && p.key?.name === 'duration');
    if (!durationProp) return;
    scanDurationNode(durationProp.value, violations, rel);
  });
  return violations;
};

// --- calibration ---------------------------------------------------------
const [firstSpringName, firstSpring] = Object.entries(SPRINGS)[0];
const [firstDurationName, firstDurationValue] = Object.entries(DURATIONS)[0];
const RECALL_FIXTURE = `
Animated.spring(a, { toValue: 1, friction: ${firstSpring.friction}, tension: ${firstSpring.tension}, useNativeDriver: true }).start();
Animated.spring(b, { toValue: 1, friction: 999, tension: 999, useNativeDriver: true }).start();
Animated.spring(c, { toValue: 1, ...SPRINGS.${firstSpringName}, useNativeDriver: true }).start();
Animated.timing(d, { toValue: 1, duration: ${firstDurationValue}, useNativeDriver: true }).start();
Animated.timing(e, { toValue: 1, duration: reduced ? DURATIONS.${firstDurationName} : ${firstDurationValue}, useNativeDriver: true }).start();
`;
const recallAst = parse(RECALL_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
const recallSprings = scanSprings(recallAst, 'fixture');
const recallDurations = scanDurations(recallAst, 'fixture');
check('calibration: recall fixture finds exactly 2 spring violations (literal-a, literal-b; spread-c excluded)', recallSprings.length, 2);
check('calibration: recall fixture classifies the matching literal as MISS', recallSprings[0]?.severity, 'MISS (duplicates declared)');
check('calibration: recall fixture classifies the non-matching literal as STRAY CURVE', recallSprings[1]?.severity, 'STRAY CURVE (matches no SPRINGS entry)');
check('calibration: recall fixture finds exactly 2 duration violations (bare + ternary alternate)', recallDurations.length, 2);

// --- the real sweep ---------------------------------------------------------
const files = [];
(function walkDir(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (/\.jsx?$/.test(name) && p !== MOTION_FILE) files.push(p);
  }
})(SRC);
check('source files found under src/ (motion.js excluded)', files.length > 0, true);

const springViolations = [];
const durationViolations = [];
const parseErrors = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  try {
    const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    springViolations.push(...scanSprings(ast, rel));
    durationViolations.push(...scanDurations(ast, rel));
  } catch (e) {
    parseErrors.push(`${rel}: ${e.message}`);
  }
}
check('every file parsed', parseErrors, []);

console.log(`\n--- inline Animated.spring friction/tension literals (${springViolations.length}) ---`);
for (const v of springViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.log(`  ${v.file}:${v.line}  {friction: ${v.friction}, tension: ${v.tension}}  ${v.severity}${v.matches.length ? ` -> SPRINGS.${v.matches.join('/')}` : ''}`);
}
check('every Animated.spring takes friction/tension from SPRINGS', springViolations, []);

console.log(`\n--- inline Animated.timing durations duplicating a declared DURATIONS value (${durationViolations.length}) ---`);
for (const v of durationViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.log(`  ${v.file}:${v.line}  duration: ${v.value}  -> DURATIONS.${v.matches.join(' / ')}${v.matches.length > 1 ? '  [ambiguous — value shared by multiple declared names]' : ''}`);
}
check('every Animated.timing duration that duplicates a DURATIONS value takes it from DURATIONS', durationViolations, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
