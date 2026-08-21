// Gate 5's companion (Lumen, thread 6596d9c2): the honey-glow spotlight
// only works if two numeric floors hold at once, and either one alone would
// have gone green on a shipped defect.
//
//   npm run check:spotlight-dim
//
// FIXED (Lumen, 2026-08-21, same thread): this file crashed on R6's own
// token. Three defects, not the same size:
//   1. evalNode() understood `withAlpha(...)` and nothing else. R6 made
//      `colors.spotlightDim` a `withAlpha(mix(...), alpha)` — a CallExpression
//      nested inside a CallExpression — and it threw. Taught it `mix()`,
//      reimplemented from theme.js's own definition, same convention as
//      `withAlpha` above.
//   2. Fixing (1) unmasked the real defect: both live floors below composited
//      `withAlpha(inkVeil, spotlightAlpha)` — pigment hardcoded, only the
//      alpha read live. `colors.spotlightDim` is a *derived* pigment now
//      (`mix(accentDeep, inkVeil, 0.25)`), not `inkVeil`. A veil token has
//      two terms; pinning one and following the other goes stale exactly
//      like `r` -> `R` did in check:hex-tap-geometry an hour earlier. Fixed
//      by reading `colors.spotlightDim` whole — it already evaluates to the
//      resolved `rgba(...)` string once (1) is fixed, so there is nothing
//      left to reconstruct by hand.
//   3. The live spotlight floor was composited on `background` (the page).
//      The token is painted on the cells (`surface`) — see theme.js's own
//      R6 comment: "the cell is the ground this token is painted on." Moved.
//      The distinguishability floor stays on `background`/PAGE on purpose —
//      `scrim` is only ever painted on the page, so "would this be confused
//      with a modal" is a same-ground comparison against where scrim
//      actually renders (matches `derive-spotlight-dim.mjs`'s own `onPage`
//      comment: "modal-confusion test happens on the PAGE"). Two floors,
//      two grounds, each named at its own assertion — not one shared ground
//      for both.
// The calibration block (next section) reproduces Lumen's ORIGINAL published
// figures, from before R6 existed, when the token really was `inkVeil` at a
// literal alpha. It is deliberately NOT live — it is the proof that `over`/
// `rgbToLab`/`withAlpha` reproduce known-good numbers, pinned to history on
// purpose. Only the two floor checks after it read the shipped token.
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

// mix(hexA, hexB, t) reimplemented from theme.js's own definition, same
// convention as withAlpha above — a derived pigment resolves to a hex
// before anything sees it.
const mix = (hexA, hexB, t) => {
  const parseHex = (h) => {
    const m = /^#([0-9A-Fa-f]{6})$/.exec(h);
    if (!m) throw new Error(`mix() takes 6-digit hex pigments, got ${h}`);
    return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  };
  if (!(t >= 0 && t <= 1)) throw new Error(`mix() takes t in [0,1], got ${t}`);
  const [a, b] = [parseHex(hexA), parseHex(hexB)];
  const ch = (i) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`.toUpperCase();
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
  if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'mix') {
    const [hexAArg, hexBArg, tArg] = n.arguments;
    return mix(evalNode(hexAArg, scope), evalNode(hexBArg, scope), evalNode(tArg, scope));
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
const background = colors.background; // PAGE ground — where `scrim` is painted
const surface = colors.surface; // CELL ground — where `spotlightDim` is painted
const inkVeil = pigment.inkVeil;
const L = (c) => rgbToLab(c).L;

// "Lit cell" punches through the dim and keeps full ground; "room" is the
// ground composited with a pre-resolved dim CSS colour (a caller's `roomCss`,
// not a pigment+alpha this helper reconstructs) — takes the ground too, since
// the calibration block below and the live floors below that no longer share
// one.
const spotlight = (glowHex, roomCss, ground) => {
  const room = over(roomCss, ground);
  const litCell = over(withAlpha(glowHex, BLOOM_OPACITY), ground);
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
    const actual = Number(spotlight(colors[name], withAlpha(inkVeil, Number(dim)), background).toFixed(2));
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

// --- the real gate: computed off the LIVE colors.spotlightDim TOKEN — the
// resolved `rgba(...)` string mix()+withAlpha() produce, not a hardcoded
// pigment with only its alpha read live — so a future retune of either term
// is re-checked against both floors automatically rather than requiring this
// file to be edited in step.
console.log(`\n--- colors.spotlightDim (live) = ${colors.spotlightDim} ---`);

// Floor 1: on the CELL (`surface`) — the ground this token is actually
// painted on, per theme.js's own R6 comment.
const liveSpotlight = Number(spotlight(colors.accentBurst, colors.spotlightDim, surface).toFixed(2));
console.log(`  spotlight(accentBurst, spotlightDim) on surface = ${liveSpotlight}`);
checkGE('honey glow (accentBurst) reads lighter than the dimmed room at bloom', liveSpotlight, 0);

// Floor 2: on the PAGE (`background`) — `scrim` only ever renders there, so
// "would this be confused with a modal" composites both on the ground scrim
// actually uses (matches derive-spotlight-dim.mjs's `onPage` comparison).
const spotlightDimPage = over(colors.spotlightDim, background);
const distinguishability = Number(deltaE00(spotlightDimPage, scrimPage).toFixed(2));
console.log(`  ΔE00(spotlightDim page, scrim page) = ${distinguishability}`);
checkGE('spotlightDim reads as a distinct thing from the modal scrim (§20.7 floor)', distinguishability, GROUND_PAIR_FLOOR);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
