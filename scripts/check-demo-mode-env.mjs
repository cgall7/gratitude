// Gate for App.js's DEMO_MODE derivation (Sage, thread 14492cf2).
//
//   npm run check:demo-mode-env
//
// WHY THIS EXISTS
//
// `App.js:39` used to be `const DEMO_MODE = true;` — a literal, unconditional
// in every build including production TestFlight/App Store releases. It
// gates two behaviours: forcing every cold launch to Onboarding, and an
// AppState listener that resets to Onboarding on every foreground resume. A
// production build shipping that literal traps a real tester in the pitch
// experience forever — write an entry, background the app, come back to
// the welcome flow.
//
// `eas.json` sets a distinct EXPO_PUBLIC_DEMO_MODE per build profile
// (development: unset, preview: "true", production: "false"), but an env var
// with no reader doesn't fail — it just quietly means nothing, and the
// profile block *looks* like it's doing the job. Nothing but a source read
// can catch that; `expo export` is green on a bare literal same as a wired
// one, because a bundle check can't see which one shipped.
//
// TWO TRAPS THE RIGHT DERIVATION HAS TO AVOID, BOTH INVISIBLE TO REVIEW
//
//   1. Expo's inline-env-vars babel plugin only rewrites a direct
//      `process.env.X` MemberExpression. `const { X } = process.env` is an
//      ObjectPattern, never visited, and resolves to `undefined` at runtime
//      — a silent always-off flag that still passes a "mentions the env var"
//      grep.
//   2. The inlined value is always a string. `Boolean(process.env.X)` or a
//      bare truthiness check makes the explicit `"false"` production profile
//      sets truthy — so the fix that looks obvious ships the exact defect
//      this gate exists to catch, with a green diff.
//
// So this gate asserts the derivation is a `===` comparison against the
// string `'true'` on a direct member read, not merely that the words
// "DEMO_MODE" and "process.env" both appear in the file.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const isProcessEnvMember = (n, name) =>
  n?.type === 'MemberExpression' &&
  n.object?.type === 'MemberExpression' &&
  n.object.object?.type === 'Identifier' &&
  n.object.object.name === 'process' &&
  n.object.property?.type === 'Identifier' &&
  n.object.property.name === 'env' &&
  !n.computed &&
  n.property?.type === 'Identifier' &&
  n.property.name === name;

// --- App.js: the derivation itself ---------------------------------------
const appSrc = await readFile(path.join(ROOT, 'App.js'), 'utf8');
const appAst = parse(appSrc, { sourceType: 'module', plugins: ['jsx'] });

let demoModeDecl = null;
for (const stmt of appAst.program.body) {
  if (stmt.type !== 'VariableDeclaration') continue;
  for (const d of stmt.declarations) {
    if (d.id?.type === 'Identifier' && d.id.name === 'DEMO_MODE') demoModeDecl = d;
  }
}
check('App.js declares a top-level DEMO_MODE const', Boolean(demoModeDecl), true);

const init = demoModeDecl?.init;
check('DEMO_MODE is not a bare literal', init?.type !== 'BooleanLiteral', true);
check('DEMO_MODE is a === comparison', init?.type === 'BinaryExpression' && init.operator === '===', true);

const sides = init?.type === 'BinaryExpression' ? [init.left, init.right] : [];
const memberSide = sides.find((s) => isProcessEnvMember(s, 'EXPO_PUBLIC_DEMO_MODE'));
const literalSide = sides.find((s) => s?.type === 'StringLiteral');
check('one side reads process.env.EXPO_PUBLIC_DEMO_MODE directly', Boolean(memberSide), true);
check("the other side is the string literal 'true'", literalSide?.value, 'true');

// --- No destructured process.env anywhere in App.js -----------------------
// Catches the fix that looks equivalent and silently isn't: destructuring
// resolves the var to undefined regardless of what any build profile sets.
const destructuredProcessEnv = [];
walk(appAst.program, (n) => {
  if (
    n.type === 'VariableDeclarator' &&
    n.id?.type === 'ObjectPattern' &&
    n.init?.type === 'MemberExpression' &&
    n.init.object?.type === 'Identifier' &&
    n.init.object.name === 'process' &&
    n.init.property?.type === 'Identifier' &&
    n.init.property.name === 'env'
  ) {
    destructuredProcessEnv.push(n.id.start);
  }
});
check('no destructured `const { X } = process.env` in App.js', destructuredProcessEnv, []);

// --- eas.json: read the file that owns the per-profile values -------------
const eas = JSON.parse(await readFile(path.join(ROOT, 'eas.json'), 'utf8'));
check('development profile sets no EXPO_PUBLIC_DEMO_MODE (absent -> false)',
  eas.build?.development?.env?.EXPO_PUBLIC_DEMO_MODE, undefined);
check('preview profile sets EXPO_PUBLIC_DEMO_MODE "true"',
  eas.build?.preview?.env?.EXPO_PUBLIC_DEMO_MODE, 'true');
check('production profile sets EXPO_PUBLIC_DEMO_MODE "false"',
  eas.build?.production?.env?.EXPO_PUBLIC_DEMO_MODE, 'false');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
