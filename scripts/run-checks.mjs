#!/usr/bin/env node
// Runs every gate in scripts/ and aggregates the results.
//
//   npm test
//
// Why this exists instead of the `&&` chain it replaced:
//
// `npm test` used to be `npm run check:a && npm run check:b && ...`. `&&`
// short-circuits, so the FIRST failing gate silently prevented every gate
// ordered after it from running at all. That is at its worst during exactly
// the window you most need the others: a branch with one deliberately-red
// gate (a fix that lands in a different PR, a rebase not taken yet) reports
// a red `npm test` that looks like it covers the suite, while the gates
// after it never executed. The exit code cannot distinguish "the one gate I
// expected to be red is red" from "eight gates did not run."
//
// Measured on this repo, one real defect injected into the first gate's
// source (a demo member name too long for its hex cell):
//
//   old && chain:  1 gate attempted,  exit 1
//   this runner:   9 gates attempted, 1 red, 8 green, exit 1
//
// Two further properties worth keeping:
//
//   1. It ENUMERATES the gates off disk (`scripts/check-*.mjs`) rather than
//      reading a hardcoded list. A check-list the runner has to be told
//      about has the exact hole a gate exists to close: adding
//      scripts/check-new.mjs and forgetting to wire it up produces a green
//      suite that never ran it. Nothing has to be registered here.
//   2. SKIPPED is its own verdict, not a pass. `SKIP_PG_GATES=1` turns the
//      Postgres-backed gates into no-ops that exit 0; folded into a pass
//      count that reads as "everything green" while three security gates did
//      not run. Skips are counted, named, and flagged separately below.
//   3. A gate that exits 0 having asserted NOTHING is red, not green. This
//      catches a gate going completely dark — most usefully a NEW quiet
//      bail-out path (no database, no fixture, flag off) that exits 0
//      without declaring itself a skip. The contract: every gate prints
//      `N passed, M failed`, and a run of it that asserts nothing is a
//      broken gate, not a passing one.
//   4. A SKIP must be one somebody ASKED for. See the skip rules below.
//
// WHAT THIS RUNNER CANNOT DO, since it is the obvious thing to assume it
// does: it reads each gate's totals, so it cannot see an empty universe
// INSIDE a gate. A gate that enumerates zero tables, or resolves zero call
// sites, and still passes its setup assertions reports `1 passed, 0 failed`
// and is green here — correctly, by the only information this file has.
// Rule 3 fires when a gate asserts nothing AT ALL, which is the rarest way
// an empty LOGIC universe shows up; every real instance in this repo so far
// had a gate with 10-34 assertions and one empty loop inside it.
//
// Completely dark is, however, exactly what an INFRASTRUCTURE failure looks
// like, and infrastructure fails on ordinary days for ordinary reasons — a
// stray process on the embedded-postgres port was enough. On that path rule
// 3 is redundancy and not the first line: a gate that dies exits non-zero
// and `code !== 0` has already caught it. Checked rather than assumed — the
// three PG gates each `process.exit(1)` from their harness catch, and the
// other six are top-level, where a throw exits non-zero on its own. So rule
// 3's real job is the gate whose catch logs and forgets to exit, in a branch
// that by definition only runs on days when something is already wrong.
//
//   >> Therefore, a REQUIREMENT ON GATES that this runner cannot enforce
//   >> for you: an enumerator must assert on its own count before it loops.
//   >> `if (tables.length === 0) bad(...)`. A gate is allowed to be green;
//   >> it is not allowed to be green and empty, and only the gate itself is
//   >> standing anywhere it can tell the difference.
//
// Exit code is 1 if any gate failed, 0 otherwise. Authorised skips do not
// fail the run — the opt-out is deliberate and documented — but they are
// impossible to miss in the summary.
//
// HOW TO READ THAT EXIT CODE, because this repo has now got it wrong three
// times in three different costumes and each one produced a published
// figure that was a different command's status:
//
//   node scripts/x.mjs | tail       -> `$?` is TAIL's status
//   printf '%s %s' "$(basename $1)" "$?"
//                                   -> command substitution expands BEFORE
//                                      `$?`, so the column reports basename
//   the runner's own summary row    -> this file's rendering of what the
//                                      gates said, not a status
//
// The only reading that is the thing itself: run the command, capture `$?`
// on its very next line, and print it on its own. Any figure quoted into a
// review should come from that and say so.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(SCRIPTS_DIR);

const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';

// Escapes only when there's something to render them. Piped to a file or a
// CI log this output is read as plain text, and raw escape bytes are noise.
const COLOR = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const c = (code, text) => (COLOR ? `[${code}m${text}[0m` : text);
const rule = (label) => c(1, `── ${label} ${'─'.repeat(Math.max(1, 56 - label.length))}`);

// --- Is an opt-out switched ON? ----------------------------------------
// Not `!== undefined`. `SKIP_PG_GATES=0` is somebody typing the variable's
// name in order to say NO, and merely-defined would read that as a yes —
// authorising the very skip the operator just switched off. The three real
// gates read `=== '1'`, so a runner using `!== undefined` is looser than the
// gates it is vouching for, which is the wrong way round for an
// authorisation check.
//
// Affirmative values are listed rather than negative ones excluded, so an
// unrecognised value fails CLOSED: `SKIP_PG_GATES=maybe` does not authorise
// anything, and a gate that skipped on it lands red saying so instead of
// going quietly green. A short list of literal values, not a registry of
// gates or variables — nothing has to be told about a new opt-out.
const AFFIRMATIVE = new Set(['1', 'true', 'yes', 'on']);
const isSet = (v) => AFFIRMATIVE.has(String(process.env[v] ?? '').trim().toLowerCase());

// --- Enumerate ---------------------------------------------------------
// Every scripts/check-*.mjs is a gate. This runner's own file deliberately
// does not match that pattern.
const gates = fs
  .readdirSync(SCRIPTS_DIR)
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
  .sort();

if (gates.length === 0) {
  // The same lower bound the gates themselves carry: an empty universe must
  // not report success. Zero gates found means the glob or the layout moved,
  // not that everything passed.
  console.error('run-checks: found no scripts/check-*.mjs — the suite is empty, which is a failure, not a pass.');
  process.exit(1);
}

// --- package.json alias drift ------------------------------------------
// The gates are run directly by this file, so the `check:*` npm scripts are
// convenience aliases for running one gate on its own. They still have to
// agree with what is on disk in both directions: an alias pointing at a
// deleted file is a broken command, and a gate with no alias cannot be run
// individually, which is how a gate stops being maintained.
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const aliases = Object.entries(pkg.scripts || {}).filter(([name]) => name.startsWith('check:'));
const driftErrors = [];

const referencedFile = (cmd) => (/scripts\/(check-[\w-]+\.mjs)/.exec(cmd) || [])[1];

for (const [name, cmd] of aliases) {
  const file = referencedFile(cmd);
  if (!file) {
    driftErrors.push(`package.json "${name}" does not run a scripts/check-*.mjs file: ${cmd}`);
  } else if (!gates.includes(file)) {
    driftErrors.push(`package.json "${name}" runs scripts/${file}, which does not exist`);
  }
}

const aliased = new Set(aliases.map(([, cmd]) => referencedFile(cmd)).filter(Boolean));
for (const gate of gates) {
  if (!aliased.has(gate)) {
    driftErrors.push(`scripts/${gate} has no "check:*" script in package.json — it runs here, but not on its own`);
  }
}

// --- Run ---------------------------------------------------------------
function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SCRIPTS_DIR, file)], {
      cwd: ROOT,
      env: process.env,
    });
    let out = '';
    // Streamed through as it arrives rather than buffered and replayed — the
    // Postgres gates take seconds each and a silent runner looks hung.
    child.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d;
      process.stderr.write(d);
    });
    child.on('error', (e) => resolve({ code: 1, signal: null, out: `${out}\nfailed to spawn: ${e.message}` }));
    // `code` is null when the child died on a SIGNAL. Coercing to 1 is right
    // for the VERDICT — a killed gate must be red — but it is a fabricated
    // number, so the signal is carried alongside it and the summary says
    // which of the two actually happened. Reporting "exited 1" for a gate
    // that never exited is the same defect this file's died-vs-failed row
    // was written to fix, one level down.
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, out }));
  });
}

const results = [];

for (const gate of gates) {
  const name = gate.replace(/\.mjs$/, '');
  console.log(`\n${rule(name)}`);
  const { code, signal, out } = await run(gate);

  // Counts are read from the gate's own tail line for the totals only; the
  // exit code decides the verdict. A gate that prints "0 failed" and exits
  // non-zero is a failure — the number is the claim, the exit code is the
  // outcome, and where they disagree the outcome wins.
  const counts = [...out.matchAll(/(\d+) passed, (\d+) failed/g)].pop();
  const passed = counts ? Number(counts[1]) : 0;
  const failed = counts ? Number(counts[2]) : 0;

  // --- Is this a skip? Two conditions, and neither is the word alone. ---
  //
  // (a) It has to be the WHOLE gate. `SKIPPED` used to be matched against
  //     the entire output, so one sub-check reporting itself skipped
  //     ("materialized view policy check: SKIPPED — no views in schema")
  //     reclassified a gate that asserted five things as "did not run",
  //     while those five assertions still landed in the suite total. The
  //     summary then contradicted itself in one block. A gate that asserted
  //     something is PASS or FAIL on its merits regardless of its prose.
  //
  // (b) Somebody has to have ASKED for it. This is the load-bearing half,
  //     because of how (a) interacts with rule 3: once a skip is defined as
  //     "declared itself empty", the word SKIPPED becomes the one thing a
  //     gate can print to opt ITSELF out of the empty-universe rule and
  //     still exit 0 green. So the skip line has to name an environment
  //     variable that is actually set in this process — which is what the
  //     real opt-out already does ("SKIPPED — SKIP_PG_GATES=1 set
  //     explicitly"). A gate deciding on its own that today it will not run
  //     names nothing, and lands red under rule 3 instead.
  //
  //     Deliberately read out of the message rather than checked against a
  //     list of known opt-out variables here: a list is a registration, and
  //     a runner you have to tell about things has the hole gates exist to
  //     close. The cost is a naming convention — an opt-out has to be called
  //     SKIP_something — which is a rule rather than a registry, and the one
  //     that exists already follows it.
  //
  //     That convention is load-bearing, not decoration. A first draft
  //     accepted ANY all-caps token in the skip line that happened to be a
  //     set variable, and a gate printing "SKIPPED — HOME is not writable"
  //     authorised itself with someone else's environment. Verified as a
  //     real hole before narrowing it, not imagined.
  //     Every line mentioning SKIPPED is scanned, not just the first, and
  //     not only ones prefixed with the gate's name. A gate can satisfy the
  //     SKIP_* convention this contract documents and still print its line
  //     in a shape a tighter pattern misses — and then it lands red for
  //     "empty universe", which is the correct verdict with the wrong
  //     diagnosis, sending its author looking for a missing loop.
  const skipLines = out.match(/^.*\bSKIPPED\b.*$/gm) || [];
  const namedVars = [...new Set(skipLines.flatMap((l) => l.match(/\bSKIP_[A-Z0-9_]+\b/g) || []))];
  const setVars = namedVars.filter(isSet);
  const skipped = skipLines.length > 0 && passed + failed === 0 && setVars.length > 0;

  // Exit 0 while asserting nothing is not a pass: the gate went dark, and
  // nobody asked it to. Authorised skips are exempt — they said so, and the
  // operator agreed.
  const empty = code === 0 && !skipped && passed + failed === 0;

  // Exited non-zero, but no assertion of its own reported a failure. Every
  // gate here counts a failed assertion before exiting 1, so the two only
  // come apart when the gate DIED — a harness error, a throw outside the
  // counter, a failure to spawn. That is a different sentence from "an
  // assertion failed", and without it the summary prints a bare tally
  // ("0 passed, 0 failed") next to FAIL, which is data and not a diagnosis.
  // The narrow zero/zero case is the one that misleads worst, because it
  // renders one line away from the empty-universe row and reads exactly like
  // it — a real misattribution, not a hypothetical: a run of this suite with
  // port 54329 held by a stray process was read as the empty-universe rule
  // making a catch, when the exit code had already caught it.
  //
  // Deliberately not restricted to zero assertions. A gate that asserts
  // twenty things, passes them all and then dies at the twenty-first prints
  // "20 passed, 0 failed" beside FAIL, which reads as a contradiction rather
  // than a bare fact and is the commoner shape of the same defect.
  const died = code !== 0 && failed === 0;

  results.push({
    name,
    verdict: code !== 0 || empty ? FAIL : skipped ? SKIP : PASS,
    code,
    signal,
    died,
    empty,
    // Only used to explain an unauthorised skip; a plain dark gate has none.
    unauthorisedSkip: empty && skipLines.length > 0,
    // Named a SKIP_* but it isn't switched on — worth saying differently
    // from naming nothing at all, since one is a typo and the other is a
    // gate deciding for itself.
    namedButUnset: empty && namedVars.length > 0,
    // The opt-out(s) this skip named and that are actually on, so the
    // summary can tell you what to unset without this file knowing any
    // variable's name in advance.
    optOuts: skipped ? setVars : [],
    passed,
    failed,
  });
}

// --- Report ------------------------------------------------------------
const width = Math.max(...results.map((r) => r.name.length));
const failed = results.filter((r) => r.verdict === FAIL);
const skips = results.filter((r) => r.verdict === SKIP);

console.log(`\n${rule('summary')}`);
// One branch per reason a verdict can be reached, and the branch says the
// reason. Kept in that shape on purpose: five separate times this afternoon,
// across three files, a predicate learned a new way to be red and the
// sentence beside it stayed a summary of the old one — a message written for
// a single condition keeps compiling after the condition becomes a
// disjunction, so nothing forces a revisit. The standing question, cheaper
// than rediscovering it: WHEN A CHECK GAINS A BRANCH, DOES THE OUTPUT GAIN A
// SENTENCE? If the new branch renders as an existing message, it is the
// existing message that is now wrong.
for (const r of results) {
  const tally = r.verdict === SKIP
    ? 'did not run'
    : r.unauthorisedSkip
      ? r.namedButUnset
        ? 'declared itself SKIPPED, but the SKIP_* variable it names is not switched on'
        : 'declared itself SKIPPED without naming a SKIP_* variable — nobody asked for this'
      : r.empty
        ? 'exited 0 but asserted nothing — a gate over an empty universe'
        : r.died
          ? `${r.signal ? `was killed by ${r.signal}` : `exited ${r.code}`} without reporting a ` +
            'failed assertion — the gate itself failed to run' +
            (r.passed ? ` (${r.passed} assertion(s) had passed before it died)` : '')
          : `${r.passed} passed, ${r.failed} failed`;
  console.log(`  ${r.verdict.padEnd(5)} ${r.name.padEnd(width)}  ${tally}`);
}

const totalPassed = results.reduce((n, r) => n + r.passed, 0);
const totalFailed = results.reduce((n, r) => n + r.failed, 0);

console.log(
  `\n  ${results.length} gate(s): ${results.length - failed.length - skips.length} green, ` +
    `${failed.length} red, ${skips.length} skipped` +
    `\n  ${totalPassed} assertion(s) passed, ${totalFailed} failed`
);

if (skips.length) {
  // Grouped BY VARIABLE rather than listed flat, because authorisation is
  // per-variable and not per-gate: one flag silences everything that cites
  // it, and a gate acquires the citation by copying another gate's skip
  // block. (That propagation has already happened once here —
  // check-hive-state-rls's skip block justifies itself by pointing at
  // check-seeds-rls's.) Grouped, a Postgres flag silencing something that
  // isn't a Postgres gate is a line you read; flat, it's a thing you would
  // have to already suspect. The runner can't tell which gates a variable
  // is *entitled* to silence — that would be a registry — so it shows you
  // the grouping and lets you notice.
  const byVar = new Map();
  for (const r of skips) for (const v of r.optOuts) byVar.set(v, [...(byVar.get(v) || []), r.name]);
  console.log('\n' + c(33, `  ${skips.length} gate(s) DID NOT RUN — this run does not cover what they assert:`));
  for (const v of [...byVar.keys()].sort()) {
    console.log(c(33, `    ${v} silenced: ${byVar.get(v).join(', ')}`));
  }
  console.log(c(33, `  Unset ${[...byVar.keys()].sort().join(', ')} to close that hole.`));
}

if (driftErrors.length) {
  console.log('\n' + c(31, '  package.json / scripts drift:'));
  driftErrors.forEach((e) => console.log(`    - ${e}`));
}

if (failed.length) {
  console.log('\n' + c(31, `  RED: ${failed.map((r) => r.name).join(', ')}`));
}

// A skip is a LOCAL affordance — a machine that genuinely cannot run embedded
// Postgres. CI is where the assertion has to be real, so CI does not get to
// authorise one. Without this, `npm test` exits 0 with the four Postgres
// security gates not run, and the only thing between that and a green REQUIRED
// check is a comment in test.yml. `isSet` already accepts 'true', which is what
// Actions sets CI to.
const skippedInCI = skips.length > 0 && isSet('CI');
if (skippedInCI) {
  console.log('\n' + c(31,
    '  CI DOES NOT GET TO SKIP. The gates above did not run, and this is a ' +
    'required check — a skip here is indistinguishable from coverage.'));
}

const ok = failed.length === 0 && driftErrors.length === 0 && !skippedInCI;
console.log(`\n  SUITE EXIT=${ok ? 0 : 1}\n`);
process.exit(ok ? 0 : 1);
