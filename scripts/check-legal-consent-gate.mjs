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
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

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
const legalSource = await readFile(path.join(ROOT, LEGAL), 'utf8');
check(
  `${LEGAL}'s isPublished still has the shape this gate mirrors`,
  legalSource.includes("typeof value === 'string' && value.trim() !== ''"),
  true
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
  true
);

// --- Row 2: the submit path actually depends on consent ---------------
check(
  `legal copy is unpublished, or \`canSubmit\` requires \`${CONSENT_BINDING}\``,
  READY === false || (canSubmitNames !== null && canSubmitNames.has(CONSENT_BINDING)),
  true
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
