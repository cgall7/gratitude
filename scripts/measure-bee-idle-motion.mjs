// Gate 4 of the luxury pass (Lumen, thread 6596d9c2, Lane G) — the bee's
// idle-motion budget. Colin: "Unless you make it super luxurious retire
// it." This is the bar that can actually say no.
//
//   node scripts/measure-bee-idle-motion.mjs record --label mounted-1
//   node scripts/measure-bee-idle-motion.mjs record --label suppressed-1
//   node scripts/measure-bee-idle-motion.mjs record --label mounted-2
//   node scripts/measure-bee-idle-motion.mjs record --label suppressed-2
//   node scripts/measure-bee-idle-motion.mjs compare
//
// NOT `check-*.mjs`, deliberately (same reason `simulate-bee-flight.mjs`
// isn't): `run-checks.mjs` enumerates that glob for `npm test` and expects
// every gate to be a deterministic, no-external-dependency assertion this
// process can finish in seconds. This one drives `xcrun simctl` against a
// real booted simulator for 4x90s of wall time and reports on VIDEO FILES,
// not source. Wiring it into the automatic suite would either time out CI
// or (worse) get silently skipped there and never actually run. It's a
// manual instrument, the same category as `simulate-bee-flight.mjs`, run on
// demand and its verdict reported by hand.
//
// WHY FILE SIZE IS THE METRIC (Lumen's framing, restated because it's the
// whole reason this works): `simctl recordVideo` is CHANGE-DRIVEN — it
// writes frames when pixels change and nothing when they don't. On a
// perfectly static screen the file asymptotes to a tiny fixed overhead. So
// on an IDLE, UNTOUCHED screen, file size directly measures how much the
// screen moved without anyone touching it — which is exactly the question
// Colin asked and exactly the property "ambient motion" names. It measures
// idle motion ONLY: this file's name says so on purpose, because
// `check-demo-hive`'s name already oversold its scope once (fixture-only
// coverage read as "everything that renders") and repeating that here
// would let this instrument get cited for a class of motion — a tap, a
// scroll — it was never pointed at.
//
// THE BAR: `simctl.io.recordVideo` for 90s of an untouched Today screen,
// bee mounted vs bee suppressed. Bee-mounted more than 15% larger => the
// bee is still performing on an idle screen => it retires. Below 15% => it
// clears the bar Colin set.
//
// CONTROL BEFORE MEASUREMENT (Lumen: "if the two suppressed runs disagree
// by more than a few percent, the instrument isn't ready and the 15%
// threshold is meaningless"). `compare` requires at least 2 runs per
// condition and checks the within-condition spread BEFORE it will report a
// mounted-vs-suppressed verdict at all — see CONTROL_VARIANCE_THRESHOLD_PCT
// below. Same device, same seed data, same build, back to back, is on the
// operator; this script can only check that the numbers it was handed are
// self-consistent, not that the recording protocol was followed.
//
// THE ONE INTEGRATION POINT THIS SCRIPT DOES NOT OWN
//
// "Bee suppressed" needs a build where nothing renders `<FlyingBee>` on
// Today while everything else on the screen is identical — the same
// contract `FlyingBee`'s own "no perches, no bee" rule already uses
// (`TodayTab.js:150`, `perches={error ? null : perches}`). This script
// does NOT patch that mount site: Deezine and Pixel are rewriting exactly
// that call this week for the rest/breath/errand doctrine (Lumen's ruling,
// same thread), and a suppression hook landed here today would either
// conflict with that rewrite within the hour or measure a mount path that
// no longer exists once it lands. The contract this script expects,
// documented here so whoever wires it doesn't have to guess: read
// `process.env.EXPO_PUBLIC_SUPPRESS_BEE === 'true'` at the bee's mount
// site and force it unmounted when set, same as a null `perches` does
// today. Two builds (`EXPO_PUBLIC_SUPPRESS_BEE=true expo start` vs unset),
// four recordings, then `compare`.
//
// SELF-TEST: `compare`'s arithmetic (variance check, delta, verdict) is
// exercised below against synthetic byte counts before it ever touches a
// real .mov file, so a bug in the threshold math can't hide behind "no
// recordings yet."
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT_DIR = path.join(os.tmpdir(), 'bee-idle-motion');
const DEFAULT_SECONDS = 90;
const RETIRE_THRESHOLD_PCT = 15;
const CONTROL_VARIANCE_THRESHOLD_PCT = 5; // "a few percent" — Lumen's phrase; picked to be tight enough to catch a bad capture (app not actually idle, a stray toast, a keyboard) while leaving room for normal video-codec jitter between otherwise-identical runs.

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const pct = (a, b) => (Math.abs(a - b) / ((a + b) / 2)) * 100;

// --- pure comparison logic, exercised by the self-test AND by `compare` ---
const evaluate = (mountedSizes, suppressedSizes) => {
  if (mountedSizes.length < 2 || suppressedSizes.length < 2) {
    return { verdict: 'INSUFFICIENT_RUNS', detail: 'need >= 2 recordings per condition to check control variance' };
  }
  const suppressedVariancePct = pct(suppressedSizes[0], suppressedSizes[1]);
  if (suppressedVariancePct > CONTROL_VARIANCE_THRESHOLD_PCT) {
    return {
      verdict: 'INSTRUMENT_NOT_READY',
      detail: `two suppressed-condition runs disagree by ${suppressedVariancePct.toFixed(1)}% (threshold ${CONTROL_VARIANCE_THRESHOLD_PCT}%) — re-capture before trusting a mounted-vs-suppressed number`,
      suppressedVariancePct,
    };
  }
  const avgMounted = mountedSizes.reduce((a, b) => a + b, 0) / mountedSizes.length;
  const avgSuppressed = suppressedSizes.reduce((a, b) => a + b, 0) / suppressedSizes.length;
  const deltaPct = ((avgMounted - avgSuppressed) / avgSuppressed) * 100;
  const retire = deltaPct > RETIRE_THRESHOLD_PCT;
  return {
    verdict: retire ? 'RETIRE' : 'PASS',
    detail: retire
      ? `mounted is ${deltaPct.toFixed(1)}% larger than suppressed (threshold ${RETIRE_THRESHOLD_PCT}%) — the bee is still performing on an idle screen`
      : `mounted is ${deltaPct.toFixed(1)}% larger than suppressed (threshold ${RETIRE_THRESHOLD_PCT}%) — clears the bar`,
    deltaPct,
    suppressedVariancePct,
    avgMounted,
    avgSuppressed,
  };
};

const selfTest = () => {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    ok ? (pass += 1) : (fail += 1);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  };
  check('two tight suppressed runs + 10% mounted delta -> PASS', evaluate([1100000, 1100000], [1000000, 1000000]).verdict, 'PASS');
  check('two tight suppressed runs + 20% mounted delta -> RETIRE', evaluate([1200000, 1200000], [1000000, 1000000]).verdict, 'RETIRE');
  check('suppressed runs 10% apart -> INSTRUMENT_NOT_READY regardless of mounted numbers', evaluate([2000000, 2000000], [1000000, 1100000]).verdict, 'INSTRUMENT_NOT_READY');
  check('exactly at 15% boundary -> PASS (strictly greater-than retires)', evaluate([1150000, 1150000], [1000000, 1000000]).verdict, 'PASS');
  check('one run per condition -> INSUFFICIENT_RUNS', evaluate([1000000], [1000000]).verdict, 'INSUFFICIENT_RUNS');
  console.log(`\nself-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
};

// --- `record` -------------------------------------------------------------
const record = async () => {
  const label = flag('label');
  if (!label) throw new Error('--label is required, e.g. --label mounted-1');
  const device = flag('device', 'booted');
  const seconds = Number(flag('seconds', DEFAULT_SECONDS));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${label}.mov`);
  if (fs.existsSync(outFile)) fs.rmSync(outFile);

  console.log(`Recording ${seconds}s to ${outFile}`);
  console.log('Leave the simulator untouched — no taps, no scrolls, nothing that would move a pixel on purpose.');

  const proc = spawn('xcrun', ['simctl', 'io', device, 'recordVideo', outFile]);
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  proc.kill('SIGINT');
  await new Promise((resolve) => proc.on('close', resolve));

  if (!fs.existsSync(outFile)) {
    throw new Error(`recordVideo produced no file — simctl stderr:\n${stderr}`);
  }
  const size = fs.statSync(outFile).size;
  console.log(`Saved ${label}.mov — ${size} bytes`);
};

// --- `compare` --------------------------------------------------------------
const compare = () => {
  if (!fs.existsSync(OUT_DIR)) throw new Error(`no recordings found at ${OUT_DIR} — run \`record\` first`);
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.mov'));
  const mounted = files.filter((f) => f.startsWith('mounted')).map((f) => fs.statSync(path.join(OUT_DIR, f)).size);
  const suppressed = files.filter((f) => f.startsWith('suppressed')).map((f) => fs.statSync(path.join(OUT_DIR, f)).size);

  console.log(`mounted runs (${mounted.length}): ${mounted.join(', ')} bytes`);
  console.log(`suppressed runs (${suppressed.length}): ${suppressed.join(', ')} bytes`);

  const result = evaluate(mounted, suppressed);
  console.log(`\n${result.verdict} — ${result.detail}`);
  process.exit(result.verdict === 'PASS' ? 0 : result.verdict === 'RETIRE' ? 1 : 2);
};

if (cmd === 'record') {
  await record();
} else if (cmd === 'compare') {
  compare();
} else if (cmd === 'self-test' || !cmd) {
  const ok = selfTest();
  if (!cmd) {
    console.log('\nUsage: record --label <mounted-N|suppressed-N> [--seconds 90] [--device booted]');
    console.log('       compare');
  }
  process.exit(ok ? 0 : 1);
} else {
  console.error(`unknown command "${cmd}" — use record, compare, or self-test`);
  process.exit(1);
}
