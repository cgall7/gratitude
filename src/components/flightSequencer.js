// Sunbeam §32 — the idle flight sequencer.
//
// ┌─ NOT WIRED YET, AND HERE IS HOW TO TELL THAT FROM ORPHANED ─────────┐
// │ This module has NO importer in `src/` or `App.js`. That is the      │
// │ engine half of a two-owner piece of work landing first, not a call  │
// │ site somebody deleted.                                              │
// │                                                                     │
// │   consumer   FlyingBee.js — the fixed 5-waypoint `PATH` loop        │
// │              (LOOP_MS 7000) is what this replaces. Anchors come     │
// │              from the host screens: TodayTab and HoneycombTab each  │
// │              declare 3-5, in the §28.2 window-coordinate currency.  │
// │   owner      Pixel (engine, this file) / Deezine (choreography —    │
// │              perch points, dwell ranges, dart-hover-settle timings, │
// │              trail grammar, loginArc re-author)                     │
// │   plan       PLANS/BEE_FLIGHT_REDESIGN_SCOPE.md, from Colin's ask   │
// │              of 2026-08-16                                          │
// │   exercised  scripts/simulate-bee-flight.mjs — reachable and run    │
// │              today, just not from the app                           │
// │                                                                     │
// │ THE FALSIFIER, because a name and an owner both decay: if that plan │
// │ is closed or FlyingBee.js's `PATH` loop has been replaced by        │
// │ something else, this module is dead and should be deleted, not      │
// │ maintained. Check the plan before you assume either.                │
// └─────────────────────────────────────────────────────────────────────┘
//
// Colin, 2026-08-16: the idle bee "looks like a windows98 screensaver just
// bouncing off the corners with no purpose." He is right, and the defect is
// narrower than it looks. The engine is fine — the §28 pollination visit
// already proves this bee can act with intent. What has no intent is the
// CRUISE, and measured (R106, `scripts/simulate-bee-flight.mjs`) it is one gesture
// repeated 8.6 times a minute:
//
//   * ramp to 372.7 px/s, then step DOWN at all three waypoints (x0.76,
//     x0.74, x0.54 — never up) to a dead stop, and repeat byte-identically.
//     Position is an exact function of `t mod 7000`.
//   * 95.9% of every lap is airborne. The 4.1% "at rest" is not a perch, it
//     is the loop seam decelerating to a stop at the same point every 7s.
//   * The speed variation is not a grammar. It is four unequal segments
//     handed equal shares of the driven range: `buildTrack` puts waypoints at
//     uniform `i/n`, so a segment's speed is its own length over a fixed time
//     slice. Nothing chose those speeds.
//
// So this module replaces the loop with a sequencer. It does NOT build
// tracks: PERCH / HOVER / SORTIE are choices — which anchor, how long to
// rest, whether to look around first — and the tracks they turn into are the
// ones §28 already ratified.
//
// **A sortie is a pollination visit without the pollen.** That is the whole
// reuse and it is worth stating plainly, because it is why this file is
// short. `buildPollinationPlan` flies from wherever the bee is, up to a
// staging point one body-length above the destination, then descends onto it
// — approach easing, then the §28.5 settle gesture. That is exactly what a
// sortie to a declared anchor wants. The only difference is that a visit
// bursts pollen on arrival and a sortie does not, and the burst already lives
// at the call site rather than in the plan. So sorties inherit the ratified
// geometry, the ratified descent, and every `check-bee-attitude` row that
// covers the visit.
//
// **Dependency-free, deliberately** — the same property `beeAttitude.js` and
// `pollinationFlight.js` hold, and for the same reason: it lets
// `scripts/check-bee-attitude.mjs` import and SAMPLE this file rather than
// pattern-match source it cannot load. R81: sample the function, not the
// flight. A sequencer is a generator of flights, so the only honest way to
// gate it is to sweep its seeds. The moment this file imports React, React
// Native, or the theme, that gate degrades to string-matching.
//
// What lives here is MECHANISM. Every number a viewer can perceive — dwell
// ranges, hover radius, how often he sorties, which easing each verb flies on
// — is choreography and belongs to Deezine per the §12.5 ownership split.
// `STUB_GRAMMAR` below is a placeholder that exists so the engine can be
// built and gated before the storyboard lands; it is not a design.

// **Zero imports, and that is stricter than "no react-native".**
//
// `check-bee-attitude.mjs` loads these files by reading the source and
// importing it as a base64 `data:` URL — the only way to `import` a `.js` file
// in a package that is not `type: module`. A `data:` URL has no base to
// resolve against, so a RELATIVE specifier fails there too:
//
//   ERR_UNSUPPORTED_RESOLVE_REQUEST: Failed to resolve module specifier
//   './pollinationFlight' ... base scheme is not hierarchical
//
// So `import { buildPollinationPlan } from './pollinationFlight'` would break
// the gate that exists to sample this file, and the likely repair — having the
// gate string-match the source instead — is precisely the degradation the
// dependency-free rule was written to prevent.
//
// The escape is the one `pollinationFlight` already uses for easings: a plan
// builder is a plain function, so nothing is lost by taking it as an argument
// and everything is lost by importing it. `builders` is threaded in from the
// call site; the gate passes the same ones it imported separately.

// §32.1 — the reference speed, and why it is stated per DIAGONAL.
//
// Every speed in §28 is derived from the cruise: the approach is
// `APPROACH_SPEED_RATIO x cruiseSpeedPxS(PATH, width, height, LOOP_MS)`, and
// `DESCENT_MS` is justified by landing at that same pace (30.07pt in 160ms =
// 187.9 px/s against the cruise's 187.59). Deleting `PATH` deletes the number
// both of those are defined against, so the sequencer has to publish a
// replacement or §28.5 loses its footing.
//
// The shipped cruise speed turns out to be almost exactly a fixed fraction of
// the container's DIAGONAL, and that is not a coincidence — `PATH` is
// fractional, so its resolved length scales with the box. Measured across
// seven boxes from a 320x568 SE to a 744x1133 iPad mini:
//
//     basis        spread across the seven
//     diagonal/s   0.19975 .. 0.20264   (1.45%)
//     height/s     0.21905 .. 0.24243   (10.67%)
//     width/s      0.36918 .. 0.48677   (31.85%)
//
// So the diagonal is the basis that makes the number a property of the bee
// rather than a property of the phone. At 393x852 it reproduces the shipped
// 187.59 px/s to 0.06% and `DESCENT_MS`'s implied 187.9 to 0.1% — every §28.5
// figure survives the swap untouched, which is the point.
export const CRUISE_DIAG_PER_S = 0.2;

export const referenceSpeedPxS = (width, height) =>
  CRUISE_DIAG_PER_S * Math.hypot(width, height);

// R106 — and the reference speed is also the DART speed, which repairs a
// fragility in §28.5 rather than inheriting it.
//
// §28.5's argument is a speed CONTRAST: "what reads as 'he broke off to come
// here' is that he is moving faster than he was a moment ago." But it pins
// the approach to `2 x cruise MEAN` = 375.2 px/s, and the cruise's own PEAK is
// 372.7 — the same number to 0.7%. Tap at mid-lap today and the bee's
// instantaneous speed is already the approach's average speed. The contrast
// survives peak-to-peak (the approach peaks near 647 px/s on its easing), but
// it is specified against a statistic the eye never sees.
//
// Under the sequencer a dart is a single leg flown at ONE speed, so "the pace
// he was already flying" stops being a range 0..372.7 and becomes a number.
// `2x` is then true at every break-off instead of on average. This is why the
// dart may not simply be made faster to taste: raise it and the §28.5 ratio
// has to be re-based on it in the same change, or the break-off stops reading.
export const DART_SPEED_RATIO = 1;

// --- seeded variation ----------------------------------------------------
//
// Principle 4 of the scope: never the same lap twice. That needs randomness
// the gate can still reproduce, so it is a seeded generator rather than
// `Math.random` — a sweep over seeds is the only way to assert "no observable
// repeat" about a thing whose whole job is to be unpredictable.
//
// mulberry32: 32-bit state, one multiply-xor round. Chosen because it is
// eight lines and has no dependencies, not because its statistical quality
// matters here — nothing downstream is cryptographic and the alternative to a
// good PRNG is a bee that visits anchors in a cycle.
export const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const lerp = (a, b, k) => a + (b - a) * k;
const pick = (rng, [lo, hi]) => lerp(lo, hi, rng());

// --- the grammar ---------------------------------------------------------
//
// PLACEHOLDER. Every field here is Deezine's under the §12.5 split; these
// values exist so the sequencer can be built, sampled and gated before the
// storyboard lands, and they are chosen to satisfy the scope's stated ratios
// rather than to look like anything. Replacing this object is the whole of
// the choreography hand-off — no engine change should be needed to accept a
// timing table.
export const STUB_GRAMMAR = {
  // Airborne : at-rest, per the scope's ~1:2 — stated as the TARGET, because
  // it is the design intent and the dwell is only its consequence.
  //
  // R107: the first draft of this grammar named `perchMs` directly and put
  // the ratio in a comment, and the comment was a table reading "dwell x1.3 ->
  // 32.8% airborne" with no units on the multiplier. Deezine read x1.3 as an
  // absolute and wrote 1700-2200ms, which measures at 78.2% airborne against a
  // 40% ceiling. That is not a misreading so much as a badly shaped interface:
  // a literal dwell is only correct for the anchors and dart speed it was
  // solved against, and NOTHING in the grammar recorded which those were.
  //
  // So the dwell is no longer a value in this table. `perchRangeFor` solves it
  // from the anchors the host actually declared, and the fraction below is
  // what a storyboard sets. Widen the anchor spread and the dwell follows on
  // its own; the ratio cannot silently go stale, because it is the input.
  airborneTarget: 0.328,
  // How far either side of the solved mean a dwell is sampled. Variation for
  // its own sake — the ratio is preserved in expectation because the spread is
  // symmetric, so this is free.
  perchSpread: 0.42,
  hoverMs: [900, 1950],
  // How often a landing is followed by a look-around before the rest.
  hoverChance: 0.6,
  // The bob, as a fraction of the container diagonal. 0.018 is ~17px at
  // 393x852 — under half a bee, so it reads as hanging rather than as travel.
  hoverRadiusDiag: 0.018,
  // Waypoints in one bob. Four closes the ellipse; more is not perceptible at
  // this radius and costs interpolation nodes.
  hoverPoints: 4,
  // §28.5's settle, unchanged and deliberately so — see `DESCENT_MS`.
  settleMs: 160,
  // An anchor may not be revisited until this many others have been.
  antiRepeatDepth: 2,
};

// --- anchors -------------------------------------------------------------
//
// An anchor is `{ key, x, y }` in the FLIGHT'S OWN corner-space, already
// converted from window coordinates by the caller — §28.2, unchanged: a
// flight's target is measured in the flight's own box, never computed in the
// target's. The host screen declares what is worth flying to; the bee never
// learns what he is flying over, which is the same reason `ringStep` travels
// with a pollination target instead of `cellSize` crossing the boundary.
//
// Choosing the next one is the only place "never the same lap twice" is
// actually decided, so it is the only place worth being careful. Uniform
// choice over the anchors that are not in `recent` — not a shuffle of the
// full set, which would guarantee every anchor is visited once per cycle and
// reintroduce a period equal to the anchor count.
//
// R121 — AN ANTI-REPEAT RULE PRESERVES A DESTINATION; IT HAS TO PRESERVE A
// CHOICE. The first draft blocked `min(depth, n - 1)` keys, which guarantees
// the pool is non-EMPTY and guarantees nothing else. At `n = depth + 1` the
// pool is exactly one anchor, `rng()` multiplies a set of size 1, and the seed
// only chooses where the cycle starts. Measured against this module over 2000
// seeds: `n = 3, depth = 2` produced **6 distinct 12-tails** and a period of 3
// on every one of them — A→B→C→A→B→C. That is the full-set shuffle the comment
// above rejects by name, arrived at from the other direction, and "the bee's
// next move is predictable" is Colin's own wording for the defect this module
// exists to remove.
//
// So the block is clamped to `n - 2`, leaving a pool of at least two. Note
// what that trades and in which direction: **the DEPTH gives way, the POOL
// never does.** A choice therefore exists from three anchors up for every
// depth, and `anchors.length >= antiRepeatDepth + 2` is not the condition for
// having somewhere to go — it is the condition under which a host gets the
// anti-repeat depth it asked for. Those are two different sentences and the
// first draft of this comment ran them together; `check-bee-attitude` H4 went
// red on it within the minute (it asserted the aperiodicity threshold tracks
// depth, and it does not). Both properties now have their own row, J4 and J5.
//
// **The floor of 1 is not defensive, it is a `slice` guard.** `Math.min(2, 0)`
// is 0 at two anchors and `recent.slice(-0)` returns the WHOLE array, not the
// empty one — so an unfloored clamp blocks every key the bee has ever visited,
// empties `eligible`, falls through to `: anchors`, and picks uniformly over
// everything including himself. Measured: **48.2% of choices (57873/120000)
// become zero-length sorties** — dart, descent and settle all flown to the
// point he is already sitting on. The shipped `n - 1` clamp never reaches that
// fallback at all (0 times in 480000 choices), so this is a hazard the fix
// introduces and the floor removes, not one it inherits.
//
// **Two anchors cannot be repaired here and that is arithmetic, not a gap.**
// With two anchors and no self-repeat, alternation is forced; every candidate
// clamp gives period 2. A host with two anchors in a render state has declared
// a screensaver, and the answer is on the host — a third anchor, or no
// sequencing. `check-bee-attitude` section H states `n = 2` as the exception
// so that a red there reads as arithmetic rather than as a regression.
export const chooseAnchor = (anchors, recent, rng, depth) => {
  if (!anchors || anchors.length === 0) return null;
  if (anchors.length === 1) return anchors[0];
  const blocked = new Set(recent.slice(-Math.max(1, Math.min(depth, anchors.length - 2))));
  const eligible = anchors.filter((a) => !blocked.has(a.key));
  const pool = eligible.length > 0 ? eligible : anchors;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
};

// --- the dwell, solved rather than typed ---------------------------------
//
// The airborne fraction is an output of three things: the dwell, the dart
// speed, and how far apart the host's anchors are. Two of those three are not
// the grammar's to choose — the anchors belong to the screen and the dart
// speed is §28.5's — so the only one left is the dwell, and that makes it the
// dependent variable. Writing it as a literal is writing down the answer to a
// sum whose other terms are on a different file.
//
// Estimator, and named as one: the mean over ordered pairs is what the bee
// flies only if he chooses uniformly, and `chooseAnchor` blocks the last
// `antiRepeatDepth` keys, which biases him towards the far ones. The realised
// fraction therefore runs slightly ABOVE the target and only the simulation
// knows by how much (`scripts/simulate-bee-flight.mjs` reports it). This is
// the number to plan anchors with, not the number to assert in a gate.
export const meanHopPx = (anchors) => {
  if (!anchors || anchors.length < 2) return null;
  let total = 0;
  let n = 0;
  for (const a of anchors) {
    for (const b of anchors) {
      if (a === b) continue;
      total += Math.hypot(b.x - a.x, b.y - a.y);
      n += 1;
    }
  }
  return n > 0 ? total / n : null;
};

// R122 — HOW OFTEN THE BEE TURNS AROUND, WHICH IS A PROPERTY OF THE ANCHOR SET
// AND NOT OF THE ENGINE.
//
// The perch contract §32 hands the host is `{ key, on, at }`: a side of an
// element and a fraction along it, resolved against the element's measured
// frame. I claimed the collinearity problem dissolved as a consequence of that
// — distinct sides give distinct x for free. It does not. Every TodayTab
// anchor is a full-width block in one 24pt-padded column, so `on: 'left'`
// resolves to x = 24 for ALL of them and `on: 'right'` to x = 369 for all of
// them. The x-spread comes from ASSIGNING DIFFERENT SIDES, which is a property
// of the table someone fills in, and the natural authoring order — three
// anchors written top to bottom, all on the left — reproduces the original
// defect THROUGH the new contract. "For free" was a hope about how the table
// gets written, and a contract whose safe use depends on taste is not a
// contract.
//
// The floor is derivable, so it is not taste. `facingFor` flips the bee at
// `|dx| >= size` — the bee's own box, 44 at `DEFAULT_SIZE`. If the whole
// anchor set spans LESS than one box in x, then no pair in it can clear that
// threshold, so no hop can ever flip the facing, so the bee holds one facing
// for the entire life of that render state and flies a straight vertical line
// through it. That is an implication, not a threshold: extent < size => every
// |dx| < size => `facingFor` returns `held` on every segment of every sortie.
//
// What this is NOT: sufficient. A rate above zero says a turn is reachable,
// not that the flight reads as varied — a set with one wide pair and four
// stacked ones passes here and still looks like a column. The floor rejects
// the case that is mechanically a screensaver; how much spread a storyboard
// AIMS for is Deezine's, and this is the number to aim with.
//
// It is deliberately not wired into `resolveGrammar`. Null there means "there
// is nothing to compute" — one anchor has no hop and no dwell repairs it. A
// column has a perfectly computable flight that happens to be a bad one, which
// is a defect in a declared table and belongs where tables are checked, not in
// a branch that silently removes the bee from a shipped screen.
export const facingFlipRate = (anchors, size) => {
  if (!anchors || anchors.length < 2 || !(size > 0)) return null;
  let flips = 0;
  let n = 0;
  for (const a of anchors) {
    for (const b of anchors) {
      if (a === b) continue;
      if (Math.abs(b.x - a.x) / size >= 1) flips += 1;
      n += 1;
    }
  }
  return n > 0 ? flips / n : null;
};

// airborne / (airborne + dwell) = target  =>  dwell = airborne/target - airborne.
// A hover only happens `hoverChance` of the time, so it enters at its expected
// value; every beat here is sampled per cycle, so the whole identity holds in
// expectation and not per lap. Returns null rather than a number for a target
// outside (0, 1): a bee that is airborne 100% of the time is the defect this
// module was written to remove, and 0% is not a bee.
export const dwellMsForAirborne = ({ airborneTarget, sortieMs, hoverChance, hoverMs }) => {
  if (!(airborneTarget > 0 && airborneTarget < 1)) return null;
  const airborne = sortieMs + hoverChance * ((hoverMs[0] + hoverMs[1]) / 2);
  return airborne / airborneTarget - airborne;
};

/**
 * The dwell range for a given set of declared anchors.
 *
 * `sortieDurationFor` is injected for the reason every collaborator in this
 * file is: a sortie's duration is `buildPollinationPlan`'s to compute, and
 * importing it would break the gate that samples this module. The call site
 * passes the same builder it flies with, so the dwell is solved against the
 * real plan geometry — staging offset, settle and all — rather than against a
 * second copy of the arithmetic that could drift from it.
 */
export const perchRangeFor = ({ anchors, grammar, sortieDurationFor }) => {
  const hop = meanHopPx(anchors);
  if (hop === null) return null;
  const mean = dwellMsForAirborne({
    airborneTarget: grammar.airborneTarget,
    sortieMs: sortieDurationFor(hop),
    hoverChance: grammar.hoverChance,
    hoverMs: grammar.hoverMs,
  });
  if (mean === null) return null;
  return [mean * (1 - grammar.perchSpread), mean * (1 + grammar.perchSpread)];
};

// `nextBeat` reads `grammar.perchMs`, so the solve happens once when the host's
// anchors change rather than per beat.
//
// **Null is the answer for fewer than two anchors, and it is not a guard.**
// With one anchor there is nowhere to sortie TO: `chooseAnchor` returns the
// only one there is, the bee flies a zero-length flight to where he already
// is, and the sequencer degenerates into a bob at a single point — worse than
// the loop it replaces. There is no dwell that repairs that, so there is no
// dwell to invent, and a fallback literal here would be the module answering a
// question it cannot answer. The call site reads null as "do not sequence",
// which for a screen that declared nothing worth flying to is the correct
// behaviour rather than a degraded one.
export const resolveGrammar = ({ grammar, anchors, sortieDurationFor }) => {
  if (grammar.perchMs) return grammar;
  const perchMs = perchRangeFor({ anchors, grammar, sortieDurationFor });
  return perchMs ? { ...grammar, perchMs } : null;
};

/**
 * A beat that does not move: hold position for a dwell.
 *
 * Two identical waypoints rather than a `setTimeout` and no animation,
 * because the whole value of the sequencer is that every state is a PLAN and
 * the completion callback is the only thing that advances the machine. One
 * mechanism, one driver, R46 unchanged. The cost is an `Animated.timing` that
 * drives a constant, which is one native animation and nothing else.
 *
 * `flutter: false` — §19.5 puts wing motion on the airborne path only, and a
 * bee that buzzes while sitting still reads as a loading spinner (the note on
 * `MascotBee`'s `beat` prop makes the same point about the hero pose).
 *
 * `heldFacing` matters here and is easy to miss: `buildAttitude` seeds its
 * facing from `Math.sign(segments[0].dx) || 1`, and a stationary path's first
 * segment has `dx === 0`, so a perched bee would snap to facing RIGHT however
 * he arrived. The plan therefore carries the facing the previous plan ended
 * with, and `buildAttitude` has to accept it — see its `heldFacing` option.
 */
export const buildPerchPlan = ({ at, width, height, durationMs, heldFacing }) => ({
  kind: 'perch',
  path: [at, at].map((p) => ({ x: p.x / width, y: p.y / height })),
  inputRange: [0, 1],
  easing: (w) => w,
  durationMs,
  trail: false,
  flutter: false,
  heldFacing,
});

/**
 * A beat that stays put but is not still: bob around the current position.
 *
 * A closed ellipse rather than a circle — the vertical extent is halved,
 * because a hovering insect's wander is wider than it is tall and a circle
 * reads as an orbit. Flown on a symmetric ease per segment so it drifts
 * rather than tracks, and closed so the bee finishes where he started and the
 * next beat can be built from a known point.
 *
 * `trail: false` — the scope's trail grammar, and it is the right call for a
 * mechanical reason too: the trail drops a particle every 160ms at the bee's
 * CURRENT position, so a bee that stays inside a 17px radius for 1.5s piles
 * ~9 particles into one blob. The glow marks travel; here there is none.
 */
export const buildHoverPlan = ({ at, width, height, durationMs, radiusPx, points, easing, composeEasing, heldFacing }) => {
  const n = Math.max(3, points);
  const path = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    path.push({
      x: (at.x + Math.cos(a) * radiusPx) / width,
      y: (at.y + Math.sin(a) * radiusPx * 0.5) / height,
    });
  }
  return {
    kind: 'hover',
    path,
    inputRange: path.map((_, i) => i / (path.length - 1)),
    easing: composeEasing(
      Array.from({ length: n }).map(() => 1),
      Array.from({ length: n }).map(() => easing)
    ),
    durationMs,
    trail: false,
    flutter: true,
    heldFacing,
  };
};

/**
 * Advance the machine one beat.
 *
 * Returns a DESCRIPTOR, not a plan: `{ state, anchor, durationMs, ... }`.
 * The split is deliberate — resolving a descriptor into a track needs the
 * container, the bee's size and the easings, all of which live in the
 * component, while the CHOICE needs none of them. Keeping the choice pure is
 * what lets the gate sweep 10,000 seeds without a renderer.
 *
 * @param state    the beat that just finished: 'sortie' | 'hover' | 'perch'
 * @param recent   keys of recently visited anchors, oldest first
 * @param anchors  declared anchors, flight corner-space
 * @param rng      seeded generator from `makeRng`
 * @param grammar  the choreography table (`STUB_GRAMMAR` until it lands)
 */
export const nextBeat = ({ state, recent, anchors, rng, grammar }) => {
  // Landed. Look around first, sometimes — a bee that inspects every single
  // arrival is as predictable as one that never does, which is the whole
  // reason this is a coin flip and not an alternation.
  if (state === 'sortie') {
    return rng() < grammar.hoverChance
      ? { state: 'hover', durationMs: pick(rng, grammar.hoverMs) }
      : { state: 'perch', durationMs: pick(rng, grammar.perchMs) };
  }
  if (state === 'hover') {
    return { state: 'perch', durationMs: pick(rng, grammar.perchMs) };
  }
  // Rested. Go somewhere. `durationMs` is not chosen here: a sortie's length
  // is its distance over the dart speed (§28.5's rule, unchanged — a clamp
  // would be the mechanism wearing a guard's name), and the distance is not
  // known until the anchor is resolved against the container.
  const anchor = chooseAnchor(anchors, recent, rng, grammar.antiRepeatDepth);
  return { state: 'sortie', anchor };
};

/**
 * Turn a descriptor into a plan the existing driver can fly.
 *
 * Lives here rather than in the component so the gate resolves the SAME plans
 * the app does. A gate that re-implements the resolution asserts a property of
 * its own copy — §4's rule, and the failure mode R85 found by mutating its own
 * row: a check that cannot reach the call site checks something adjacent to it.
 *
 * Easings arrive as arguments for the reason `pollinationFlight` states: they
 * are plain `(w) => number` in React Native, so nothing is lost by not
 * importing them, and everything is lost by importing `react-native` here.
 */
export const resolveBeat = ({ beat, from, width, height, bodyLengthPx, grammar, easings, builders, heldFacing }) => {
  if (beat.state === 'perch') {
    return buildPerchPlan({ at: from, width, height, durationMs: beat.durationMs, heldFacing });
  }
  if (beat.state === 'hover') {
    return buildHoverPlan({
      at: from,
      width,
      height,
      durationMs: beat.durationMs,
      radiusPx: grammar.hoverRadiusDiag * Math.hypot(width, height),
      points: grammar.hoverPoints,
      easing: easings.hover,
      composeEasing: builders.composeSegmentEasing,
      heldFacing,
    });
  }
  if (!beat.anchor) return null;
  // A sortie IS a pollination visit without the pollen — same approach, same
  // staging point one body-length above the destination, same §28.5 settle.
  //
  // `ringStep: Infinity` is not a fudge. `stagingOffsetFor` bounds the staging
  // offset by the target cell's apothem so the bee never hangs over a
  // NEIGHBOURING seat (R87/R88 — a quantity borrowed from a lattice inherits
  // the lattice's occupancy). A declared anchor is not in a lattice and has no
  // neighbour to intrude on, so the bound does not apply and the noun decides
  // outright: he hangs his own length above whatever he came to look at. An
  // anchor MAY declare `clearance` where it does have crowded neighbours, and
  // then the same bound applies for the same reason.
  const plan = builders.buildPollinationPlan({
    from,
    target: { x: beat.anchor.x, y: beat.anchor.y },
    ringStep: beat.anchor.clearance ?? Infinity,
    bodyLengthPx,
    width,
    height,
    approachSpeedPxS: referenceSpeedPxS(width, height) * DART_SPEED_RATIO,
    easeApproach: easings.dart,
    easeDescent: easings.settle,
  });
  // `kind` stays 'visit' for the driver's benefit only where it must; a sortie
  // is a distinct kind because the completion callback branches on it — a
  // visit bursts pollen and tells the host the abort window closed, and a
  // sortie does neither.
  return { ...plan, kind: 'sortie', trail: true, flutter: true, anchorKey: beat.anchor.key, heldFacing };
};
