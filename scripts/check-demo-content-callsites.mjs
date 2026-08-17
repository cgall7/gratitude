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
//      counts as rendered and the exclusions' directions. This gate asks
//      it for the positions a lexical guard can reach; the exclusions and
//      their measured reasons are at the call site below.
//
//      SCOPE IS NOW STATED HERE RATHER THAN DECIDED THERE, and that alone
//      changed this rule's reach. The walker used to require the
//      JSXExpressionContainer to be a string's IMMEDIATE parent — a shape
//      only `{'a literal'}` has — so every string rendered through a
//      ternary was outside rule 1's universe. Measured at b5e7754:
//      105 strings before, 180 after, +74 of them conditional labels
//      (`{sending ? 'Sending…' : 'Send'}` and 72 more), nothing lost. The
//      /demo/i hits are the same 2 before and after, both guarded, so the
//      verdict did not move — the universe it is a verdict OVER did.
//
//   2. DEMO-DATA IMPORT RULE (structural, scales): every reference to a
//      binding imported from constants/demoHive must sit inside a
//      DEMO_CONTENT guard. demoHive is the fabricated-share fixture; an
//      ungated read of it IS the defect (fabricated strangers in a real
//      tester's feed), whatever the surrounding code calls itself. Covers
//      HoneycombTab's merge and any future importer, unregistered.
//
//   3. DEV-ONLY IMPORT RULE (structural over a named module list): every
//      file importing a dev-only module (utils/demoSeed,
//      constants/demoHive) must reference DEMO_CONTENT
//      outside its imports. This replaced the original seedDemoData caller
//      REGISTRY after Sage found the structural property the named entries
//      share (thread 4510c5c8): demo affordances are HANDLER-bound — the
//      function sits lexically beside the JSX, never inside the guard — so
//      widening any string universe can't reach them, but the capability
//      they invoke lives in a nameable module, and importing one is the
//      structural marker. Paired with the capability guards in the modules
//      themselves, asserted two ways (Sage's read, thread 4510c5c8):
//
//        - services/devSettings WAS enumerated per-method here. One Door
//          (PLANS/ONBOARDING_ONE_DOOR_SPEC.md) deleted the onboarding forks
//          and that module with them — it was wholly the flow toggle. Both
//          its rows are gone, per the self-deleting-controls note below.
//          The shape of the argument is worth keeping for the next one: a
//          per-method enumerator was available there only because the whole
//          module was demo-only, and that premise was enforced by a comment
//          rather than by code.
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
//      per-method enumerator that closed it for devSettings.js is gone
//      with that module, so this residual now stands for every file
//      without exception.
//
//   4. NAMED, NOT ENUMERATED — these are a LIST, and a list has the hole
//      an enumerator closes. A demo affordance that never says "demo",
//      reads no demoHive data, and imports no dev-only module is caught by
//      NOTHING here; green-on-a-trap.
//
//        a. DevVersionTag (RecapTab.js): the fifth affordance (Pixel,
//           thread 4510c5c8) — its only rendered string is a version
//           number, its "demo" strings are Alert args rule 1 deliberately
//           excludes. Every <DevVersionTag> JSX usage must be guarded, so
//           production renders no five-tap picker surface at all; rule 3
//           and the capability guard sit behind it in depth.
//
//           FlowToggle (Onboarding.js) was entry (a) until One Door deleted
//           it. It is the reason this list exists — its labels said "Flow
//           B"/"Flow C" and never "demo", so rule 1 was structurally blind
//           to it. Recorded because the hole it named is still open, even
//           though the example is gone.
//
// SELF-DELETING CONTROLS: the walker-control assertions below ("finds
// 'Load demo data'", "DevVersionTag is rendered at least once", "some file
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
  POSITIONS,
  walkWithAncestry,
  collectRenderedStrings,
  isUnderGuard,
  PositionVocabularyError,
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
// SCOPE IS AN EXCLUSION LIST, so a position added at the walker lands IN
// this rule by default (red-on-correct-code, never green-on-a-trap) and
// only leaves it by a deliberate edit here. The two exclusions share one
// structural property, which is the actual rule: A LEXICAL GUARD TEST CAN
// ONLY JUDGE A STRING A GUARD COULD LEXICALLY ENCLOSE.
//
//   alert     handler-bound. The Alert call sits beside the JSX, never
//             inside the wrapper. Measured at b5e7754 over this gate's own
//             universe: 4 /demo/i hits in `alert`, all 4 unguarded, and 2
//             of them false — CoreRitual's "Demo data loaded" and
//             "Couldn't load demo data" are the success and failure copy
//             of a seeding button that IS correctly gated. (Sage measured
//             3 before DevVersionTag gained a second alert string; the
//             ratio is what carries, not the count.) Rule 1 would red on
//             correct code to catch an affordance rules 3 and 4b already
//             cover in depth.
//   constant  module scope. A top-level literal has no enclosing
//             conditional to sit inside: 0 of 191 constant-position
//             strings are under a guard, and none could be. The demo
//             FIXTURE that lives there is covered structurally by rule 2,
//             which asks about imports rather than about words.
//
// AND THE INCLUSIONS ARE A JUDGEMENT, NOT A MEASUREMENT — worth stating
// because it is the weak joint. `jsx-expr` and `prop` hold ZERO guarded
// strings in this tree (0/75 and 0/45): no demo affordance has yet been
// written as a ternary label or a placeholder, so nothing here forces them
// into scope. They are in because the guard CAN reach them. That means no
// behavioural control can catch someone narrowing this list — the pin
// below is a tripwire, not a proof, and its job is to make a scope change
// cost a deliberate edit next to this reasoning, the way §D of the copy
// gate freezes ruled copy.
const RULE_1_OUT_OF_SCOPE = ['alert', 'constant'];
const RULE_1_POSITIONS = POSITIONS.filter((p) => !RULE_1_OUT_OF_SCOPE.includes(p));
const allStrings = [];
const vocabularyErrors = [];
for (const { rel, ast } of parsed) {
  try {
    for (const s of collectRenderedStrings(ast, { file: rel, positions: RULE_1_POSITIONS })) {
      allStrings.push({ rel, ...s });
    }
  } catch (e) {
    // Narrow, so the row's name stays true of everything it reports: parse
    // failures were already collected above, and anything else — a bad
    // argument at this call site — is a defect in the gate rather than in
    // the tree, and should die loudly instead of being renamed.
    if (!(e instanceof PositionVocabularyError)) throw e;
    vocabularyErrors.push(`${rel}: ${e.message}`);
  }
}
check('every position the collector emits is declared in POSITIONS', vocabularyErrors, []);
check('rendered-string universe is non-empty', allStrings.length > 0, true);
// The scope pin. Narrowing rule 1 means adding a position to the exclusion
// list, and this row reds naming it — both /demo/i controls below are
// jsx-text strings, so a gate narrowed to jsx-text alone would otherwise
// report a clean verdict over a universe it had quietly halved.
//
// THIS PINS THE SUBTRAHEND ONLY. Rule 1's universe is POSITIONS minus this
// list, and POSITIONS is pinned in check-copy-rules (section A, "the
// position vocabulary is exactly the five") — one literal, because that
// gate's universe is the whole vocabulary and this one's is a difference.
// Without that row, deleting a position from the walker's vocabulary AND
// its classifier leaves this pin reading `['alert','constant']`, still
// true, while the universe it subtracts from is 33% smaller (Sage,
// 257aa2f). Two halves of one sentence; the other half is over there.
check('rule 1 excludes exactly the positions no lexical guard can reach', RULE_1_OUT_OF_SCOPE, ['alert', 'constant']);

// One control per position asked for. This catches the WALKER failing to
// deliver a position this gate requested — it does NOT catch the gate
// asking for less, because the loop is derived from the same list; that is
// the pin's job, one row up. Two different failures, two instruments.
for (const position of RULE_1_POSITIONS) {
  check(
    `position "${position}" is represented in rule 1's universe`,
    allStrings.some((s) => s.position === position),
    true
  );
}

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
//
// `services/devSettings` WAS the first entry here. One Door deleted the
// onboarding forks (PLANS/ONBOARDING_ONE_DOOR_SPEC.md) and that module was
// wholly the flow toggle — one persisted key, two methods, no other reason
// to exist. Its control went red exactly as designed, and this is the drop
// the note above authorises: the subject is gone, so the row has nothing to
// assert. It is removed, not exempted — an exemption would leave a door for
// a future `services/devSettings` to walk back in ungated.
const DEV_ONLY_MODULES = [
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
// This layer used to enumerate every method on the DevSettings export and
// require each to consult the flag in its own body — zero names, so a
// method nobody had written yet was already covered (Sage's read: one
// persisted key is TWO capabilities, and the gate's first version asserted
// the setter BY NAME and never asked who reads).
//
// The subject is gone. One Door deleted services/devSettings.js outright,
// so the enumerator's own control ("the DevSettings export enumerates at
// least one method") went red with nothing behind it. The enumerator is
// removed rather than pointed somewhere else: it was written for a
// specific shape (`export const DevSettings = { ObjectMethod... }`) held by
// a specific module, and re-aiming a shape assertion at a different module
// is how a gate ends up asserting a property of whatever it can still
// reach. If another persisted demo capability is ever added, it gets its
// own enumerator, written against its own shape.

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

// --- Named 4a: DevVersionTag usages are guarded ---------------------------
// FlowToggle was the other member until One Door deleted it; its control
// went red with the component and the entry came out with it (see the
// self-deleting-controls note in the header). The loop shape stays — this
// list is expected to grow again, and a one-element loop costs nothing.
for (const componentName of ['DevVersionTag']) {
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
