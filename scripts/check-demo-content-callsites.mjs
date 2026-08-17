// Gate for the APPLICATION of DEMO_CONTENT — the call sites, not the
// constants (Sage, thread 4510c5c8).
//
//   npm run check:demo-content-callsites
//
// WHY THIS EXISTS
//
// check-demo-mode-env pins how DEMO_MODE and DEMO_CONTENT are DERIVED, and
// it is genuinely strong about that: six definition-side mutations all land
// red. Sage then mutated the call sites instead — replaced the guard on the
// FlowToggle with `true`, ungated the skip-demo link, ungated
// HoneycombTab's demo-hive merge — and the whole suite stayed green, 18
// gates, 457/457. A flag can be perfectly derived and never consulted:
// same shape as check-modal-dismiss one layer up (a handler wired but not
// reachable; here a constant derived but not applied). This gate asserts
// the constants are USED, so the fix cannot reopen in one line unnoticed.
//
// THREE ENUMERATORS AND A NAMED LIST — in strength order, weakest last:
//
//   1. RENDERED-STRING RULE (structural, scales): any rendered string
//      matching /demo/i must sit inside a DEMO_CONTENT guard. The two
//      affordances that say the word — CoreRitual's "Load demo data",
//      Onboarding's "Skip to the logged-in view (demo)" — are caught by
//      what they SAY, so the demo affordance somebody adds in November is
//      covered without anyone registering it, as long as it names itself.
//      Extraction is scripts/lib/rendered-strings.mjs, shared with the
//      copy gate (one walker, two questions) — its header states what
//      counts as rendered and the exclusions' directions.
//
//   2. DEMO-DATA IMPORT RULE (structural, scales): every reference to a
//      binding imported from constants/demoHive must sit inside a
//      DEMO_CONTENT guard. demoHive is the fabricated-share fixture; an
//      ungated read of it IS the defect (fabricated strangers in a real
//      tester's feed), whatever the surrounding code calls itself. Covers
//      HoneycombTab's merge and any future importer, unregistered.
//
//   3. DEV-ONLY IMPORT RULE (structural over a named module list): every
//      file importing a dev-only module (services/devSettings,
//      utils/demoSeed, constants/demoHive) must reference DEMO_CONTENT
//      outside its imports. This replaced the original seedDemoData caller
//      REGISTRY after Sage found the structural property the named entries
//      share (thread 4510c5c8): demo affordances are HANDLER-bound — the
//      function sits lexically beside the JSX, never inside the guard — so
//      widening any string universe can't reach them, but the capability
//      they invoke lives in a nameable module, and importing one is the
//      structural marker. Paired with the capability guards IN
//      setOnboardingFlow and seedDemoData (each no-ops unless
//      DEMO_CONTENT), which this gate also asserts by name: deleting a
//      capability guard deletes the file's flag reference too, so the same
//      mutation reds both layers. Zero exemptions — that matters, because
//      an exemption is where the next affordance hides.
//
//      Residuals, direction stated: (a) the MODULE list is itself named —
//      a NEW dev-only fixture module ships uncovered until listed here;
//      green-on-a-trap. (b) file-level "references the flag" is coarser
//      than per-read guarding — a file with one legitimate reference and a
//      second, unguarded affordance passes rule 3; rules 1/2 and the named
//      entries are what stand in front of that.
//
//   4. NAMED, NOT ENUMERATED — these are a LIST, and a list has the hole
//      an enumerator closes. A demo affordance that never says "demo",
//      reads no demoHive data, and imports no dev-only module is caught by
//      NOTHING here; green-on-a-trap.
//
//        a. FlowToggle (Onboarding.js): the A/B flow picker. Label text
//           ("Flow A"/"Flow B"/"Flow C") never says "demo", so rule 1 is
//           blind to it. Every <FlowToggle> JSX usage must be guarded.
//        b. DevVersionTag (RecapTab.js): the fifth affordance (Pixel,
//           thread 4510c5c8) — its only rendered string is a version
//           number, its "demo" strings are Alert args rule 1 deliberately
//           excludes. Every <DevVersionTag> JSX usage must be guarded, so
//           production renders no five-tap picker surface at all; rule 3
//           and the capability guard sit behind it in depth.
//
// SELF-DELETING CONTROLS: the walker-control assertions below ("finds
// 'Load demo data'", "FlowToggle is used at least once", "some file
// imports demoHive") exist so a silently-broken extractor cannot report an
// empty universe as green. Their cost: legitimately REMOVING one of those
// features reds this gate. That red is authorisation to delete the
// corresponding control (and, for a removal, its named entry) in the same
// commit — this note is the sign-off, no thread required.
//
// GUARD SHAPES: isUnderGuard (lib) recognises `DEMO_CONTENT && x` and
// `DEMO_CONTENT ? x : y`'s consequent — the shapes on this tree. Anything
// else reds. Red-on-correct-code, never green-on-a-trap; extend the
// recogniser at the lib comment when a legitimate shape appears.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from '@babel/parser';
import {
  walkWithAncestry,
  collectRenderedStrings,
  isUnderGuard,
} from './lib/rendered-strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAG = 'DEMO_CONTENT';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// --- Enumerate the source universe: App.js + everything under src/ --------
const sourceFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
};

const files = ['App.js', ...(await sourceFiles(path.join(ROOT, 'src'))).map((p) => path.relative(ROOT, p))].sort();

// The runner cannot see an empty universe inside a gate (run-checks.mjs,
// "REQUIREMENT ON GATES"): assert the count before looping.
check('source universe is non-empty (App.js + src/**/*.js)', files.length > 0, true);

const parsed = [];
const parseFailures = [];
for (const rel of files) {
  try {
    const src = await readFile(path.join(ROOT, rel), 'utf8');
    parsed.push({ rel, ast: parse(src, { sourceType: 'module', plugins: ['jsx'] }) });
  } catch (e) {
    parseFailures.push(`${rel}: ${e.message}`);
  }
}
check('every enumerated file parses', parseFailures, []);

// --- Rule 1: rendered strings saying "demo" are guarded -------------------
const allStrings = [];
for (const { rel, ast } of parsed) {
  for (const s of collectRenderedStrings(ast)) allStrings.push({ rel, ...s });
}
check('rendered-string universe is non-empty', allStrings.length > 0, true);

const demoStrings = allStrings.filter((s) => /demo/i.test(s.value));
const unguardedDemoStrings = demoStrings
  .filter((s) => !isUnderGuard(s.ancestors, FLAG))
  .map((s) => `${s.rel}:${s.line} ${JSON.stringify(s.value)}`);
check(`every rendered string matching /demo/i is inside a ${FLAG} guard`, unguardedDemoStrings, []);

// Walker controls — a broken extractor must not read as "no violations".
check('walker control: finds "Load demo data" in CoreRitual.js',
  demoStrings.some((s) => s.rel === 'src/screens/CoreRitual.js' && s.value === 'Load demo data'), true);
check('walker control: finds the skip-demo link string in Onboarding.js',
  demoStrings.some((s) => s.rel === 'src/screens/Onboarding.js' && /skip to the logged-in view/i.test(s.value)), true);

// --- Rule 2: demoHive imports are read only under the guard ---------------
const DEMO_HIVE = /(^|\/)constants\/demoHive$/;
const hiveImporters = [];
const unguardedHiveReads = [];
for (const { rel, ast } of parsed) {
  const localNames = new Set();
  for (const stmt of ast.program.body) {
    if (stmt.type !== 'ImportDeclaration' || !DEMO_HIVE.test(stmt.source.value)) continue;
    for (const sp of stmt.specifiers) localNames.add(sp.local.name);
  }
  if (localNames.size === 0) continue;
  hiveImporters.push(rel);
  walkWithAncestry(ast.program, (node, ancestors) => {
    if (node.type !== 'Identifier' || !localNames.has(node.name)) return;
    if (ancestors.some((a) => a.node.type === 'ImportDeclaration')) return;
    const parent = ancestors[ancestors.length - 1];
    // Not a reference: `obj.demoHiveShares` property, `{ demoHiveShares: x }` key.
    if (parent?.node.type === 'MemberExpression' && parent.key === 'property' && !parent.node.computed) return;
    if (parent?.node.type === 'ObjectProperty' && parent.key === 'key' && !parent.node.computed) return;
    if (!isUnderGuard(ancestors, FLAG)) {
      unguardedHiveReads.push(`${rel}:${node.loc.start.line} ${node.name}`);
    }
  });
}
check('walker control: at least one file imports from constants/demoHive', hiveImporters.length > 0, true);
check(`every reference to a constants/demoHive import is inside a ${FLAG} guard`, unguardedHiveReads, []);

// --- Rule 3: dev-only module importers reference the flag -----------------
// Per-module controls, not one total (Pixel's M8 lesson, check-copy-rules
// §A: a universe can lose one member and the total still looks healthy):
// each module asserts its own importer count, so a module dropping out of
// the universe is a named red, not a silent shrink. Legitimately deleting
// one of these modules reds its control; per the SELF-DELETING CONTROLS
// note above, that red is authorisation to drop the list entry.
const DEV_ONLY_MODULES = [
  ['services/devSettings', /(^|\/)services\/devSettings$/],
  ['utils/demoSeed', /(^|\/)utils\/demoSeed$/],
  ['constants/demoHive', DEMO_HIVE],
];

const referencesFlagOutsideImports = (ast) => {
  let found = false;
  walkWithAncestry(ast.program, (node, ancestors) => {
    if (node.type !== 'Identifier' || node.name !== FLAG) return;
    if (ancestors.some((a) => a.node.type === 'ImportDeclaration')) return;
    found = true;
  });
  return found;
};

for (const [label, pattern] of DEV_ONLY_MODULES) {
  const importers = parsed.filter(({ ast }) =>
    ast.program.body.some(
      (stmt) => stmt.type === 'ImportDeclaration' && pattern.test(stmt.source.value)
    )
  );
  check(`walker control: at least one file imports ${label}`, importers.length > 0, true);
  check(
    `every importer of ${label} references ${FLAG} (no exemptions)`,
    importers.filter(({ ast }) => !referencesFlagOutsideImports(ast)).map(({ rel }) => rel),
    []
  );
}

// --- Rule 3's depth layer: the capability guards themselves ---------------
// setOnboardingFlow's write outlives the gesture (a persisted 'C' decides
// the flow forever after); seedDemoData is the seeding capability behind
// any button. Each must consult the flag in its own body, so a future
// caller with a neutral label is inert in a production build. Pinned to
// the ObjectMethod shape on this tree — a refactor to another shape reds
// this and extends it here, red-on-correct-code, never green-on-a-trap.
const methodReferencesFlag = (rel, methodName) => {
  const entry = parsed.find((p) => p.rel === rel);
  if (!entry) return 'file-missing';
  let method = null;
  walkWithAncestry(entry.ast.program, (node) => {
    if (node.type === 'ObjectMethod' && !node.computed && node.key.name === methodName) method = node;
  });
  if (!method) return 'method-missing';
  let found = false;
  walkWithAncestry(method.body, (node) => {
    if (node.type === 'Identifier' && node.name === FLAG) found = true;
  });
  return found;
};
check(`DevSettings.setOnboardingFlow consults ${FLAG} in its body`,
  methodReferencesFlag('src/services/devSettings.js', 'setOnboardingFlow'), true);
check(`EntryStore.seedDemoData consults ${FLAG} in its body`,
  methodReferencesFlag('src/services/EntryStore.js', 'seedDemoData'), true);

// --- Named 4a/4b: FlowToggle and DevVersionTag usages are guarded ---------
for (const componentName of ['FlowToggle', 'DevVersionTag']) {
  const uses = [];
  const unguarded = [];
  for (const { rel, ast } of parsed) {
    walkWithAncestry(ast.program, (node, ancestors) => {
      if (node.type !== 'JSXElement') return;
      const name = node.openingElement.name;
      if (name.type !== 'JSXIdentifier' || name.name !== componentName) return;
      uses.push(rel);
      if (!isUnderGuard(ancestors, FLAG)) {
        unguarded.push(`${rel}:${node.loc.start.line}`);
      }
    });
  }
  check(`walker control: ${componentName} is rendered at least once`, uses.length > 0, true);
  check(`every <${componentName}> usage is inside a ${FLAG} guard`, unguarded, []);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
