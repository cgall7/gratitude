// Arms the ONE transition nobody is scheduled to notice (Sage, thread
// 4510c5c8; second clause from Pixel's review in the same thread).
//
//   npm run check:legal-consent-gate
//
// WHAT IS TRUE TODAY, AND IT IS A GOOD DECISION RATHER THAN A DEFECT.
// src/constants/legalCopy.js holds four FILL values — legal entity, contact
// address, hosting region, effective date — and every one is `null`. So the
// Privacy Policy and Terms render with placeholders ("[our legal name — to
// be named before launch]"), `LEGAL_COPY_READY` is false, and SignUpStep
// deliberately renders NO consent checkbox: requiring someone to tick "I
// agree" against a document that still reads as a draft is worse than
// having no checkbox at all. The links stay reachable so the gap is
// visible. That reasoning is written at Onboarding.js's `isSignUp &&` block
// and this gate does not second-guess it.
//
// THE PROBLEM IS THE TRANSITION, NOT THE STATE. On the day someone fills
// those four values before launch, `LEGAL_COPY_READY` flips to true, the
// document becomes publishable — and nothing happens. No checkbox appears,
// nothing reds, and the instruction to re-add it is a COMMENT inside a
// conditional in a 900-line file. We would ship a real Privacy Policy and
// Terms with no consent affirmation, and the only thing standing there is
// somebody remembering a comment they last read months earlier.
//
// So this gate is green in every state except the single one it exists for.
// It fires at the exact moment the decision becomes live, and re-adding the
// checkbox makes it green permanently: SELF-DELETING BY CONSTRUCTION, and
// there is no state in which an exemption would be the convenient fix.
// Contrast the `/nudge/i` instrument considered and killed in the same
// thread — that one was born needing an allowlist on day one.
//
// TWO ROWS, BECAUSE IMPORTING IS NOT GATING. The first draft asserted only
// that Onboarding.js imports the symbol, and Pixel caught that an import
// line satisfies it while changing nothing — the same class as this repo's
// own recurring finding (a guard wired but not reachable; a write guarded
// while the read is not). The realistic failure is mundane: on the day it
// fires, someone adds the import first and the checkbox second, and an
// import-only predicate goes green in between. Onboarding.js's own comment
// already names both clauses, which is why the second one is free:
//
//     "render the checkbox only when it is true. Gate on that symbol …"
//     "`canSubmit` must not require `agreedToTerms` while it is false."
//
// `canSubmit` is the sole choke point on the submit path — `handleSubmit`
// early-returns on it and the button's `disabled` reads it — so one
// assertion on its initialiser covers both routes.
//
// WHY ROW 2 IS ALSO GUARDED BY `READY === false`: the same comment says
// canSubmit must NOT require consent while the document is a draft. An
// unconditional row 2 would be red against correct code today.
//
// THE CONSENT BINDING IS NAMED, and the name is quoted from that comment
// rather than invented here. A rename reds row 2 and is extended at
// CONSENT_BINDING below — red-on-correct-code, never green-on-a-trap. The
// alternative, a regex over identifier names, is the predicate shape that
// produced this repo's `sin`/`single` and `we'll`/`well` false positives
// twice in one evening; a name that fails loudly beats a pattern that
// passes quietly.
//
// CANNOT-TELL IS A FAILURE, NOT A PASS. If `canSubmit` cannot be resolved,
// or a FILL `value` is an expression this gate cannot evaluate statically,
// the row fails and says so. A gate that cannot see the thing it guards
// must not report the same verdict as a gate that looked and found it fine.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { walkWithAncestry } from './lib/rendered-strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGAL = 'src/constants/legalCopy.js';
const ONBOARDING = 'src/screens/Onboarding.js';
const READY_SYMBOL = 'LEGAL_COPY_READY';
// Quoted from Onboarding.js's own re-add instruction. See the header.
const CONSENT_BINDING = 'agreedToTerms';

let pass = 0;
let fail = 0;
// `hint` prints ONLY on failure, and that separation is deliberate. The label
// states what was checked and nothing else — a name that carries a remedy
// drifts from its predicate, and it reads as nonsense on the `ok` line. The
// remedy belongs where somebody is actually looking, which is the red.
//
// It is here because the division of labour below (which rows are COMPLETE
// for their defect and which are two cheap rungs of another) was written in
// the header, and the person a red reaches sees one line and does not open
// the file (Sage, thread 4510c5c8). A rule nobody reads is not a rule.
const check = (label, got, want, hint) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok && hint) console.log(`     ↳ ${hint}`);
};

// The two sentences the header spends forty lines earning. Rows 1-2 are
// complete for the defect a running app cannot show you; rows 3-4 are the
// two cheapest rungs of one it shows you immediately.
const LEGAL_DEFECT =
  'THE LEGAL DEFECT: the policy is publishable and sign-up does not require consent. Fix this in code.';
const HALF_FINISHED =
  'The edit is half-finished. Finish it, then RUN THE APP and create an account — these rows do not prove consent is obtainable.';

const parseFile = async (rel) =>
  parse(await readFile(path.join(ROOT, rel), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });

const legalAst = await parseFile(LEGAL);
const onboardingAst = await parseFile(ONBOARDING);

// --- Is the document publishable? Evaluated statically, never imported. ---
// legalCopy.js throws at module scope by design when a FILL key is missing,
// and it pulls in nothing this gate could stand up in Node anyway. So the
// FILL object is read off the AST and `isPublished` is MIRRORED here — with
// the source predicate pinned below, so the mirror cannot drift silently.
let fillNode = null;
walkWithAncestry(legalAst.program, (node) => {
  if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    node.id.name === 'FILL' &&
    node.init?.type === 'ObjectExpression'
  ) fillNode = node.init;
});

check(`${LEGAL} declares a FILL object`, fillNode !== null, true);

// The mirror's licence. legalCopy.js's own header is emphatic that the copy
// and the publish flag must read through ONE predicate; this gate is a
// third reader, so it pins the shape it is mirroring. A change to
// isPublished reds here and is copied down, rather than the two drifting.
//
// Pinned on the AST NODE, not on the file's text. A substring match over
// source is satisfied by PROSE ABOUT the predicate as readily as by the
// predicate — and a refactor's most likely comment is the old expression
// quoted above the new one ("was: …"). That is this repo's own recurring
// defect (a gate row that went red on its own justifying comment, §28.9),
// and it is worth avoiding here specifically because this pin is the
// licence for a mirror: if it can pass while the source changed, the
// mirror drifts with the gate reporting that it hasn't.
const isPublishedInit = (() => {
  let found = null;
  walkWithAncestry(legalAst.program, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.id.name === 'isPublished' &&
      node.init
    ) found = node.init;
  });
  return found;
})();
const isPublishedSource =
  isPublishedInit && isPublishedInit.start != null
    ? (await readFile(path.join(ROOT, LEGAL), 'utf8')).slice(isPublishedInit.start, isPublishedInit.end)
    : null;
check(
  `${LEGAL}'s isPublished still has the shape this gate mirrors`,
  isPublishedSource,
  "(value) => typeof value === 'string' && value.trim() !== ''"
);

const fillEntries = [];
const unevaluatable = [];
for (const prop of fillNode?.properties ?? []) {
  if (prop.type !== 'ObjectProperty' || prop.computed || prop.key.type !== 'Identifier') {
    unevaluatable.push(`${prop.type} at ${LEGAL}:${prop.loc?.start.line}`);
    continue;
  }
  const value = prop.value.type === 'ObjectExpression'
    ? prop.value.properties.find((p) => p.type === 'ObjectProperty' && p.key?.name === 'value')
    : null;
  if (!value) {
    unevaluatable.push(`${prop.key.name} has no \`value\` property`);
    continue;
  }
  const v = value.value;
  if (v.type === 'StringLiteral') fillEntries.push({ key: prop.key.name, published: v.value.trim() !== '' });
  else if (v.type === 'NullLiteral' || (v.type === 'Identifier' && v.name === 'undefined')) {
    fillEntries.push({ key: prop.key.name, published: false });
  } else {
    // Cannot tell. Not a clean no.
    unevaluatable.push(`${prop.key.name}.value is a ${v.type}, which this gate cannot evaluate statically`);
  }
}

check('every FILL value is statically evaluatable (a value this gate cannot read is not a "no")', unevaluatable, []);
check('the FILL universe is non-empty', fillEntries.length > 0, true);

const READY = fillEntries.length > 0 && unevaluatable.length === 0 && fillEntries.every((e) => e.published);
console.log(
  `    (${READY_SYMBOL} = ${READY}; unpublished: ${
    fillEntries.filter((e) => !e.published).map((e) => e.key).join(', ') || 'none'
  })`
);

// A rename of the exported symbol would leave both rows below asserting
// about a name nothing produces, so it is checked rather than assumed.
check(
  `${LEGAL} exports ${READY_SYMBOL}`,
  legalAst.program.body.some(
    (s) =>
      s.type === 'ExportNamedDeclaration' &&
      s.declaration?.type === 'VariableDeclaration' &&
      s.declaration.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === READY_SYMBOL)
  ),
  true
);

// --- Row 0: canSubmit resolves. Unconditional, and it is the universe ---
// control for row 2: a refactor that renames this binding must red HERE,
// loudly, rather than quietly disarming the row that depends on it.
const canSubmitInits = [];
walkWithAncestry(onboardingAst.program, (node) => {
  if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    node.id.name === 'canSubmit' &&
    node.init
  ) canSubmitInits.push(node);
});
check(`${ONBOARDING} declares exactly one initialised \`canSubmit\``, canSubmitInits.length, 1);

const identifiersIn = (node) => {
  const names = new Set();
  if (!node) return names;
  walkWithAncestry(node, (n) => {
    if (n.type !== 'Identifier') return;
    names.add(n.name);
  });
  return names;
};

const canSubmitNames = canSubmitInits.length === 1 ? identifiersIn(canSubmitInits[0].init) : null;

// --- Row 1: the symbol is CONSULTED, not merely imported --------------
const readySites = [];
walkWithAncestry(onboardingAst.program, (node, ancestors) => {
  if (node.type !== 'Identifier' || node.name !== READY_SYMBOL) return;
  if (ancestors.some((a) => a.node.type === 'ImportDeclaration')) return;
  readySites.push(`${ONBOARDING}:${node.loc.start.line}`);
});

check(
  `legal copy is unpublished, or ${ONBOARDING} consults ${READY_SYMBOL} outside its imports`,
  READY === false || readySites.length > 0,
  true,
  LEGAL_DEFECT
);

// --- Row 2: the submit path actually depends on consent ---------------
check(
  `legal copy is unpublished, or \`canSubmit\` requires \`${CONSENT_BINDING}\``,
  READY === false || (canSubmitNames !== null && canSubmitNames.has(CONSENT_BINDING)),
  true,
  LEGAL_DEFECT
);

// --- Row 3: consent is OBTAINABLE, not merely required ----------------
//
// Rows 1 and 2 both push in one direction — "the submit path must consult
// consent" — and the end of that ladder is a state where nothing lets the
// user give it. Measured on this gate at 87b7a0d, walking the transition
// one edit at a time:
//
//   published, nothing else            row 1 RED    row 2 RED
//   + import only                      row 1 RED    row 2 RED
//   + a real consult of the symbol      row 1 GREEN  row 2 RED
//   + canSubmit requires the binding    row 1 GREEN  row 2 GREEN   ← and
//     with NO checkbox rendered                                      SIGNUP
//                                                                    IS DEAD
//
// `const [agreedToTerms] = useState(false)` with no control satisfies both
// rows and makes `canSubmit` permanently false for sign-up. The gate would
// report the transition complete on the one day it speaks, while nobody can
// create an account. A gate whose only possible utterance is a false
// all-clear is worse than one that stays red.
//
// The predicate needs no new name and no shape guess — it is ROW 1's OWN
// IDIOM applied to the second symbol: a rendered control necessarily
// references the binding again (a `value=`/`checked=` prop, or a toggle in
// an `onPress`), so requiring one reference beyond the declaration and
// beyond `canSubmit`'s initialiser separates "wired" from "reachable".
//
// Residual, stated: a reference that reads the binding without offering a
// way to change it (a stray log) satisfies this. That is a shape nobody
// writes on purpose, and unlike the lock-out it is not the natural
// half-finished state of the edit this gate exists to interrupt.
// EXCLUDED BY NODE IDENTITY, NOT BY NODE TYPE — and the difference is the
// whole row. The first draft excluded "anything under a VariableDeclarator",
// meaning to name two places; in this file every screen component is
// `const X = (props) => (…)`, so that ancestor test excludes EVERY
// identifier in the tree. It passed the lock-out mutation it was written
// for and failed the fixed future, which is the only reason it was caught:
// a row verified solely against the state it must red on has no evidence it
// can ever go green.
const excludedNodes = new Set();
if (canSubmitInits.length === 1) excludedNodes.add(canSubmitInits[0].init);
walkWithAncestry(onboardingAst.program, (node) => {
  // The binding site itself: `const [agreedToTerms, …] = …`. Only the `id`
  // side — an initialiser that mentions the binding is a real reference.
  if (node.type === 'VariableDeclarator' && node.id) {
    const ids = identifiersIn(node.id);
    if (ids.has(CONSENT_BINDING)) excludedNodes.add(node.id);
  }
});

const consentSites = [];
walkWithAncestry(onboardingAst.program, (node, ancestors) => {
  if (node.type !== 'Identifier' || node.name !== CONSENT_BINDING) return;
  if (ancestors.some((a) => excludedNodes.has(a.node))) return;
  consentSites.push(`${ONBOARDING}:${node.loc.start.line}`);
});

check(
  `legal copy is unpublished, or \`${CONSENT_BINDING}\` is reachable (referenced outside its declaration and \`canSubmit\`)`,
  READY === false || consentSites.length > 0,
  true,
  HALF_FINISHED
);

// --- Row 4: the control can CHANGE it, not merely display it ----------
//
// Row 3's stated residual was "a reference that reads the binding without
// offering a way to change it (a stray log) satisfies this — a shape nobody
// writes on purpose." Measured at e538d43, it is not a stray log; it is the
// ordinary build order, and it is the same half-finished edit as row 3's
// lock-out one rung later:
//
//   const [agreedToTerms] = useState(false);        // setter not added yet
//   …
//   <Switch value={agreedToTerms} />                // control rendered
//
// 9 passed, 0 failed, exit 0. Every row green, `agreedToTerms` permanently
// false, `canSubmit` permanently false for sign-up, the button never
// enables, `handleSubmit` early-returns — nobody can create an account, and
// the gate reports the transition complete. Building the control before
// wiring its handler is what everybody does; the value prop lands one edit
// before the change prop, and that is the window this row covers.
//
// STILL NO NEW NAME, and less guessing than row 3: the setter is not named
// here, it is READ OFF the binding site. `const [x, setX] = useState(…)` is
// an ArrayPattern; element 0 is CONSENT_BINDING and element 1 is whatever
// the setter is called. So a rename of the setter cannot drift from this
// row, and a destructure with no second element — the lock-out itself —
// fails for the right reason rather than by a name lookup missing.
//
// Two ways to fail, one row each, because they are different repairs:
// there is no setter to call, versus there is one and nothing calls it.
const setterNames = new Set();
let consentBindingSites = 0;
walkWithAncestry(onboardingAst.program, (node) => {
  if (node.type !== 'VariableDeclarator' || node.id?.type !== 'ArrayPattern') return;
  const [value, setter] = node.id.elements;
  if (value?.type !== 'Identifier' || value.name !== CONSENT_BINDING) return;
  consentBindingSites += 1;
  if (setter?.type === 'Identifier') setterNames.add(setter.name);
});

check(
  `legal copy is unpublished, or \`${CONSENT_BINDING}\` is destructured with a setter`,
  READY === false || (consentBindingSites > 0 && setterNames.size > 0),
  true,
  HALF_FINISHED
);

// A setter that exists and is never called is the same dead end reached by
// a different edit, so it gets its own row rather than being folded above.
const setterCallSites = [];
if (setterNames.size > 0) {
  walkWithAncestry(onboardingAst.program, (node, ancestors) => {
    if (node.type !== 'Identifier' || !setterNames.has(node.name)) return;
    // The binding site's own `id` side is the declaration, not a use.
    if (ancestors.some((a) => a.node.type === 'ArrayPattern')) return;
    setterCallSites.push(`${ONBOARDING}:${node.loc.start.line}`);
  });
}

check(
  `legal copy is unpublished, or ${CONSENT_BINDING}'s setter is referenced outside its declaration`,
  READY === false || setterCallSites.length > 0,
  true,
  HALF_FINISHED
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
