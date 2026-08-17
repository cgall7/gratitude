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
// TWO ENUMERATORS AND A NAMED LIST — in strength order, weakest last:
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
//   3. NAMED, NOT ENUMERATED — stated plainly: the two entries below are a
//      LIST, and a list has the hole an enumerator closes. A new
//      non-self-identifying, non-demoHive affordance — a toggle with a
//      neutral label, a seeding call behind a "Fill sample entries" button
//      — is caught by NOTHING here, and this gate will read green while it
//      ships. Direction: green-on-a-trap. That residual is the price of
//      not inventing a semantic classifier for "demo-ness"; when a third
//      named entry shows up, that is the moment to look for the structural
//      property the three share.
//
//        a. FlowToggle (Onboarding.js): the A/B flow picker. Label text
//           ("Flow A"/"Flow B"/"Flow C") never says "demo", so rule 1 is
//           blind to it. Every <FlowToggle> JSX usage must be guarded.
//        b. EntryStore.seedDemoData: the capability behind CoreRitual's
//           gated button (demoSeed.js -> buildDemoEntries -> 180 days of
//           fabricated entries). Its call sites are hard to guard-check
//           lexically (the handler function sits outside the guarded JSX),
//           so it gets a REGISTRY instead: the files allowed to say the
//           name are pinned, and a new caller lands red for conscious
//           review rather than silently acquiring seeding. A rename of the
//           method evades this — rule 1 still covers the button's label,
//           nothing covers a renamed capability with a neutral caller.
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

// --- Named 3a: FlowToggle usages are guarded ------------------------------
const flowToggleUses = [];
const unguardedFlowToggles = [];
for (const { rel, ast } of parsed) {
  walkWithAncestry(ast.program, (node, ancestors) => {
    if (node.type !== 'JSXElement') return;
    const name = node.openingElement.name;
    if (name.type !== 'JSXIdentifier' || name.name !== 'FlowToggle') return;
    flowToggleUses.push(rel);
    if (!isUnderGuard(ancestors, FLAG)) {
      unguardedFlowToggles.push(`${rel}:${node.loc.start.line}`);
    }
  });
}
check('walker control: FlowToggle is rendered at least once', flowToggleUses.length > 0, true);
check(`every <FlowToggle> usage is inside a ${FLAG} guard`, unguardedFlowToggles, []);

// --- Named 3b: seedDemoData caller registry -------------------------------
// Guard-checking is the wrong instrument here (the handler that calls it is
// lexically outside the guarded JSX), so the assertion is narrower and
// honest about it: only these files may say the name, and a new one is a
// red demanding review, not a silent grant.
const SEED_CALLERS = ['src/screens/CoreRitual.js', 'src/services/EntryStore.js'];
const seedFiles = new Set();
for (const { rel, ast } of parsed) {
  walkWithAncestry(ast.program, (node) => {
    if (node.type === 'Identifier' && node.name === 'seedDemoData') seedFiles.add(rel);
  });
}
check('seedDemoData appears only in its registered files (CoreRitual, EntryStore)',
  [...seedFiles].sort(), SEED_CALLERS);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
