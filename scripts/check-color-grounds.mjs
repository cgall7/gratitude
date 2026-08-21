#!/usr/bin/env node
// Colour-ground gate (Luxury Pass, Lane A).
//
// theme.js asserts perceptual-separation figures IN PROSE and has since
// §29.2 — "vs `background` 21.14, vs `surface` 30.82, vs `washYellow` 19.63."
// Nothing has ever checked them. A justification comment is a dependency:
// move `goldField` or any of its three grounds by one hex digit and those
// three numbers become false, silently, in the file that is supposed to be
// the single source of truth for colour.
//
// This gate reads the claims out of the comment and recomputes them from the
// tokens, so the prose cannot drift from the values it describes.
//
// It does that FIRST for a second reason. CIEDE2000 is easy to transcribe
// subtly wrong, and a wrong implementation fails green on everything below.
// The three prose figures were computed by a different author with different
// code, which makes them the one calibration input available: if
// scripts/lib/color.mjs cannot reproduce them, this gate does not get to
// report on anything else. Calibration validates the instrument, not the
// target list.
//
// Then two floors that exist because the audit found live violations of both:
//
//   COVERS. `sunlit-honey`'s base IS `background` — ΔE00 0.00 against the page
//   it renders on. The first cover a user is offered is invisible. The floor
//   here is deliberately measured against `surface`, not against whichever
//   page a cover happens to sit on today: covers render as an inset fill on a
//   white card precisely so that separation stops being a function of the
//   page, including for covers nobody has authored yet.
//
//   INK LADDER. `inkFaint` was read by three call sites for months without
//   being defined, resolving `undefined` and handing the field to iOS's
//   system placeholder grey — hue 290.5deg, 199deg around the wheel from every
//   other piece of text in the product, at 1.68:1. This asserts the token
//   exists, sits on the ladder's hue, and clears the large-text floor on both
//   grounds it is actually rendered against.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { deltaE00, contrastRatio, hueAngle, lightness } from './lib/color.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof registerHooks !== 'function') {
  console.error('Needs Node >= 22.15 for module.registerHooks(). Found ' + process.version);
  process.exit(1);
}

// Metro resolves './foo'; Node requires './foo.js'. Bridge only that.
// (Same shim as check-demo-hive.mjs — `hiveThemes.js` imports './theme'.)
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
});

const { theme } = await import(pathToFileURL(path.join(ROOT, 'src/constants/theme.js')).href);
const { HIVE_COVER_THEMES } = await import(
  pathToFileURL(path.join(ROOT, 'src/constants/hiveThemes.js')).href
);

const c = theme.colors;

let pass = 0;
let fail = 0;
const failures = [];

const ok = (label) => { pass += 1; console.log(`  ok   ${label}`); };
const bad = (label) => { fail += 1; failures.push(label); console.log(`  FAIL ${label}`); };

const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------------------
// 1. Calibration + prose regression net.
// ---------------------------------------------------------------------------
console.log('\nCalibration — theme.js\'s own asserted ΔE00 figures:');

const themeSrc = fs.readFileSync(path.join(ROOT, 'src/constants/theme.js'), 'utf8');
// The claims run onto the NEXT comment line, so this must span the
// contiguous `//` block — a lazy `[\s\S]*?\n` stops at the first newline and
// finds the heading without any of the figures under it.
const claimBlock = /Ground pairs, ΔE00(?:[^\n]*\n\s*\/\/[^\n]*){0,4}/.exec(themeSrc);

if (!claimBlock) {
  bad('theme.js no longer contains a "Ground pairs, ΔE00" claim block — this gate\'s only calibration input is gone');
} else {
  // `([\d.]+)` swallows the sentence-ending period on the last claim
  // ("19.63." -> NaN), which reds a figure that is in fact correct.
  const claims = [...claimBlock[0].matchAll(/vs `(\w+)` (\d+(?:\.\d+)?)/g)];
  if (claims.length === 0) {
    bad('"Ground pairs, ΔE00" block found but no `vs \\`token\\` N.NN` claims parsed out of it');
  }
  for (const [, groundToken, claimed] of claims) {
    const ground = c[groundToken];
    if (!ground) {
      bad(`theme.js claims a ΔE00 against \`${groundToken}\`, which is not a colour token`);
      continue;
    }
    const measured = deltaE00(c.goldField, ground);
    // 0.005 — the prose is quoted to 2dp, so anything inside half a unit in
    // the last place is the same number, and anything outside it is drift.
    if (near(measured, Number(claimed), 0.005)) {
      ok(`goldField vs ${groundToken}: prose says ${claimed}, measured ${measured.toFixed(2)}`);
    } else {
      bad(`goldField vs ${groundToken}: prose says ${claimed}, measured ${measured.toFixed(2)} — the comment is stale, or lib/color.mjs is wrong`);
    }
  }
}

const calibrated = fail === 0;

// ---------------------------------------------------------------------------
// 2. Cover grounds.
// ---------------------------------------------------------------------------
const COVER_FLOOR = 5;
console.log(`\nCover bases vs \`surface\` (floor ΔE00 >= ${COVER_FLOOR}):`);

if (!calibrated) {
  console.log('  (skipped — instrument failed calibration above; its numbers are not evidence)');
} else {
  for (const cover of HIVE_COVER_THEMES) {
    const d = deltaE00(cover.base, c.surface);
    const label = `${cover.id} (${cover.base}) vs surface: ΔE00 ${d.toFixed(2)}`;
    if (d >= COVER_FLOOR) ok(label);
    else bad(`${label} — below the ${COVER_FLOOR} floor; this cover will read as a ghost`);
  }
}

// ---------------------------------------------------------------------------
// 3. The warm ink ladder.
// ---------------------------------------------------------------------------
console.log('\nInk ladder:');

const LADDER = ['ink', 'inkSoft', 'inkFaint'];
const missing = LADDER.filter((k) => !c[k]);
if (missing.length) {
  bad(`ink ladder is missing ${missing.join(', ')} — a call site reading an undefined colour token gets the platform default, not a fallback`);
} else {
  ok(`ink ladder defined: ${LADDER.map((k) => `${k} ${c[k]}`).join(', ')}`);

  // One hue, three lightnesses. The ladder's identity IS its hue; a rung that
  // drifts off it stops reading as the same ink and starts reading as a
  // different colour that happens to be dark.
  const HUE_TOL = 5;
  const base = hueAngle(c.ink);
  for (const k of ['inkSoft', 'inkFaint']) {
    const h = hueAngle(c[k]);
    const delta = Math.abs(h - base);
    if (delta <= HUE_TOL) ok(`${k} hue ${h.toFixed(1)}° is within ${HUE_TOL}° of ink's ${base.toFixed(1)}°`);
    else bad(`${k} hue ${h.toFixed(1)}° is ${delta.toFixed(1)}° off ink's ${base.toFixed(1)}° — off the ladder`);
  }

  // Monotonic: each rung must actually be lighter than the one above it.
  const Ls = LADDER.map((k) => lightness(c[k]));
  if (Ls[0] < Ls[1] && Ls[1] < Ls[2]) {
    ok(`ladder is monotonic in L*: ${Ls.map((l) => l.toFixed(1)).join(' < ')}`);
  } else {
    bad(`ladder is not monotonic in L*: ${LADDER.map((k, i) => `${k} ${Ls[i].toFixed(1)}`).join(', ')}`);
  }

  // `inkFaint` renders as placeholder text on exactly these two grounds.
  // 3:1 is the large-text floor and is the right floor ONLY while every
  // placeholder using it is supplementary to a visible label — see the
  // token's own comment. A placeholder that becomes a field's only label is
  // content and needs 4.5:1.
  const PLACEHOLDER_FLOOR = 3;
  for (const groundToken of ['surface', 'backgroundWriting']) {
    const r = contrastRatio(c.inkFaint, c[groundToken]);
    const label = `inkFaint on ${groundToken}: ${r.toFixed(2)}:1`;
    if (r >= PLACEHOLDER_FLOOR) ok(`${label} (floor ${PLACEHOLDER_FLOOR}:1)`);
    else bad(`${label} — below the ${PLACEHOLDER_FLOOR}:1 large-text floor`);
  }

  // And it must stay recessed: a placeholder as strong as entered text stops
  // reading as a prompt. `ink` is the entered-text colour on both grounds.
  const entered = contrastRatio(c.ink, c.surface);
  const placeholder = contrastRatio(c.inkFaint, c.surface);
  if (placeholder < entered / 2) {
    ok(`inkFaint (${placeholder.toFixed(2)}:1) is recessed against entered text ink (${entered.toFixed(2)}:1)`);
  } else {
    bad(`inkFaint (${placeholder.toFixed(2)}:1) is not recessed enough against ink (${entered.toFixed(2)}:1) — it will read as typed text`);
  }
}

if (fail) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  ${f}`));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
