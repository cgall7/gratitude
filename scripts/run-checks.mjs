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
//
// Exit code is 1 if any gate failed, 0 otherwise. Skips do not fail the run
// — the opt-out is deliberate and documented — but they are impossible to
// miss in the summary.

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
    child.on('error', (e) => resolve({ code: 1, out: `${out}\nfailed to spawn: ${e.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

const results = [];

for (const gate of gates) {
  const name = gate.replace(/\.mjs$/, '');
  console.log(`\n${rule(name)}`);
  const { code, out } = await run(gate);

  // Counts are read from the gate's own tail line for the totals only; the
  // exit code decides the verdict. A gate that prints "0 failed" and exits
  // non-zero is a failure — the number is the claim, the exit code is the
  // outcome, and where they disagree the outcome wins.
  const counts = [...out.matchAll(/(\d+) passed, (\d+) failed/g)].pop();
  const skipped = /:\s*SKIPPED\b/.test(out);

  results.push({
    name,
    verdict: code !== 0 ? FAIL : skipped ? SKIP : PASS,
    passed: counts ? Number(counts[1]) : 0,
    failed: counts ? Number(counts[2]) : 0,
  });
}

// --- Report ------------------------------------------------------------
const width = Math.max(...results.map((r) => r.name.length));
const failed = results.filter((r) => r.verdict === FAIL);
const skips = results.filter((r) => r.verdict === SKIP);

console.log(`\n${rule('summary')}`);
for (const r of results) {
  const tally = r.verdict === SKIP ? 'did not run' : `${r.passed} passed, ${r.failed} failed`;
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
  console.log(
    '\n' +
      c(33, `  ${skips.length} gate(s) DID NOT RUN: ${skips.map((r) => r.name).join(', ')}`) +
      '\n' +
      c(33, '  This run does not cover what they assert. Unset SKIP_PG_GATES to close that hole.')
  );
}

if (driftErrors.length) {
  console.log('\n' + c(31, '  package.json / scripts drift:'));
  driftErrors.forEach((e) => console.log(`    - ${e}`));
}

if (failed.length) {
  console.log('\n' + c(31, `  RED: ${failed.map((r) => r.name).join(', ')}`));
}

const ok = failed.length === 0 && driftErrors.length === 0;
console.log(`\n  SUITE EXIT=${ok ? 0 : 1}\n`);
process.exit(ok ? 0 : 1);
