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
//      structural marker. Paired with the capability guards in the modules
//      themselves, asserted two ways (Sage's read, thread 4510c5c8):
//
//        - services/devSettings is ENUMERATED, zero names: every method on
//          the DevSettings export must consult DEMO_CONTENT in its body.
//          Per-method is available here because the entire module is the
//          demo toggle — every accessor of the demo-only persisted key is
//          in scope by construction, so a clearOnboardingFlow written in
//          November is covered without anyone registering it. That premise
//          — the module is WHOLLY demo-only — is enforced by nothing but
//          this note (Sage, thread 4510c5c8), so the response to its red
//          is pre-authorised here: a non-demo setting does not belong in
//          devSettings. If one legitimately needs to live beside the flow
//          toggle, MOVE it to its own service — onboardingState.js is the
//          precedent and says so in its header — and never exempt it here.
//          An exemption is what this enumerator replaced.
//        - EntryStore.seedDemoData stays a NAMED entry: a demo capability
//          living in a module that is NOT dev-only, so nothing structural
//          marks it. That is the residual, stated.
//
//      Do NOT generalise the enumerator over DEV_ONLY_MODULES: measured
//      (Sage), the general form is red-on-correct-code — buildDemoEntries
//      in utils/demoSeed is a pure data builder, guarded at its caller
//      EntryStore.seedDemoData, and shouldn't consult the flag; covering
//      it would need an exemption, and an exemption is where the next
//      affordance hides. Deleting a capability guard deletes the file's
//      flag reference too, so the same mutation reds both layers.
//
//      Residuals, direction stated: (a) the MODULE list is itself named —
//      a NEW dev-only fixture module ships uncovered until listed here;
//      green-on-a-trap. (b) file-level "references the flag" is coarser
//      than per-read guarding — a file with one legitimate reference and a
//      second, unguarded affordance passes rule 3; rules 1/2 and the named
//      entries are what stand in front of that. This fired eleven minutes
//      after it was written (getOnboardingFlow, Pixel's review), and the
//      per-method enumerator below closes it for devSettings.js ONLY —
//      per-method was available there because the module is small and
//      wholly dev-only; Onboarding.js gets no such upgrade, so the
//      residual stands for every other file.
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
// One persisted key is TWO capabilities (Pixel's review, thread 4510c5c8):
// setOnboardingFlow's write outlives the gesture, and getOnboardingFlow is
// the read that decides what renders — the persisted value crosses build
// profiles (pitch and store builds share a bundle id), so a demo build's
// 'C' arrives in a production container this build never wrote. The gate's
// first version asserted the setter BY NAME and never asked who reads —
// the same what-to-look-at error one layer down. So devSettings is now
// ENUMERATED, not listed (Sage's read): every method on the DevSettings
// export must consult the flag, zero names, zero exemptions — a method
// nobody has written yet is already covered. Pinned to the
// `export const DevSettings = { ObjectMethod... }` shape on this tree — a
// property that isn't an ObjectMethod, or a reshaped export, reds this and
// extends it here: red-on-correct-code, never green-on-a-trap.
const devSettingsMethods = [];
const devSettingsNonMethodProps = [];
{
  const entry = parsed.find((p) => p.rel === 'src/services/devSettings.js');
  if (entry) {
    walkWithAncestry(entry.ast.program, (node) => {
      if (
        node.type !== 'VariableDeclarator' ||
        node.id.type !== 'Identifier' ||
        node.id.name !== 'DevSettings' ||
        node.init?.type !== 'ObjectExpression'
      ) return;
      for (const prop of node.init.properties) {
        if (prop.type === 'ObjectMethod' && !prop.computed && prop.key.type === 'Identifier') {
          let found = false;
          walkWithAncestry(prop.body, (n) => {
            if (n.type === 'Identifier' && n.name === FLAG) found = true;
          });
          devSettingsMethods.push({ name: prop.key.name, line: prop.loc.start.line, guarded: found });
        } else {
          devSettingsNonMethodProps.push(`src/services/devSettings.js:${prop.loc.start.line} ${prop.type}`);
        }
      }
    });
  }
}
check('walker control: the DevSettings export enumerates at least one method',
  devSettingsMethods.length > 0, true);
check('every DevSettings property is a plain ObjectMethod (the pinned shape — reshape reds here, extend the enumerator)',
  devSettingsNonMethodProps, []);
check(`every method on the DevSettings export consults ${FLAG} in its body (enumerated, zero names)`,
  devSettingsMethods.filter((m) => !m.guarded).map((m) => `src/services/devSettings.js:${m.line} ${m.name}`),
  []);

// seedDemoData is the seeding capability behind any button; it must consult
// the flag in its own body so a future caller with a neutral label is inert
// in a production build. NAMED, not enumerated — see the rule 3 header note
// for why EntryStore gets no enumerator (the module is not dev-only, and
// the general form over DEV_ONLY_MODULES reds on buildDemoEntries).
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
