// Gate for §23.1 — EMPTY IS A POSITIVE CLAIM (src/components/LoadState.js).
//
//   npm run check:load-state
//
// WHY THIS IS EXECUTED AND NOT GREPPED.
//
// The defect §23 exists to close is not a spelling. It is that three shipped
// screens render `empty` off a bare `length === 0`, so a failed load and a
// successful one draw the same pixels. `resolveListView` is the one function
// that makes that unreachable, and a source check on the screens can only ever
// prove they *call* it. What the call is worth is a property of this function,
// so this runs it — over the whole (readState x rows-in-hand) product, not over
// the handful of pairs I happened to think of.
//
// No stubs, no seam, no Postgres, and therefore no skip path — the failure mode
// where a gate exits 0 because its dependency is missing cannot occur here by
// construction. That is a property of WHERE the rule lives: `utils/loadState.js`
// is plain JS with zero imports. It started inside the JSX component and moved
// out the moment I tried to gate it and Node refused to parse the file. The
// refusal was the finding — a rule that decides whether a screen may tell a user
// they have no friends should not be locked inside a module that needs a
// renderer to load.
//
// What this deliberately does NOT prove: that LoadState renders. There is no
// renderer in this repo. §4 reads the component's source and is labelled as one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { resolveListView, LOAD_STATES } = await import('../src/utils/loadState.js');

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label}\n         ${detail}`);
};
const eq = (label, got, want) =>
  got === want ? ok(label) : bad(label, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// The read outcomes a screen is allowed to be in, plus two it is not. The
// garbage entries are not padding: the whole hazard class is a fallthrough that
// treats an unrecognised outcome as a successful one.
const READ_OUTCOMES = [LOAD_STATES.LOADING, LOAD_STATES.READY, LOAD_STATES.UNKNOWN];
const NOT_OUTCOMES = ['failed', 'Ready', undefined, null, '', 0];
const COUNTS = [0, 1, 2, 50];
const VIEWS = new Set(Object.values(LOAD_STATES));

// ---------------------------------------------------------------------------
console.log('\n  §1 — the invariant, over the whole product rather than a sample');

// This is the rule in one line. Everything else in this file is a consequence
// of it, and this is the assertion that would go red if someone "simplified"
// the function back into the habit it replaced.
{
  const offenders = [];
  for (const state of [...READ_OUTCOMES, ...NOT_OUTCOMES]) {
    for (const count of COUNTS) {
      const view = resolveListView(state, count);
      if (view === LOAD_STATES.EMPTY && state !== LOAD_STATES.READY) {
        offenders.push(`(${JSON.stringify(state)}, ${count})`);
      }
    }
  }
  eq(
    'EMPTY is returned ONLY from a read that returned — all 40 pairs',
    offenders.join(', '),
    ''
  );
}

// §23.1a. A failed re-read must never destroy content the user is holding —
// the failure gets a line above the list, not the list's place.
{
  const offenders = [];
  for (const state of [...READ_OUTCOMES, ...NOT_OUTCOMES]) {
    for (const count of COUNTS.filter((c) => c > 0)) {
      const view = resolveListView(state, count);
      if (view !== LOAD_STATES.READY && view !== LOAD_STATES.STALE) {
        offenders.push(`(${JSON.stringify(state)}, ${count}) -> ${view}`);
      }
    }
  }
  eq('holding rows is never blanked, whatever the read did (§23.1a)', offenders.join(', '), '');
}

// Totality. A function that can return undefined has a fourth failure mode
// nobody wrote a branch for.
{
  const offenders = [];
  for (const state of [...READ_OUTCOMES, ...NOT_OUTCOMES]) {
    for (const count of COUNTS) {
      const view = resolveListView(state, count);
      if (!VIEWS.has(view)) offenders.push(`(${JSON.stringify(state)}, ${count}) -> ${JSON.stringify(view)}`);
    }
  }
  eq('every pair lands on a declared state, none on undefined', offenders.join(', '), '');
}

// ---------------------------------------------------------------------------
console.log('\n  §2 — each cell of the table, named');

eq('nothing in hand, read in flight -> the takeover spinner', resolveListView(LOAD_STATES.LOADING, 0), LOAD_STATES.LOADING);
eq('rows in hand, read in flight -> ready, NOT a spinner over content', resolveListView(LOAD_STATES.LOADING, 3), LOAD_STATES.READY);
eq('nothing in hand, read returned -> empty', resolveListView(LOAD_STATES.READY, 0), LOAD_STATES.EMPTY);
eq('rows in hand, read returned -> ready', resolveListView(LOAD_STATES.READY, 3), LOAD_STATES.READY);
eq('nothing in hand, read failed -> unknown', resolveListView(LOAD_STATES.UNKNOWN, 0), LOAD_STATES.UNKNOWN);
eq('rows in hand, read failed -> stale, not unknown', resolveListView(LOAD_STATES.UNKNOWN, 3), LOAD_STATES.STALE);

// The one that is the whole product in miniature: same rows, different read
// outcome, different screen. Before §23 these two were the same pixels.
{
  const failed = resolveListView(LOAD_STATES.UNKNOWN, 0);
  const succeeded = resolveListView(LOAD_STATES.READY, 0);
  eq('a failed load and a successful empty one are DISTINGUISHABLE', failed !== succeeded, true);
}

// ---------------------------------------------------------------------------
console.log('\n  §3 — an unrecognised read outcome fails safe');

// Found by writing this gate, not by review. The original fallthrough was
// `return holding ? READY : EMPTY`, so ANY state string that was not exactly
// UNKNOWN or LOADING asserted emptiness — a typo in a setter, a state added
// later and not handled here, and the screen tells the user they have no
// friends on the strength of a read whose outcome it does not know.
//
// The safe direction is not a matter of taste: `unknown` is by construction the
// state that claims nothing about the user's data, so it is the only honest
// landing place for "I do not know how that read ended."
for (const junk of NOT_OUTCOMES) {
  eq(`${JSON.stringify(junk)} with nothing in hand -> unknown, never empty`, resolveListView(junk, 0), LOAD_STATES.UNKNOWN);
}
eq('...and with rows in hand -> stale, keeping the content', resolveListView('failed', 4), LOAD_STATES.STALE);

// ---------------------------------------------------------------------------
console.log('\n  §4 — source checks (labelled: these prove wiring, not behaviour)');

const src = fs.readFileSync(path.join(ROOT, 'src/components/LoadState.js'), 'utf8');

// The file's header promises that no copy ships from inside it — §23.3's draft
// wording is marked "to be replaced, not shipped", and a default parameter is
// exactly how a placeholder ships anyway. A promise in a comment is worth what
// it is checked at.
const slots = ['title', 'body', 'actionLabel', 'staleLabel', 'staleActionLabel', 'retryAccessibilityLabel'];
for (const slot of slots) {
  eq(`no default copy for \`${slot}\` — Deezine's words, not mine`, new RegExp(`\\n\\s*${slot}\\s*=`).test(src), false);
}

// §23.4 — "do not invent a third indicator". loading/ready/empty return null and
// the screen renders its own; this component's subject is the two states that
// did not exist before it.
eq('the component renders nothing for a state that is not stale or unknown', /state !== LOAD_STATES\.UNKNOWN\) return null/.test(src), true);

// §23.3 — the tell is the ABSENCE of a wash. Every empty state in this app wears
// one, so if a wash token ever lands on this card it stops reading as different
// in kind and starts reading as differently worded.
eq('the unknown card wears no wash token', /emptyState(Yellow|Sky)|washYellow|washSky/.test(src), false);

console.log(`\ncheck-load-state: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
