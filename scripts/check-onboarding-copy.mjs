// Gate for the onboarding flow (src/screens/Onboarding.js).
//
//   npm run check:onboarding
//
// Onboarding copy is the only copy in the app that is frozen by a human
// ruling rather than by taste (GUIDES/GRATITUDE_ONBOARDING_GIVEN_COPY.md,
// R15 + R56). Those rulings were written into a comment above BELIEF_SCREENS,
// and a comment cannot fail. This asserts them.
//
// Predecessor: .scratch/onboarding-gate.js, which was never tracked — it
// proved the commit it was run against and guarded nothing afterwards. Three
// things changed in the promotion:
//
//   1. COPY IS EXTRACTED FROM THE AST, NOT BY REGEX. The old version scraped
//      string literals with a regex and then filtered out lines starting with
//      "//" to avoid matching its own documentation. Parsing properly makes
//      that whole class of problem disappear: comments are not in the tree, so
//      a rule can be *described* in a comment and *enforced* here using the
//      same words, with no risk of the description tripping the enforcement.
//   2. BELIEF COUNT IS READ, NOT ASSUMED. The old version hardcoded 3 belief
//      screens. Adding a fourth in R56 would have left it asserting a step
//      walkthrough that no longer matched the app while still printing "ok".
//   3. FLOW C IS DETECTED, NOT ASSUMED. Its fate is Colin's call as of
//      2026-08-13. The gate asserts Flow C's step math only if LockDemoStep
//      is still in the file, so it stays honest whichever way that lands.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'src/screens/Onboarding.js';
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const ast = parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? (pass += 1) : (fail += 1);
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  );
};

// --- Walk the tree once, collecting what we need --------------------------

const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => walk(c, visit));
    else if (child && typeof child.type === 'string') walk(child, visit);
  }
};

// Every string a user can actually read. Three sources: the BELIEF_SCREENS
// data, JSX text nodes, and placeholder attributes. Deliberately
// over-inclusive — a false positive here is a line worth re-reading anyway.
const copy = [];
let beliefScreens = null;
let hasLockDemo = false;

walk(ast, (node) => {
  if (
    node.type === 'VariableDeclarator' &&
    node.id?.name === 'BELIEF_SCREENS' &&
    node.init?.type === 'ArrayExpression'
  ) {
    beliefScreens = node.init.elements;
  }
  if (node.type === 'VariableDeclarator' && node.id?.name === 'LockDemoStep') {
    hasLockDemo = true;
  }
  if (node.type === 'JSXText') {
    const text = node.value.trim().replace(/\s+/g, ' ');
    if (text) copy.push(text);
  }
  if (
    node.type === 'JSXAttribute' &&
    node.name?.name === 'placeholder' &&
    node.value?.type === 'StringLiteral'
  ) {
    copy.push(node.value.value);
  }
});

const COPY_KEYS = new Set(['h1', 'bodyLg', 'label', 'cta', 'accent', 'caption']);
if (beliefScreens) {
  for (const screen of beliefScreens) {
    for (const prop of screen.properties ?? []) {
      if (COPY_KEYS.has(prop.key?.name) && prop.value?.type === 'StringLiteral') {
        copy.push(prop.value.value);
      }
    }
  }
}

check('BELIEF_SCREENS found', Array.isArray(beliefScreens), true);
check('copy strings extracted', copy.length > 20, true);

// --- 1. Step math, mirroring the controller -------------------------------

const BELIEF_START = 1;
const BELIEF_COUNT = beliefScreens?.length ?? 0;
const [STEP_NAME, STEP_MOMENT, STEP_ENTRY, STEP_CELEBRATION, STEP_ACCOUNT] = [0, 1, 2, 3, 4];

const screenAt = (flow, step) => {
  const sharedOffset = flow === 'B' ? BELIEF_START + BELIEF_COUNT : BELIEF_START;
  const isBelief = flow === 'B' && step >= BELIEF_START && step < BELIEF_START + BELIEF_COUNT;
  if (step === 0) return 'welcome';
  if (isBelief) return `belief${step - BELIEF_START + 1}`;
  switch (step - sharedOffset) {
    case STEP_NAME: return 'name';
    case STEP_MOMENT: return 'moment';
    case STEP_ENTRY: return 'entry';
    case STEP_CELEBRATION: return 'celebration';
    default: return 'account';
  }
};

const walkFlow = (flow, n) => Array.from({ length: n }, (_, i) => screenAt(flow, i));

const beliefNames = Array.from({ length: BELIEF_COUNT }, (_, i) => `belief${i + 1}`);
const bOrder = walkFlow('B', BELIEF_START + BELIEF_COUNT + 5);
check(
  'Flow B walkthrough',
  bOrder.join(' > '),
  ['welcome', ...beliefNames, 'name', 'moment', 'entry', 'celebration', 'account'].join(' > ')
);

// Honeycomb's "Finish signup" / "Sign in" deep link jumps straight here.
check(
  'Flow B startAt=signup lands on account',
  screenAt('B', BELIEF_START + BELIEF_COUNT + STEP_ACCOUNT),
  'account'
);

// The R15 restructure: the account ask must come AFTER the activation moment
// (§5), never in front of it. This is the assertion that flow exists for.
check('account comes after entry (B)', bOrder.indexOf('account') > bOrder.indexOf('entry'), true);
check(
  'celebration comes before account (B)',
  bOrder.indexOf('celebration') < bOrder.indexOf('account'),
  true
);

// Flow C only if it still exists — see header note 3.
if (hasLockDemo) {
  const cOrder = walkFlow('C', BELIEF_START + 5);
  check(
    'Flow C walkthrough',
    cOrder.join(' > '),
    'welcome > name > moment > entry > celebration > account'
  );
  check('account comes after entry (C)', cOrder.indexOf('account') > cOrder.indexOf('entry'), true);
} else {
  console.log('ok   Flow C absent — LockDemoStep removed, step math not asserted');
  pass += 1;
}

// --- 2. Copy gate: register (R15) -----------------------------------------

const hitsFor = (words) => {
  const hits = [];
  for (const word of words) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    for (const line of copy) if (re.test(line)) hits.push(`${word} → "${line}"`);
  }
  return hits;
};

// Colin, 2026-08-11. "hallelujah" is in this list on his explicit
// instruction: it names the register we are aiming at and must never be a
// word on screen. Naming it in this comment is safe — see header note 1.
check(
  'no forbidden religious word in copy',
  hitsFor([
    'God', 'Jesus', 'Lord', 'pray', 'scripture', 'church',
    'faith', 'blessed', 'worship', 'sin', 'hallelujah',
  ]).join('; '),
  ''
);

// Colin hates this word (2026-08-10). The JourneyMap's internal
// stage="ritual" key is a prop, never rendered text, so it is not copy and
// correctly does not reach this list.
check('no "ritual" in copy', hitsFor(['ritual']).join('; '), '');

// The four clinical claim screens R15 replaced. If any comes back as copy,
// someone has reverted the flow rather than edited it.
check(
  'retired clinical claims stay retired',
  hitsFor(['quiets down', 'bounce back']).join('; '),
  ''
);

// --- 3. Copy gate: no unshippable promises (R56) ---------------------------

// The rule: the onboarding pitch may not describe a feature the app does not
// have. Onboarding is the one screen set where this is expensive — a Slice 1
// tester reads it before they have any idea what the app does, so a false
// line there sends them hunting for a button that isn't there, and we lose
// the feedback the slice exists to collect.
//
// Each parked feature gets a flag below. Flipping one to true is the LAST
// step of shipping that feature, and the beat that pitches it is a timed
// INSERT after belief beat 3 — the shipped beats stay a complete argument
// without it, so a launch extends this flow and never re-times it.
//
// Both of these were caught in review rather than by this script, which is
// the reason the script now exists in this shape:
//   - money: ruled out in the same pass that wrote the pitch;
//   - seeds: Deezine caught it in the belief beat, and chasing the same
//     words through the rest of the file turned up a second site in the
//     Welcome subhead that nobody had looked at. Hence a word list applied
//     to ALL copy, rather than a review of the beat that prompted it.
const PAYMENTS_SHIPPED = false;
const SEEDS_SHIPPED = false; // scheduled/sealed delivery; no such column exists

if (!PAYMENTS_SHIPPED) {
  check(
    'no money promise while payments are parked',
    hitsFor([
      'tip', 'tips', 'money', 'cash', 'dollars?', 'sats', 'satoshis?',
      'balance', 'wallet', 'nectar', 'payment', 'paid',
    ]).join('; '),
    ''
  );
} else {
  console.log('ok   PAYMENTS_SHIPPED=true — money copy permitted');
  pass += 1;
}

if (!SEEDS_SHIPPED) {
  // "seal" also covers "sealed"; \b makes "plant" miss "planted", so both.
  check(
    'no scheduled-delivery promise while Seeds is unbuilt',
    hitsFor([
      'seal', 'sealed', 'plant', 'planted', 'seeds?', 'bloom',
      'scheduled?', 'unlocks?', 'a day you choose',
    ]).join('; '),
    ''
  );
} else {
  console.log('ok   SEEDS_SHIPPED=true — scheduled-delivery copy permitted');
  pass += 1;
}

// --- 4. The thesis has to actually be on screen ---------------------------

// R56: given -> from someone -> tell them. Beats 1 and 2 are the belief,
// beat 3 is the product. Assert both halves are present, so nobody can
// quietly delete the product half and leave a journal pitch behind (which is
// exactly the state this branch found).
//
// A caution earned the hard way. The first version of this section asserted
// `product half present: seeds` — this gate, whose entire job is to stop the
// app promising things it can't do, contained an assertion that REQUIRED one,
// and would have failed the build for removing it. A positive assertion is a
// claim about the product with the same standard of proof as the copy it
// guards: only assert a line must be present if the thing it describes is
// present in the repo. The two below are safe on that test — the given/turn
// beats describe no feature at all, and notes shipped on 2026-08-13.
const joined = copy.join(' | ');
check(
  'Welcome sends the line somewhere, not into a daily quota',
  /sent to the person it's about/.test(joined),
  true
);
check(
  'the old journal promise is gone',
  /One line a day\. That's the whole thing\./.test(joined),
  false
);
check('belief half present: the given', /it arrived anyway/.test(joined), true);
check('belief half present: the turn to people', /came from someone/.test(joined), true);
check('product half present: notes', /lands on their phone/.test(joined), true);
check('entry placeholder carries the thesis', /Today I was given/.test(joined), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
