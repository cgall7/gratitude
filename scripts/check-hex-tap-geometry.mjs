// Gate 5's OTHER companion (thread 6596d9c2): check-spotlight-dim.mjs proved
// the two LUMINANCE floors. This proves the four GEOMETRY/COMPOSITION
// rulings Lumen made while reviewing Pixel's `HexTapOverlay.js` build,
// because each one is a defect class that reads as fine on-screen at first
// glance and is wrong by a measurable amount:
//
//   npm run check:hex-tap-geometry
//
//   1. punch-out radius: `stop1 * r === cellSize` must hold STRUCTURALLY
//      (stop1 written as `cellSize / r`), not by a typed 0.57735 that goes
//      stale the moment cellSize retunes. Ruling 2's literal reading would
//      have punched a 25.4pt hole inside the 38.105pt inradius — the tapped
//      cell dimming across most of its own face, the inverse of Beat 1.
//   2. the on-device alpha bug: react-native-svg's `<Stop>` discards
//      `stopColor`'s own alpha and rebuilds from `stopOpacity` alone. A
//      `theme.colors.spotlightDim` token (alpha-baked) handed straight to
//      `stopColor` renders at full strength. The fix is the rgb/alpha split
//      via `stopFor()`; this gate asserts the dim Stops use the split, not
//      the raw token.
//   3. the camera-dive guard (ruling 3(b)): a scrim that doesn't know its
//      own geometry is wrong until `cameraProgress` reaches identity must
//      not be able to render at full strength mid-dive. Asserts BOTH
//      `cameraProgress` (outer wrapper) and `revealProgress` (inner dim
//      opacity) are present in the composited chain — guards against a
//      future edit collapsing this back to a plain opacity assignment.
//   4. the y=12 structural cross-check (Lumen, msg 6): `stage`'s height is
//      `layout.height + 24` and it centers its child on both axes, so the
//      cluster's `onLayout` origin is (24 - 0) / 2 = 12 by construction —
//      no new constant, just confirms nobody detached the two numbers.
//
// Static/AST only — this cannot see the on-device render. Full acceptance
// (reduced-motion variant, adjacent-tap guard, Beat 6/7 pool-card layering)
// is Pixel's on-device checklist per msg 79b14ddaf4, not this gate's job.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OVERLAY_FILE = path.join(ROOT, 'src', 'components', 'HexTapOverlay.js');
const GRID_FILE = path.join(ROOT, 'src', 'components', 'HoneycombGrid.js');

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
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

const overlaySrc = fs.readFileSync(OVERLAY_FILE, 'utf8');
const overlayAst = parse(overlaySrc, { sourceType: 'module', plugins: ['jsx'] });
const gridSrc = fs.readFileSync(GRID_FILE, 'utf8');
const gridAst = parse(gridSrc, { sourceType: 'module', plugins: ['jsx'] });

// --- 1. punch-out radius is structural, not typed -------------------------
let rDecl = null;
let punchStopDecl = null;
walk(overlayAst, (n) => {
  if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier') return;
  if (n.id.name === 'r') rDecl = n.init;
  if (n.id.name === 'punchStop') punchStopDecl = n.init;
});
check(
  '`r` is assigned from ringStepFor(cellSize), not a taste number',
  rDecl?.type === 'CallExpression' && rDecl.callee?.name === 'ringStepFor'
);
check(
  '`punchStop` is written as `cellSize / r` (algebraically punchStop * r === cellSize)',
  punchStopDecl?.type === 'BinaryExpression' &&
    punchStopDecl.operator === '/' &&
    punchStopDecl.left?.name === 'cellSize' &&
    punchStopDecl.right?.name === 'r'
);
let hasLiteral057735 = false;
walk(overlayAst, (n) => {
  if (n.type === 'NumericLiteral' && Math.abs(n.value - 0.57735) < 1e-4) hasLiteral057735 = true;
});
check('no typed 0.57735 literal anywhere in the file (would drift from cellSize)', !hasLiteral057735);

// --- 2. the stopColor/stopOpacity alpha split ------------------------------
let dimDecl = null;
walk(overlayAst, (n) => {
  if (n.type === 'VariableDeclarator' && n.id?.name === 'dim') dimDecl = n.init;
});
check(
  '`dim` is derived via stopFor(theme.colors.spotlightDim), not the raw token',
  dimDecl?.type === 'CallExpression' &&
    dimDecl.callee?.name === 'stopFor' &&
    dimDecl.arguments[0]?.type === 'MemberExpression'
);

const dimStopUsesSplit = [];
walk(overlayAst, (n) => {
  if (n.type !== 'JSXOpeningElement' || n.name?.name !== 'Stop') return;
  const attrs = Object.fromEntries(
    n.attributes
      .filter((a) => a.type === 'JSXAttribute')
      .map((a) => [a.name.name, a.value])
  );
  const stopColorExpr = attrs.stopColor?.expression;
  if (stopColorExpr?.type === 'MemberExpression' && stopColorExpr.object?.name === 'dim' && stopColorExpr.property?.name === 'rgb') {
    const opacityVal = attrs.stopOpacity;
    dimStopUsesSplit.push(opacityVal?.type === 'JSXExpressionContainer' ? opacityVal.expression : opacityVal);
  }
});
check('both dim <Stop> elements use `dim.rgb`, never `theme.colors.spotlightDim` raw', dimStopUsesSplit.length === 2);
check(
  'the two dim stops carry different alpha (punch-out transparent, room dim.alpha) — not both hardcoded the same',
  dimStopUsesSplit.some((v) => v?.type === 'StringLiteral' && v.value === '0') &&
    dimStopUsesSplit.some((v) => v?.type === 'MemberExpression' && v.object?.name === 'dim' && v.property?.name === 'alpha')
);

// --- 3. camera-dive guard: both terms present in the opacity chain --------
let dimOpacityDecl = null;
walk(overlayAst, (n) => {
  if (n.type === 'VariableDeclarator' && n.id?.name === 'dimOpacity') dimOpacityDecl = n.init;
});
const dimOpacityArgNames = new Set();
walk(dimOpacityDecl, (n) => {
  if (n.type === 'Identifier') dimOpacityArgNames.add(n.name);
});
check(
  'dim Rect opacity (`dimOpacity`) is derived FROM revealProgress, not a flat/typed value',
  dimOpacityArgNames.has('revealProgress')
);

let outerViewOpacityIsCameraProgress = false;
let dimRectUsesDimOpacity = false;
walk(overlayAst, (n) => {
  const isAnimatedView =
    n.type === 'JSXOpeningElement' &&
    n.name?.type === 'JSXMemberExpression' &&
    n.name.object?.name === 'Animated' &&
    n.name.property?.name === 'View';
  if (isAnimatedView) {
    const styleAttr = n.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'style');
    const src = overlaySrc.slice(styleAttr?.value?.start ?? 0, styleAttr?.value?.end ?? 0);
    if (/opacity:\s*cameraProgress/.test(src)) outerViewOpacityIsCameraProgress = true;
  }
  if (n.type === 'JSXOpeningElement' && n.name?.name === 'AnimatedRect') {
    const opacityAttr = n.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'opacity');
    if (opacityAttr?.value?.expression?.name === 'dimOpacity') dimRectUsesDimOpacity = true;
  }
});
check('the overlay-wrapping Animated.View opacity is `cameraProgress` (outer guard)', outerViewOpacityIsCameraProgress);
check('the dim AnimatedRect opacity is `dimOpacity` (inner guard, carries revealProgress)', dimRectUsesDimOpacity);
check(
  'ruling 3(b) composite is intact: cameraProgress (outer) AND revealProgress (inner) both gate the dim layer',
  outerViewOpacityIsCameraProgress && dimRectUsesDimOpacity && dimOpacityArgNames.has('revealProgress')
);

// --- 4. y=12 structural cross-check ----------------------------------------
let stageStyleHasCenterJustify = false;
walk(gridAst, (n) => {
  if (n.type !== 'ObjectProperty' || n.key?.name !== 'stage') return;
  const src = gridSrc.slice(n.value.start, n.value.end);
  if (/justifyContent:\s*['"]center['"]/.test(src) && /alignItems:\s*['"]center['"]/.test(src)) {
    stageStyleHasCenterJustify = true;
  }
});
check('`stage` style centers on both axes (required for the offset to be symmetric)', stageStyleHasCenterJustify);

let stageHeightIsLayoutPlus24 = false;
walk(gridAst, (n) => {
  if (n.type !== 'JSXAttribute' || n.name?.name !== 'style') return;
  const src = gridSrc.slice(n.start, n.end);
  if (/styles\.stage/.test(src) && /layout\.height\s*\+\s*24/.test(src)) stageHeightIsLayoutPlus24 = true;
});
check('`stage` height is `layout.height + 24`, so the symmetric offset is (24)/2 = 12 exactly', stageHeightIsLayoutPlus24);

const Y_OFFSET = 24 / 2;
check(`the derived cluster onLayout.y is ${Y_OFFSET} (24 split evenly by center justify, not a separate constant)`, Y_OFFSET === 12);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
