// Gate for One Door — the onboarding rebuild (PLANS/ONBOARDING_ONE_DOOR_SPEC.md,
// Lumen 2026-08-17, amended the same day).
//
//   npm run check:onboarding-flow
//
// WHY THIS EXISTS
//
// One Door collapsed nine screens and two forks into five beats, and added
// the app's first writer for Private Hives. Three of the properties it turns
// on cannot be seen by any existing gate, and two of them are the kind that
// fail silently — nobody watches a buffer not being written.
//
//   C6 (Sage, 2026-08-17). `AccountStep.handleSubmit` has three exits and,
//   before this change, only two of them flushed the buffered first entry.
//   The third — signUp returns no session, the confirm-your-email screen,
//   `onNext` straight to `finish()` — navigated away with the write never
//   performed, and the session-effect flush could not rescue it because it
//   is gated on still being ON the account step. That path is DORMANT, and
//   the thing keeping it dormant is not in this repository: production has
//   `mailer_autoconfirm: true`, a dashboard toggle, no diff, one person.
//   Turning email confirmation on before a public TestFlight arms it.
//
//   So a gate here cannot test the confirm-sent path's behaviour — the
//   condition that reaches it is unreachable from this tree. It asserts the
//   STRUCTURE that makes the path survivable instead.
//
// THE INVARIANT IS "NO EXIT MAY DROP THE BUFFER", NOT "EVERY EXIT MUST
// WRITE IT". That distinction is the whole design. The confirm-sent exit
// deliberately does not write: there is no session, which is the entire
// reason it exists. What makes it safe is that the buffer is DURABLE at
// COLLECTION time and the flush is fired by the SESSION'S ARRIVAL, from
// AuthContext, in whatever process is running when the user follows the
// link. So the three structural facts, each asserted separately:
//
//   (a) both collection sites write through to the durable store;
//   (b) the durable store actually reaches AsyncStorage from both;
//   (c) a flush fires from the session's arrival, outside the screen.
//
// Break any one and the confirm-sent path silently drops an answer again.
//
// WHY THE SPARK REGISTER IS IN HERE. B1–B3 moved into the prompt deck, and
// a spark is never rendered alone — CoreRitual composes it into
// `I am grateful for ${spark}.` So a spark that leads with a capital or a
// preposition lands as broken grammar the user has to repair. Measured over
// the deck before this change: 60/60 lowercase, 0/60 leading preposition —
// an invariant the deck already held and nothing enforced. The twelve new
// sparks arrived violating it 12/12, which is why it is enforced now.
// check-copy-rules cannot see this: it asks whether a word is forbidden,
// not whether a fragment composes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};
// Every assertion states WHAT WAS CHECKED, never the verdict — a name
// written for the passing case inverts its own meaning on failure.
const check = (label, actual, want) => {
  const a = JSON.stringify(actual);
  const w = JSON.stringify(want);
  if (a === w) ok(label);
  else bad(label, `got ${a}, want ${w}`);
};

const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');
const ast = async (rel) =>
  parse(await read(rel), { sourceType: 'module', plugins: ['jsx', 'typescript'] });

// Depth-first walk yielding every node.
const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((c) => walk(c, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
};

// Finds a named function/arrow declaration's body, by ROLE (the binding
// name it is declared under), never by an identifier that merely appears
// inside it.
const bodyOfBinding = (tree, name) => {
  let found = null;
  walk(tree.program, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    if (node.id?.type !== 'Identifier' || node.id.name !== name) return;
    const init = node.init;
    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
      found = init.body;
    }
  });
  return found;
};

// `Obj.method(` anywhere inside a subtree.
const callsMember = (subtree, objectName, propertyName) => {
  let found = false;
  walk(subtree, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (callee?.type !== 'MemberExpression') return;
    if (callee.object?.type !== 'Identifier' || callee.object.name !== objectName) return;
    if (callee.property?.type !== 'Identifier' || callee.property.name !== propertyName) return;
    found = true;
  });
  return found;
};

const onboardingSrc = await read('src/screens/Onboarding.js');
const onboarding = await ast('src/screens/Onboarding.js');
const pending = await ast('src/services/pendingOnboardingWrites.js');
const auth = await ast('src/contexts/AuthContext.js');

console.log('\n── A. one flow, five beats, nothing orphaned ──');

// The step constants are ENUMERATED off the source, never typed here: a
// gate that hardcodes the beats it expects passes by being blind to a beat
// that was added or removed.
const stepConsts = [];
walk(onboarding.program, (node) => {
  if (node.type !== 'VariableDeclarator') return;
  if (node.id?.type !== 'Identifier' || !/^STEP_[A-Z]+$/.test(node.id.name)) return;
  if (node.init?.type !== 'NumericLiteral') return;
  stepConsts.push({ name: node.id.name, value: node.init.value });
});

check('walker control: Onboarding.js declares at least one STEP_ constant', stepConsts.length > 0, true);
check(
  'the STEP_ constants are a contiguous run from 0 (a gap is a beat that cannot be reached by next())',
  stepConsts.map((s) => s.value).sort((a, b) => a - b),
  stepConsts.map((_, i) => i)
);

// Every declared beat must appear as a case in the controller's switch, or
// be the one the default arm serves. Otherwise a constant is a beat the
// flow declares and never renders.
const switchTests = [];
let defaultArms = 0;
walk(onboarding.program, (node) => {
  if (node.type !== 'SwitchStatement') return;
  for (const c of node.cases) {
    if (!c.test) defaultArms += 1;
    else if (c.test.type === 'Identifier') switchTests.push(c.test.name);
  }
});
const declared = stepConsts.map((s) => s.name);
const unrendered = declared.filter((n) => !switchTests.includes(n));
check(
  'walker control: the controller has exactly one switch with a default arm',
  defaultArms,
  1
);
check(
  'every declared STEP_ constant is either a case in the controller switch or the single one left to default',
  unrendered.length <= 1,
  true
);

// The forks are gone, and stay gone. Named for what they were: a flow
// letter and the module that persisted the choice.
check(
  'Onboarding.js imports no onboarding-flow persistence module (the forks are deleted, not disabled)',
  /from '\.\.\/services\/devSettings'/.test(onboardingSrc),
  false
);
const flowIdentifiers = [];
walk(onboarding.program, (node) => {
  if (node.type === 'Identifier' && /^(flow|initialFlow|isBeliefStep|BELIEF_START)$/.test(node.name)) {
    flowIdentifiers.push(node.name);
  }
});
check('Onboarding.js carries no flow-fork bindings', [...new Set(flowIdentifiers)], []);

console.log('\n── B. C6: no exit of AccountStep may drop the buffer ──');

// (a) Both collection sites write through to the durable store. Resolved
// by BINDING NAME through the handler the JSX passes, not by grepping the
// file for the store's name — a file-level mention proves nothing about
// which handler does the writing.
for (const [handler, method] of [
  ['handleSaveEntry', 'stashEntry'],
  ['handleAnswerWho', 'stashHive'],
]) {
  const body = bodyOfBinding(onboarding, handler);
  if (!body) {
    bad(
      `${handler} resolves to a function in Onboarding.js`,
      'binding not found or not a function — renamed? A row that cannot resolve its subject is a FAIL, not a pass'
    );
  } else {
    ok(`${handler} resolves to a function in Onboarding.js`);
    check(
      `${handler} calls PendingOnboardingWrites.${method} (the answer is durable at collection time)`,
      callsMember(body, 'PendingOnboardingWrites', method),
      true
    );
  }
}

// (b) The store reaches disk. Both stashers funnel through `write`, so the
// chain is asserted link by link — each link's subject is the name the
// PREVIOUS link resolved, never a typed string.
const persistBody = bodyOfBinding(pending, 'persist');
const writeBody = bodyOfBinding(pending, 'write');
check('pendingOnboardingWrites declares a persist helper', !!persistBody, true);
check('pendingOnboardingWrites declares a write helper', !!writeBody, true);
if (persistBody && writeBody) {
  check(
    'persist calls AsyncStorage.setItem (the buffer survives the process, which is the whole fix)',
    callsMember(persistBody, 'AsyncStorage', 'setItem'),
    true
  );
  let writeCallsPersist = false;
  walk(writeBody, (node) => {
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'persist') {
      writeCallsPersist = true;
    }
  });
  check('write reaches persist', writeCallsPersist, true);
}
for (const stasher of ['stashEntry', 'stashHive']) {
  let body = null;
  walk(pending.program, (node) => {
    if (node.type !== 'ObjectMethod' && node.type !== 'ObjectProperty') return;
    if (node.key?.type !== 'Identifier' || node.key.name !== stasher) return;
    body = node.type === 'ObjectMethod' ? node.body : node.value?.body;
  });
  if (!body) {
    bad(`${stasher} resolves to a method on the store`, 'not found — renamed or reshaped');
  } else {
    let callsWrite = false;
    walk(body, (node) => {
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'write') {
        callsWrite = true;
      }
    });
    check(`${stasher} reaches write (and therefore disk)`, callsWrite, true);
  }
}

// (c) The flush fires from the session's arrival, OUTSIDE the screen that
// collected the buffer. This is the leg that catches the confirm-sent exit:
// by the time that session exists, Onboarding is unmounted.
let authFlushSites = 0;
walk(auth.program, (node) => {
  if (node.type === 'CallExpression') {
    const c = node.callee;
    if (
      c?.type === 'MemberExpression' &&
      c.object?.type === 'Identifier' &&
      c.object.name === 'PendingOnboardingWrites' &&
      c.property?.type === 'Identifier' &&
      c.property.name === 'flush'
    ) {
      authFlushSites += 1;
    }
  }
});
check(
  'AuthContext flushes the pending writes when a session appears (the only leg that can reach the confirm-sent exit)',
  authFlushSites > 0,
  true
);

// And the screen must not hold a private second copy that shadows it.
const componentRefs = [];
walk(onboarding.program, (node) => {
  if (node.type !== 'VariableDeclarator') return;
  if (node.id?.type !== 'Identifier' || !/pending/i.test(node.id.name)) return;
  if (node.init?.type === 'CallExpression' && node.init.callee?.name === 'useRef') {
    componentRefs.push(node.id.name);
  }
});
check(
  'Onboarding.js holds no useRef buffer of its own (a ref cannot survive the unmount the confirm-sent exit causes)',
  componentRefs,
  []
);

console.log('\n── C. the two failures are not symmetric ──');

// flush() must report the two outcomes SEPARATELY, and the account screen
// must consume the hive half. A single boolean would collapse "rewrite it
// tomorrow" and "the name you gave is gone" into one word.
const pendingSrc = await read('src/services/pendingOnboardingWrites.js');
for (const key of ['entryFailed', 'hiveFailed']) {
  check(`flush()'s result carries ${key}`, new RegExp(`\\b${key}\\b`).test(pendingSrc), true);
}
// BOTH member-access node types. The first draft asked only for
// `MemberExpression` and went red on correct code: the call site reads
// `outcome?.hiveFailed`, which Babel parses as `OptionalMemberExpression` —
// a different node type in the same role. Matching a role by one of its
// node types is the same error as matching it by one of its names.
let readsHiveFailed = false;
walk(onboarding.program, (node) => {
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') return;
  if (node.property?.type === 'Identifier' && node.property.name === 'hiveFailed') readsHiveFailed = true;
});
check(
  'Onboarding.js reads .hiveFailed off the flush result (a failed hive write reaches a screen, not just a console)',
  readsHiveFailed,
  true
);

console.log('\n── D. the belief copy landed, and composes ──');

// prompts.js is dependency-free, so this is the real module, sampled over
// its domain — not a regex over its source.
const prompts = await import(path.join(ROOT, 'src/constants/prompts.js'));
const { DAILY_PROMPTS, FIRST_DAYS_PROMPTS, getDailyPrompt } = prompts;

check('walker control: the rotation deck is non-empty', DAILY_PROMPTS.length > 0, true);
check('the first-days deck has one prompt per belief screen (B1-B3)', FIRST_DAYS_PROMPTS.length, 3);

// Sample the FUNCTION over its domain rather than checking three literals:
// seniority 0..2 must come from the first-days deck, everything else and
// "cannot tell" must come from the rotation.
const anchor = new Date(2026, 7, 17);
const seniorityHits = [];
for (let d = 0; d < FIRST_DAYS_PROMPTS.length; d += 1) {
  if (getDailyPrompt(anchor, d) === FIRST_DAYS_PROMPTS[d]) seniorityHits.push(d);
}
check(
  'every seniority day inside the first-days deck returns that deck, in order',
  seniorityHits,
  FIRST_DAYS_PROMPTS.map((_, i) => i)
);
const fallthrough = [null, undefined, -1, 3, 4, 400, 1.5, '0'];
const wrongFallthrough = fallthrough.filter((v) => !DAILY_PROMPTS.includes(getDailyPrompt(anchor, v)));
check(
  'every seniority outside the deck (including unknown, negative and non-integer) falls through to the rotation',
  wrongFallthrough,
  []
);

// THE COMPOSITION CONTRACT. A spark is set into `I am grateful for ${spark}.`
// at CoreRitual.js and `I'm grateful for ${spark}.` in Onboarding.js, so it
// must be a lowercase noun phrase. Enumerated over BOTH decks — a rule that
// only covered the new deck would have missed the deck it was derived from.
const allSparks = [...DAILY_PROMPTS, ...FIRST_DAYS_PROMPTS].flatMap((p) => p.sparks ?? []);
check('walker control: the decks contribute sparks', allSparks.length > 0, true);
check(
  'no spark starts with a capital (it is composed mid-sentence, after "I am grateful for")',
  allSparks.filter((s) => /^[A-Z]/.test(s)),
  []
);
check(
  'no spark starts with a preposition (it is composed as the OBJECT of "for", not a phrase after it)',
  allSparks.filter((s) => /^(in|on|at|with|by|for|from|to|of)\b/i.test(s)),
  []
);
check(
  'every prompt carries at least one spark',
  [...DAILY_PROMPTS, ...FIRST_DAYS_PROMPTS].filter((p) => !p.sparks?.length).map((p) => p.question),
  []
);

console.log('\n── E. the progress map claims the length the flow has ──');

// A progress map is a claim about how much is left. Six cells over a
// five-beat flow says "five more to go" on the first screen of a flow with
// four, and draws two cells nothing can ever fill.
const mapAst = await ast('src/components/HoneycombJourneyMap.js');
let stageOrder = null;
let stageLabels = null;
walk(mapAst.program, (node) => {
  if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
  if (node.init?.type !== 'ArrayExpression') return;
  const values = node.init.elements.map((e) => (e?.type === 'StringLiteral' ? e.value : null));
  if (values.some((v) => v === null)) return;
  if (node.id.name === 'STAGE_ORDER') stageOrder = values;
  if (node.id.name === 'STAGE_LABELS') stageLabels = values;
});
check('walker control: STAGE_ORDER resolves to a literal array of strings', Array.isArray(stageOrder), true);
if (stageOrder) {
  check('STAGE_ORDER has one cell per declared beat', stageOrder.length, stepConsts.length);
  check('STAGE_LABELS pairs one-to-one with STAGE_ORDER', stageLabels?.length ?? -1, stageOrder.length);

  // Every stage a step actually asks for must exist in the map, or that
  // step silently renders cell 0 as current (indexOf -> -1 -> clamped to 0).
  const requestedStages = [...onboardingSrc.matchAll(/stage="([a-z]+)"/g)].map((m) => m[1]);
  check('walker control: Onboarding.js requests at least one stage', requestedStages.length > 0, true);
  check(
    'every stage Onboarding.js requests exists in STAGE_ORDER (an unknown stage silently lights cell 0)',
    [...new Set(requestedStages)].filter((s) => !stageOrder.includes(s)),
    []
  );
}

console.log(`\ncheck-onboarding-flow: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
