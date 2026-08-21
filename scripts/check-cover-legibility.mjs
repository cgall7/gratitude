// Gate 5 of the luxury pass (Lumen, thread 6596d9c2, Lane G): every hive
// cover clears the legibility floor against the card it's rendered on.
//
//   npm run check:cover-legibility
//
// WHY THIS EXISTS
//
// Two of Create Hive's four covers shipped as ghosts: `sunlit-honey` was
// ΔE00 0.00 against the page it sat on — an exact colour match — and
// `cream-gold` sat close enough (8.37 against the raw page, worse before
// Lumen's rim/inset ruling) to be nearly as bad. Fizz's fix (E2/E3) makes the
// page stop mattering at all: every cover renders as an inset fill inside a
// `surface` (#FFFFFF) card, so separation is always cover-vs-white.
//
// THE LIT-STOP REQUIREMENT — read before changing the assertion below
//
// A flat measurement of each cover's `base` against `surface` is not enough.
// `gradients.sheen` lays a white overlay across every cover corner-to-corner
// (`theme.js`'s own comment: "a white sheen lightens a cover TOWARD the white
// card it sits on, so the lit corner — not the flat base — is the worst
// case"). Lumen's own first number for the sheen alpha (0.35) passed a `base`
// check and still put `starlight`'s LIT corner at 4.77 ΔE00, under the floor.
// So this gate composites `sheen[0]` (the lit, highest-alpha stop) over each
// cover's `base` with `over()` and measures THAT — never the bare base color.
// A gate that measured `base` would have gone green on the exact regression
// this gate exists to catch.
//
// WHERE THE NUMBERS COME FROM
//
// `HIVE_COVER_THEMES` (hiveThemes.js) and `pigment`/`colors`/`gradients.sheen`
// (theme.js) are parsed from source via a small AST evaluator below, not
// hand-copied — a plain Node `import` of theme.js fails (it uses
// extensionless specifiers Metro resolves and Node ESM does not), and a
// second hand-typed copy of the palette is exactly the class of drift
// Lumen's own audit spent today finding. If a cover is added, retired, or
// its base retuned, this gate re-derives against the new source without
// edits here — matching check-spring-adoption.mjs's `loadConstObject`
// pattern for the same reason.
//
// R12 (Lumen, check-spotlight-dim.mjs, thread 6596d9c2): the FUNCTIONS that
// build the palette (`withAlpha`, `mix`) are ADOPTED from theme.js's own
// source below, not hand-reimplemented — the same doctrine above applied to
// the palette's data has to apply to the arithmetic that produces it, or a
// hand-copy can go stale next to a `colors` object that stays live. This
// file crashed on `theme.js:163`'s `mix(...)` before this fix, the same
// defect check-spotlight-dim.mjs had before R12.
//
// THE FLOOR — ΔE00 >= 5, Lumen's ruling (thread 6596d9c2): "beneath notice as
// a colour, plainly visible as a cut" is roughly where §8's 1.77 sits; 5 is
// the value she measured her covers against and ruled by. Not derived here;
// quote her ruling if it moves, don't retune this number unilaterally.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { over, deltaE00, parseColor } from './lib/color.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME_FILE = path.join(ROOT, 'src', 'constants', 'theme.js');
const HIVE_THEMES_FILE = path.join(ROOT, 'src', 'constants', 'hiveThemes.js');
const FLOOR = 5;

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

// withAlpha/mix are ADOPTED from theme.js's own source below, not
// reimplemented — declared now so evalNode can close over them, assigned
// once theme.js is parsed, before either is first called.
let withAlpha;
let mix;

// Partial evaluator over a fixed scope chain (outer -> inner). Recognises
// exactly the shapes theme.js/hiveThemes.js use for these three constants;
// throws on anything else rather than silently returning a wrong answer.
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

// --- theme.js: pigment -> colors -> gradients.sheen -------------------------
const themeSrc = fs.readFileSync(THEME_FILE, 'utf8');
const themeAst = parse(themeSrc, { sourceType: 'module', plugins: ['jsx'] });

// Adopt withAlpha/mix from theme.js's own source (R12) rather than
// reimplementing them — both are self-contained (params + built-ins only,
// no closure over theme.js's outer scope), so extracting each declarator's
// exact source text and building the real function from it executes
// theme.js's own definition, not a model of it.
const adopt = (name) => {
  const node = findConst(themeAst, name);
  return new Function(`return (${themeSrc.slice(node.start, node.end)});`)();
};
withAlpha = adopt('withAlpha');
mix = adopt('mix');

const pigment = evalNode(findConst(themeAst, 'pigment'), {});
check('pigment loaded from theme.js has entries', Object.keys(pigment).length > 0, true);

const colors = evalNode(findConst(themeAst, 'colors'), { pigment });
check('colors loaded from theme.js has entries', Object.keys(colors).length > 0, true);

const gradients = evalNode(findConst(themeAst, 'gradients'), { pigment, colors });
check('gradients.sheen loaded from theme.js has 4 stops', gradients.sheen?.length, 4);

const litStop = gradients.sheen[0];
const litAlpha = parseColor(litStop).a;

// --- hiveThemes.js: HIVE_COVER_THEMES ---------------------------------------
const hiveThemesSrc = fs.readFileSync(HIVE_THEMES_FILE, 'utf8');
const hiveThemesAst = parse(hiveThemesSrc, { sourceType: 'module', plugins: ['jsx'] });

const coverThemesNode = findConst(hiveThemesAst, 'HIVE_COVER_THEMES');
const covers = evalNode(coverThemesNode, { theme: { colors } });
check('HIVE_COVER_THEMES loaded from hiveThemes.js has entries', covers.length > 0, true);

// --- calibration: reproduce Lumen's own published figures (thread 6596d9c2) -
// Same convention as color.mjs's CALIBRATION against theme.js's self-reported
// goldField numbers: a checker's reds are worth nothing until it has been
// run against something known-correct. These four were published as the
// sheen alpha's own ratification measurement; if the sheen alpha or a cover
// base moves, THIS block goes red first and must be re-derived from the new
// ruling, not silently updated to match.
const KNOWN_LIT_VS_SURFACE = {
  'sunlit-honey': 12.91,
  wildflower: 8.78,
  starlight: 5.76,
  'cream-gold': 5.87,
};
check('sheen lit-stop alpha is 0.20 (Lumen\'s ratified ceiling)', litAlpha, 0.2);
for (const cover of covers) {
  const expected = KNOWN_LIT_VS_SURFACE[cover.id];
  if (expected === undefined) continue; // a genuinely new cover has no historical figure to calibrate against
  const lit = over(litStop, cover.base);
  const actual = Number(deltaE00(lit, colors.surface).toFixed(2));
  check(`calibration: ${cover.id} lit-vs-surface reproduces Lumen's published ${expected}`, actual, expected);
}

// --- the real sweep ---------------------------------------------------------
console.log(`\n--- lit-corner ΔE00 vs surface, floor ${FLOOR} (${covers.length} covers) ---`);
for (const cover of covers) {
  const lit = over(litStop, cover.base);
  const litVsSurface = deltaE00(lit, colors.surface);
  const baseVsSurface = deltaE00(cover.base, colors.surface);
  console.log(`  ${cover.id}  base ${baseVsSurface.toFixed(2)}  lit ${litVsSurface.toFixed(2)}`);
  checkGE(`${cover.id}: lit corner clears the floor against surface`, Number(litVsSurface.toFixed(2)), FLOOR);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
