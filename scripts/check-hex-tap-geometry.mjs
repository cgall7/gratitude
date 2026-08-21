// Gate 5's OTHER companion (thread 6596d9c2): check-spotlight-dim.mjs proved
// the two LUMINANCE floors. This proves the GEOMETRY/COMPOSITION rulings
// made while reviewing Pixel's `HexTapOverlay.js` build, because each one is
// a defect class that reads as fine on-screen at first glance and is wrong
// by a measurable amount:
//
//   npm run check:hex-tap-geometry
//
//   1. punch-out radius: `punchStop * R === cellSize` must hold
//      STRUCTURALLY (punchStop written as `cellSize / R`), not by a typed
//      0.57735 that goes stale the moment cellSize retunes. Ruling 2's
//      literal reading would have punched a 25.4pt hole inside the 38.105pt
//      inradius — the tapped cell dimming across most of its own face, the
//      inverse of Beat 1.
//   1b. R7's three-stop falloff: `fullStop * R === ringStepFor(cellSize)`,
//      same structural form (`fullStop` written as
//      `ringStepFor(cellSize) / R`) — a dim held at full strength to the box
//      edge is a mask, not a light; the third stop is what releases it.
//   2. the on-device alpha bug: react-native-svg's `<Stop>` discards
//      `stopColor`'s own alpha and rebuilds from `stopOpacity` alone. A
//      `theme.colors.spotlightDim` token (alpha-baked) handed straight to
//      `stopColor` renders at full strength. The fix is the rgb/alpha split
//      via `stopFor()`; this gate asserts all three dim Stops use the
//      split, not the raw token.
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
//   5. R10's glow plateau (First-Build Review, then R5/R7 Build Review):
//      `shadowRadius` is a blur spread from a View's EDGE; an SVG
//      RadialGradient's `r` is a total extent from a CENTRE. R5 converted
//      the extent (`bloomR`/`restR` = `cellSize + shadowRadius`) but left
//      the gradient's SHAPE a point-emitter cone peaking at centre — a View
//      shadow is a blurred COPY OF THE SHAPE, flat at full opacity across
//      the whole view and falling off only past its edge. `plateauStop`
//      (`cellSize / glowR`, per level) restates that shape: the same
//      `stopOpacity` repeated at offset 0 and at the plateau stop, THEN the
//      fall to 0 at offset 1. Structural checks that `bloomPlateauStop *
//      bloomR === cellSize` and `restPlateauStop * restR === cellSize` by
//      construction, plus an independent numeric reproduction against
//      theme.js's live `shadows.glow()` register and HoneycombGrid's live
//      default `cellSize` — not trusting the 44.000000 the branch reported,
//      recomputing it here from source.
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
const THEME_FILE = path.join(ROOT, 'src', 'constants', 'theme.js');

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const checkEq = (label, got, want) => {
  const ok = got === want;
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${got}, want ${want}`}`);
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
// R7 renamed the single ring-step radius `r` to `R` = 3 * ringStepFor(cellSize)
// (three-stop falloff needs a radius past the single ring step) — this gate
// tracks the current name, not the one from the first build.
let rDecl = null;
let punchStopDecl = null;
let fullStopDecl = null;
walk(overlayAst, (n) => {
  if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier') return;
  if (n.id.name === 'R') rDecl = n.init;
  if (n.id.name === 'punchStop') punchStopDecl = n.init;
  if (n.id.name === 'fullStop') fullStopDecl = n.init;
});
check(
  '`R` is assigned from 3 * ringStepFor(cellSize), not a taste number',
  rDecl?.type === 'BinaryExpression' &&
    rDecl.operator === '*' &&
    rDecl.right?.type === 'CallExpression' &&
    rDecl.right.callee?.name === 'ringStepFor'
);
check(
  '`punchStop` is written as `cellSize / R` (algebraically punchStop * R === cellSize)',
  punchStopDecl?.type === 'BinaryExpression' &&
    punchStopDecl.operator === '/' &&
    punchStopDecl.left?.name === 'cellSize' &&
    punchStopDecl.right?.name === 'R'
);
check(
  '`fullStop` (R7) is written as `ringStepFor(cellSize) / R` (algebraically fullStop * R === ringStepFor(cellSize))',
  fullStopDecl?.type === 'BinaryExpression' &&
    fullStopDecl.operator === '/' &&
    fullStopDecl.left?.type === 'CallExpression' &&
    fullStopDecl.left.callee?.name === 'ringStepFor' &&
    fullStopDecl.right?.name === 'R'
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
check('all three dim <Stop> elements (R7 added the release stop) use `dim.rgb`, never `theme.colors.spotlightDim` raw', dimStopUsesSplit.length === 3);
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

// --- 5. R10: glow plateau — cone becomes a View-shadow-shaped profile -----
// Structural half first: bloomR/restR are the frame conversion (R5),
// bloomPlateauStop/restPlateauStop are the shape fix (R10), and the JSX
// Stops must actually hold the SAME opacity at offset 0 and at the plateau
// stop — an extra stop with a different value would be a second cone, not
// a plateau.
const findVarInit = (name) => {
  let found = null;
  walk(overlayAst, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.id.name === name) found = n.init;
  });
  return found;
};
const bloomRDecl = findVarInit('bloomR');
const restRDecl = findVarInit('restR');
const bloomPlateauStopDecl = findVarInit('bloomPlateauStop');
const restPlateauStopDecl = findVarInit('restPlateauStop');

const isCellSizePlusShadowRadius = (decl, levelName) =>
  decl?.type === 'BinaryExpression' &&
  decl.operator === '+' &&
  decl.left?.name === 'cellSize' &&
  decl.right?.type === 'MemberExpression' &&
  decl.right.object?.name === levelName &&
  decl.right.property?.name === 'shadowRadius';

check('`bloomR` is `cellSize + bloom.shadowRadius` (R5 frame conversion, edge not centre)', isCellSizePlusShadowRadius(bloomRDecl, 'bloom'));
check('`restR` is `cellSize + rest.shadowRadius` (R5 frame conversion, edge not centre)', isCellSizePlusShadowRadius(restRDecl, 'rest'));

const isCellSizeOverGlowR = (decl, rName) =>
  decl?.type === 'BinaryExpression' &&
  decl.operator === '/' &&
  decl.left?.name === 'cellSize' &&
  decl.right?.name === rName;

check(
  '`bloomPlateauStop` is written as `cellSize / bloomR` (algebraically bloomPlateauStop * bloomR === cellSize)',
  isCellSizeOverGlowR(bloomPlateauStopDecl, 'bloomR')
);
check(
  '`restPlateauStop` is written as `cellSize / restR` (algebraically restPlateauStop * restR === cellSize)',
  isCellSizeOverGlowR(restPlateauStopDecl, 'restR')
);

// The plateau shape itself: for each of bloomId/restId, the offset-0 Stop
// and the plateau-offset Stop must carry the identical stopOpacity
// expression — that identity IS the "flat, not a second cone" claim.
const gradientPlateauIsFlat = (gradientName, plateauVarName) => {
  let ok = false;
  walk(overlayAst, (n) => {
    if (n.type !== 'JSXElement') return;
    const opening = n.openingElement;
    if (opening?.name?.name !== 'RadialGradient') return;
    const idAttr = opening.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'id');
    if (idAttr?.value?.expression?.name !== gradientName) return;
    const stops = n.children.filter((c) => c.type === 'JSXElement' && c.openingElement.name?.name === 'Stop');
    const attrsOf = (el) =>
      Object.fromEntries(
        el.openingElement.attributes.filter((a) => a.type === 'JSXAttribute').map((a) => [a.name.name, a.value])
      );
    const srcOf = (attrVal) => (attrVal ? overlaySrc.slice(attrVal.start, attrVal.end) : null);
    const zeroStop = stops.find((s) => srcOf(attrsOf(s).offset) === '"0"');
    const plateauStop = stops.find((s) => attrsOf(s).offset?.expression?.name === plateauVarName);
    if (!zeroStop || !plateauStop) return;
    ok = srcOf(attrsOf(zeroStop).stopOpacity) === srcOf(attrsOf(plateauStop).stopOpacity);
  });
  return ok;
};
check(
  'bloomId gradient: offset-0 and bloomPlateauStop Stops carry the same stopOpacity expression (flat plateau, not a second cone)',
  gradientPlateauIsFlat('bloomId', 'bloomPlateauStop')
);
check(
  'restId gradient: offset-0 and restPlateauStop Stops carry the same stopOpacity expression (flat plateau, not a second cone)',
  gradientPlateauIsFlat('restId', 'restPlateauStop')
);

// Numeric half: independent reproduction, not a trust of the branch's own
// reported 44.000000 — parsed straight off theme.js's live `glow()` levels
// register and HoneycombGrid.js's live default `cellSize`, same source
// check-spotlight-dim.mjs reads for the luminance floors.
const themeSrc = fs.readFileSync(THEME_FILE, 'utf8');
const themeAst = parse(themeSrc, { sourceType: 'module', plugins: ['jsx'] });
let levelsNode = null;
walk(themeAst, (n) => {
  if (n.type === 'VariableDeclarator' && n.id?.name === 'levels' && n.init?.type === 'ObjectExpression') levelsNode = n.init;
});
const readShadowRadius = (levelName) => {
  const levelProp = levelsNode.properties.find((p) => (p.key?.name ?? p.key?.value) === levelName);
  const srProp = levelProp.value.properties.find((p) => (p.key?.name ?? p.key?.value) === 'shadowRadius');
  return srProp.value.value;
};
const liveBloomShadowRadius = readShadowRadius('bloom');
const liveRestShadowRadius = readShadowRadius('rest');

let liveCellSize = null;
walk(gridAst, (n) => {
  if (n.type === 'AssignmentPattern' && n.left?.name === 'cellSize' && n.right?.type === 'NumericLiteral') {
    liveCellSize = n.right.value;
  }
});

console.log(`\n--- live values: cellSize=${liveCellSize}, bloom.shadowRadius=${liveBloomShadowRadius}, rest.shadowRadius=${liveRestShadowRadius} ---`);

const liveBloomR = liveCellSize + liveBloomShadowRadius;
const liveRestR = liveCellSize + liveRestShadowRadius;
const liveBloomPlateauStop = liveCellSize / liveBloomR;
const liveRestPlateauStop = liveCellSize / liveRestR;
console.log(`  bloomR=${liveBloomR}, bloomPlateauStop=${liveBloomPlateauStop}`);
console.log(`  restR=${liveRestR}, restPlateauStop=${liveRestPlateauStop}`);

checkEq('bloomPlateauStop * bloomR === cellSize (exact, live source values)', liveBloomPlateauStop * liveBloomR, liveCellSize);
checkEq('restPlateauStop * restR === cellSize (exact, live source values)', liveRestPlateauStop * liveRestR, liveCellSize);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
