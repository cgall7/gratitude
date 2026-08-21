// Gate 5's companion (Lumen, thread 6596d9c2): the honey-glow spotlight
// only works if two numeric floors hold at once, and either one alone would
// have gone green on a shipped defect.
//
//   npm run check:spotlight-dim
//
// WHY THIS EXISTS
//
// Lumen's own ruling reversed itself twice in two hours on this exact
// number. First pass: rank glow colours by ΔE00 against `background`,
// pick `accentDeep` (furthest away). Wrong instrument — ΔE00 is a
// distance with no direction, and on a near-white page "furthest away"
// means "furthest into shadow." Second pass, measured in L* instead: EVERY
// yellow, at every level, DARKENS `background` when undimmed — there is no
// glow on this page, only a bruise, until the surround is dimmed. Once the
// dim exists, the ranking inverts, because dimming is what hands back the
// luminance a glow needs to travel into.
//
// A gate that checked only "is there a glow color" or only "is there a dim
// token" would have passed at any point in that two-hour arc, including the
// bruise. The actual ruling is two floors that both have to clear:
//
//   1. SPOTLIGHT — the lit cell must read LIGHTER than the dimmed room, not
//      just less-dark. At dim 0.15, `accentDeep`'s spotlight number is
//      -0.11 — "exactly as dark as the room it's supposed to be lighting."
//      Negative-but-small is still a failure, which is why this is a floor
//      at zero, not a ranking.
//   2. DISTINGUISHABLE — `spotlightDim` and `colors.scrim` are the SAME
//      pigment (`inkVeil`) at different alphas, and they mean opposite
//      things: scrim says "the page is inert, a modal owns it," spotlightDim
//      says "the page is still yours, one thing on it is lit, and it
//      releases itself." If the two alphas render indistinguishably, a tap
//      looks like an open modal. §20.7's ground-pair floor (ΔE00 >= 5)
//      applies to telling them apart, not just to the cover-vs-surface case
//      gate 5 built it for.
//
// THE PUNCH-OUT MATTERS TO THE ARITHMETIC, NOT JUST THE VISUAL
//
// Deezine's storyboard says the dim "clears near the tapped cell" and
// Lumen's message calls that load-bearing: a spotlight does not dim the
// thing it's lighting. That's not just a rendering detail — it changes
// which number is "the room." The "lit cell" below composites the glow
// over the UNDIMMED background (the punch-out keeps the tapped cell at
// full ground); "the room" composites the dim over that same background.
// Compositing the glow over the DIMMED room instead reproduces none of
// Lumen's published figures (verified while building this gate: it prints
// +4.86/-5.15 at dim 0.25 where the ruling's own numbers are +17.75/+8.01)
// — silent proof that a gate encoding the wrong compositing order would
// pass its own arithmetic and still fail to describe the interaction.
//
// WHERE THE NUMBERS COME FROM
//
// `pigment`, `colors`, and the `glow()` helper's `levels` register are
// parsed from `theme.js` via the same small AST evaluator check-cover-
// legibility.mjs uses, for the same reason: a hand-copied second palette is
// the exact drift class this whole pass exists to catch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { over, deltaE00, rgbToLab, parseColor } from './lib/color.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME_FILE = path.join(ROOT, 'src', 'constants', 'theme.js');
const GROUND_PAIR_FLOOR = 5; // §20.7, quoted not re-derived — same floor gate 5 uses

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const checkGE = (label, got, floor) => {
  const ok = typeof got === 'number' && got >= floor;
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${got}, want >= ${floor}`}`);
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

// withAlpha(hex, alpha) reimplemented from theme.js's own definition —
// the gate evaluates the call rather than just recognising its shape.
const withAlpha = (hex, alpha) => {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) throw new Error(`withAlpha() takes a 6-digit hex pigment, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const evalNode = (n, scope) => {
  if (n.type === 'StringLiteral') return n.value;
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'Identifier') {
    if (n.name in scope) return scope[n.name];
    throw new Error(`unresolved identifier "${n.name}" at line ${n.loc?.start.line}`);
  }
  if (n.type === 'MemberExpression' && !n.computed) {
    const obj = evalNode(n.object, scope);
    const key = n.property.name;
    if (obj == null || typeof obj !== 'object' || !(key in obj)) {
      throw new Error(`cannot resolve .${key} at line ${n.loc?.start.line}`);
    }
    return obj[key];
  }
  if (n.type === 'ObjectExpression') {
    const obj = {};
    for (const prop of n.properties) {
      if (prop.type === 'SpreadElement') {
        Object.assign(obj, evalNode(prop.argument, scope));
        continue;
      }
      if (prop.type !== 'ObjectProperty') throw new Error(`unexpected property type ${prop.type} at line ${n.loc?.start.line}`);
      obj[prop.key.name ?? prop.key.value] = evalNode(prop.value, scope);
    }
    return obj;
  }
  if (n.type === 'ArrayExpression') return n.elements.map((el) => evalNode(el, scope));
  if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'withAlpha') {
    const [hexArg, alphaArg] = n.arguments;
    return withAlpha(evalNode(hexArg, scope), evalNode(alphaArg, scope));
  }
  throw new Error(`cannot evaluate node type ${n.type} at line ${n.loc?.start.line}`);
};

const findConst = (ast, name) => {
  let found = null;
  walk(ast, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.id.name === name && n.init) {
      found = n.init;
    }
  });
  if (!found) throw new Error(`could not find "const ${name} = ..." `);
  return found;
};

// --- theme.js: pigment -> colors, and glow()'s levels register -------------
const themeSrc = fs.readFileSync(THEME_FILE, 'utf8');
const themeAst = parse(themeSrc, { sourceType: 'module', plugins: ['jsx'] });

const pigment = evalNode(findConst(themeAst, 'pigment'), {});
check('pigment loaded from theme.js has entries', Object.keys(pigment).length > 0, true);

const colors = evalNode(findConst(themeAst, 'colors'), { pigment });
check('colors loaded from theme.js has entries', Object.keys(colors).length > 0, true);

const levels = evalNode(findConst(themeAst, 'levels'), {});
check('shadows.glow() levels register has rest/bloom/peak', Object.keys(levels).sort(), ['bloom', 'peak', 'rest']);

const BLOOM_OPACITY = levels.bloom.shadowOpacity;
const background = colors.background;
const inkVeil = pigment.inkVeil;
const L = (c) => rgbToLab(c).L;

// "Lit cell" punches through the dim and keeps full ground; "room" is the
// ground composited with the dim pigment at the given alpha.
const spotlight = (glowHex, dimAlpha) => {
  const room = over(withAlpha(inkVeil, dimAlpha), background);
  const litCell = over(withAlpha(glowHex, BLOOM_OPACITY), background);
  return L(litCell) - L(room);
};

// --- calibration: reproduce Lumen's own published figures (thread 6596d9c2) -
// Same convention as gate 5: a checker's reds are worth nothing until it has
// been run against something known-correct. If BLOOM_OPACITY, a pigment, or
// an alpha moves, this block goes red first and must be re-derived from the
// new ruling, not silently updated to match.
check('shadows.glow bloom opacity is 0.35 (ratified register)', BLOOM_OPACITY, 0.35);

const groundLstar = L(background);
const darkensAtZeroDim = {
  accentBurst: -2.26,
  accent: -4.38,
  accentDeep: -12.0,
};
for (const [name, expected] of Object.entries(darkensAtZeroDim)) {
  const litL = L(over(withAlpha(colors[name], BLOOM_OPACITY), background));
  const actual = Number((litL - groundLstar).toFixed(2));
  check(`calibration: undimmed ${name} at bloom darkens background by ${expected}`, actual, expected);
}

const spotlightTable = {
  0.15: { accentBurst: 9.63, accentDeep: -0.11 },
  0.25: { accentBurst: 17.75, accentDeep: 8.01 },
};
for (const [dim, expectations] of Object.entries(spotlightTable)) {
  for (const [name, expected] of Object.entries(expectations)) {
    const actual = Number(spotlight(colors[name], Number(dim)).toFixed(2));
    check(`calibration: spotlight(${name}, dim ${dim}) reproduces ${expected}`, actual, expected);
  }
}

const distinguishTable = { 0.25: 9.64, 0.3: 6.63, 0.32: 5.37, 0.35: 3.42 };
const scrimPage = over(withAlpha(inkVeil, parseColor(colors.scrim).a), background);
for (const [alpha, expected] of Object.entries(distinguishTable)) {
  const page = over(withAlpha(inkVeil, Number(alpha)), background);
  const actual = Number(deltaE00(page, scrimPage).toFixed(2));
  check(`calibration: dim-alpha ${alpha} vs scrim reproduces ΔE00 ${expected}`, actual, expected);
}

// --- the real gate: computed off the LIVE colors.spotlightDim, not a typed
// alpha, so a future retune is re-checked against both floors automatically
// rather than requiring this file to be edited in step.
const spotlightAlpha = parseColor(colors.spotlightDim).a;
console.log(`\n--- colors.spotlightDim is inkVeil @ ${spotlightAlpha} ---`);

const liveSpotlight = Number(spotlight(colors.accentBurst, spotlightAlpha).toFixed(2));
console.log(`  spotlight(accentBurst, dim ${spotlightAlpha}) = ${liveSpotlight}`);
checkGE('honey glow (accentBurst) reads lighter than the dimmed room at bloom', liveSpotlight, 0);

const spotlightDimPage = over(withAlpha(inkVeil, spotlightAlpha), background);
const distinguishability = Number(deltaE00(spotlightDimPage, scrimPage).toFixed(2));
console.log(`  ΔE00(spotlightDim page, scrim page) = ${distinguishability}`);
checkGE('spotlightDim reads as a distinct thing from the modal scrim (§20.7 floor)', distinguishability, GROUND_PAIR_FLOOR);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
