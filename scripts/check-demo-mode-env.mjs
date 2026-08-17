// Gate for the DEMO_MODE derivation and the DEMO_CONTENT disjunction in
// src/constants/demoMode.js (Sage, threads 14492cf2 and 37fb8ef6).
//
//   npm run check:demo-mode-env
//
// WHY THIS EXISTS
//
// App.js used to have `const DEMO_MODE = true;` — a literal, unconditional
// in every build including production TestFlight/App Store releases. It
// gates two behaviours: forcing every cold launch to Onboarding, and an
// AppState listener that resets to Onboarding on every foreground resume. A
// production build shipping that literal traps a real tester in the pitch
// experience forever — write an entry, background the app, come back to
// the welcome flow.
//
// The constant now lives in src/constants/demoMode.js (fizz/demo-content-flag
// merge): screens need the derived DEMO_CONTENT next to it, and importing
// from App.js would be circular. The gate follows the constant — the
// derivation assertions below target demoMode.js, and App.js is asserted to
// consume it from there rather than re-deriving or re-hardcoding its own.
//
// TWO HAZARDS, NOT ONE (Sage, 2026-08-15). Routing and content are separate
// failure modes: DEMO_MODE (kiosk routing — cold-launch + foreground reset)
// can be correctly off while FlowToggle and the "skip to demo" link still
// render for store users. DEMO_CONTENT is the constant that gates those
// affordances, so it gets its own assertions here; a gate that only covered
// DEMO_MODE read green while half the hazard shipped.
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
//
// ONE MORE RESTRICTION — NOT A TRAP, A HOUSE STYLE (Sage, same thread)
//
// `isProcessEnvMember` also reds `process.env['EXPO_PUBLIC_DEMO_MODE']`
// (computed, string-literal property). At SDK 57, babel-preset-expo's
// `toMemberProperty` accepts both an Identifier and a StringLiteral, so that
// form *is* inlined correctly at runtime — reding it isn't catching a bug,
// it's this gate preferring one correct spelling over another. Kept
// deliberately: the failure direction is red-on-correct-code, never
// green-on-a-trap, and loosening it buys nothing but risk. If this ever
// reds a legitimate computed read, that's this note, not a gate defect.
//
// --- .env.example: the file a human actually opens ------------------------
// `eas.json` and this script both read the value; neither is where a
// developer looks to find the switch. Asserted below so the flag can't go
// undiscoverable again the way it did between 73b29f8 and this fix.
//
// This only asserts the NAME is listed, not that the accepted values are
// documented (Sage, same thread). The comparison below is `=== 'true'`,
// exact and case-sensitive, so a bare `EXPO_PUBLIC_DEMO_MODE=` is enough to
// pass this check while leaving `=TRUE`, `=1`, `=yes` all silently off with
// no error anywhere. The explanatory note above the var in .env.example is
// the thing that prevents that, and nothing here checks the note.
//
// ONE CONVENTION FOR OPERAND ORDER (Sage, thread 4510c5c8): assertions here
// pin SHAPE, never operand order. The DEMO_MODE comparison already accepted
// `'true' === process.env.X` with the sides swapped; the DEMO_CONTENT
// disjunction below now does the same (`__DEV__ || DEMO_MODE` and
// `DEMO_MODE || __DEV__` are both green — commutative here, both operands
// boolean). A gate brittle on operand order teaches people to distrust it,
// and two rules read out of one gate means the third gets guessed.
//
// SCOPE — DEFINITIONS ONLY (same thread): this gate proves the constants
// are correctly DERIVED, and proves nothing about anyone consulting them.
// Sage ungated the FlowToggle, the skip-demo link and the demo-hive merge
// one at a time and this gate stayed green each time — correctly, by its
// own scope. The call sites are check-demo-content-callsites' subject.
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

const topLevelConst = (ast, name) => {
  for (const stmt of ast.program.body) {
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      if (d.id?.type === 'Identifier' && d.id.name === name) return d;
    }
  }
  return null;
};

const destructuredProcessEnvIn = (ast) => {
  const hits = [];
  walk(ast.program, (n) => {
    if (
      n.type === 'VariableDeclarator' &&
      n.id?.type === 'ObjectPattern' &&
      n.init?.type === 'MemberExpression' &&
      n.init.object?.type === 'Identifier' &&
      n.init.object.name === 'process' &&
      n.init.property?.type === 'Identifier' &&
      n.init.property.name === 'env'
    ) {
      hits.push(n.id.start);
    }
  });
  return hits;
};

// --- demoMode.js: the derivation itself -----------------------------------
// Retargeted from App.js when the constant moved (fizz/demo-content-flag);
// the assertion followed the constant rather than being deleted for green.
const constantsRel = 'src/constants/demoMode.js';
const constantsSrc = await readFile(path.join(ROOT, constantsRel), 'utf8');
const constantsAst = parse(constantsSrc, { sourceType: 'module', plugins: ['jsx'] });

const demoModeDecl = topLevelConst(constantsAst, 'DEMO_MODE');
check('demoMode.js declares a top-level DEMO_MODE const', Boolean(demoModeDecl), true);

const init = demoModeDecl?.init;
check('DEMO_MODE is not a bare literal', init?.type !== 'BooleanLiteral', true);
check('DEMO_MODE is a === comparison', init?.type === 'BinaryExpression' && init.operator === '===', true);

const sides = init?.type === 'BinaryExpression' ? [init.left, init.right] : [];
const memberSide = sides.find((s) => isProcessEnvMember(s, 'EXPO_PUBLIC_DEMO_MODE'));
const literalSide = sides.find((s) => s?.type === 'StringLiteral');
check('one side reads process.env.EXPO_PUBLIC_DEMO_MODE directly', Boolean(memberSide), true);
check("the other side is the string literal 'true'", literalSide?.value, 'true');

// --- demoMode.js: the DEMO_CONTENT disjunction ----------------------------
// The content half of the hazard. Shape-asserted (`__DEV__ || DEMO_MODE`,
// identifiers on both sides) rather than sampled: an inline expression is
// pinned exactly by its AST, and any other shape — a literal, a lone
// `__DEV__`, a re-read of process.env — is a different gate than the one
// the three build profiles were enumerated against.
const demoContentDecl = topLevelConst(constantsAst, 'DEMO_CONTENT');
check('demoMode.js declares a top-level DEMO_CONTENT const', Boolean(demoContentDecl), true);

const dcInit = demoContentDecl?.init;
check('DEMO_CONTENT is a || disjunction', dcInit?.type === 'LogicalExpression' && dcInit.operator === '||', true);
check('DEMO_CONTENT operands are __DEV__ and DEMO_MODE, identifiers, either order',
  dcInit?.type === 'LogicalExpression'
    ? [dcInit.left, dcInit.right]
        .map((s) => (s?.type === 'Identifier' ? s.name : null))
        .sort()
    : null,
  ['DEMO_MODE', '__DEV__']);

check('no destructured `const { X } = process.env` in demoMode.js',
  destructuredProcessEnvIn(constantsAst), []);

// --- App.js: consumes the constant, never re-derives it -------------------
// The circular-import pressure runs the other way — a screen needing
// DEMO_MODE and importing App.js — but the regression this catches is
// someone "fixing" a demo bug by re-hardcoding `const DEMO_MODE = true` in
// App.js, which would shadow the derivation for the two routing behaviours.
const appSrc = await readFile(path.join(ROOT, 'App.js'), 'utf8');
const appAst = parse(appSrc, { sourceType: 'module', plugins: ['jsx'] });

const demoModeImport = appAst.program.body.find(
  (stmt) =>
    stmt.type === 'ImportDeclaration' &&
    stmt.source.value === './src/constants/demoMode' &&
    stmt.specifiers.some(
      (sp) => sp.type === 'ImportSpecifier' && sp.imported?.name === 'DEMO_MODE',
    ),
);
check('App.js imports DEMO_MODE from ./src/constants/demoMode', Boolean(demoModeImport), true);
check('App.js declares no top-level DEMO_MODE of its own (line, or null)',
  topLevelConst(appAst, 'DEMO_MODE')?.loc.start.line ?? null, null);

check('no destructured `const { X } = process.env` in App.js',
  destructuredProcessEnvIn(appAst), []);

// --- eas.json: read the file that owns the per-profile values -------------
const eas = JSON.parse(await readFile(path.join(ROOT, 'eas.json'), 'utf8'));
check('development profile sets no EXPO_PUBLIC_DEMO_MODE (absent -> false)',
  eas.build?.development?.env?.EXPO_PUBLIC_DEMO_MODE, undefined);
check('preview profile sets EXPO_PUBLIC_DEMO_MODE "true"',
  eas.build?.preview?.env?.EXPO_PUBLIC_DEMO_MODE, 'true');
check('production profile sets EXPO_PUBLIC_DEMO_MODE "false"',
  eas.build?.production?.env?.EXPO_PUBLIC_DEMO_MODE, 'false');

// --- .env.example lists the var --------------------------------------------
const envExample = await readFile(path.join(ROOT, '.env.example'), 'utf8');
check('.env.example lists EXPO_PUBLIC_DEMO_MODE',
  /^EXPO_PUBLIC_DEMO_MODE=/m.test(envExample), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
