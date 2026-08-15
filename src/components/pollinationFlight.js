// Sunbeam §28 — the pollination tap, as arithmetic.
//
// You tap a face in your hive and the bee comes over and agrees with you.
// He breaks from the cruise loop wherever he happens to be, climbs to a
// staging point one lattice step above the cell, drops onto it, puffs
// pollen, and ambles back to the loop.
//
// What he does *not* do is fetch your card. §28.1, ratified: **the bee is
// never the acknowledgement, and never on the critical path of something the
// user asked for.** He decorates the SOURCE you tapped, never the PAYLOAD you
// wanted. The cell answers at t=0 (stroke + haptic) and the reveal card runs
// its existing 260ms unchanged — so time-to-content is identical to the build
// without him, which is the only reason a p95 of ~1.1s is affordable at all.
//
// This module is deliberately dependency-free — no React, no react-native, no
// theme, no `motion` — for the same reason `beeAttitude.js` is: it lets
// `scripts/check-bee-attitude.mjs` **import and sample these functions**
// rather than pattern-match the source of a file it cannot load. R81: sample
// the function, not the flight. Four live waypoints cannot pin a rule; a
// domain sweep can. The moment this file grows an import, the gate degrades
// to string-matching and rows 5 and 6 stop meaning anything.
//
// Easing functions arrive as arguments for the same reason. They are plain
// `(w) => number` in React Native, so nothing is lost by not importing them.

// §28.5 — the approach is specified as a RATIO to the cruise, not as a
// pixels-per-second constant. What reads as "he broke off to come here" is
// that he is moving faster than he was a moment ago; the absolute figure
// (375 px/s at 393x852) is a consequence of the container, not a design
// decision, and would be wrong on the next screen size.
export const APPROACH_SPEED_RATIO = 2;

// §28.5 — the descent is a GESTURE, not a traverse, so it is specified as a
// duration. Its distance is the staging offset by construction (see
// `buildPollinationPlan`), so fixing the duration fixes the speed: 30.07pt in
// 160ms = 187.9 px/s at beeSize 44, which is cruise speed (187.59) — he
// settles onto the face at the pace he was already flying, rather than
// dropping onto it. Flown on `Easing.out(cubic)` so he lands rather than
// arrives.
//
// §28.11 / C′ — this was 240ms when the drop was a full ring step (76.21pt).
// Shortening the drop without shortening the duration would have made the
// settle a crawl at 125 px/s, two thirds of cruise; the dial moved with the
// distance it is the duration of.
export const DESCENT_MS = 160;

// §28.4 / C′ — how far above the face he hangs before he settles onto it.
//
// R87 measured the defect this replaces. The staging point used to be ONE
// RING STEP above the cell, and a ring step is the lattice's own pitch, so
// "one step above the cell" IS "the seat above it" wherever one exists: four
// of seven seats staged on another member's face, and the approach eases out
// into the phase split, so the slowest moment of the whole beat — a full
// stop — happened over the wrong person. R88: **a quantity borrowed from a
// lattice inherits the lattice's occupancy.** "Not a new number" justifies a
// SCALE; it never justifies a POSITION.
//
// So the offset is the BEE's dimension, not the comb's: he hangs his own
// length above the face he came to. §28.3's noun rule, again — the number is
// a length either way, and which noun it is a length OF decides where he
// stops. It moves with the character now, not with the lattice.
//
// The bound is the target cell's apothem, `ringStep / 2` (38.105pt at
// cellSize 44). Past it the staging point crosses the Voronoi boundary into
// the seat above and the defect is back. `STAGING_SAFETY` keeps it off the
// boundary itself, because at exactly half a step the hit-test is an exact
// tie and float noise picks the side (R88).
//
// **The `min` is a backstop, not the mechanism, and the gate proves it.** The
// approach clamp was killed in §28.5 because it bound on most taps — at which
// point it is not a guard, it is the mechanism wearing a guard's name. This
// one is the opposite: at the shipped pair (beeSize 44, cellSize 44) the body
// length is 30.07pt against a bound of 34.29, so the noun decides and the
// bound never binds. It only engages where a caller draws the bee large
// against the comb — `beeSize > 1.141 x cellSize` — and there the invariant
// matters more than the noun does. Rows 5c/5d sweep both halves of that: the
// bound holds for every pair, and the noun still decides at the shipped one.
export const STAGING_SAFETY = 0.9;

export const stagingOffsetFor = ({ bodyLengthPx, ringStep }) =>
  Math.min(bodyLengthPx, (STAGING_SAFETY * ringStep) / 2);

// §28.3 — pollen scatter radius, as a fraction of the lattice step. This one
// stays on the comb: the burst is a property of the FACE it lands on, not of
// the bee that dropped it. A quarter of a step is 19.05pt at cellSize 44,
// comfortably inside the cell's own half-width across flats (38.105pt), so it
// reads as landing ON the face rather than around it.
export const POLLEN_RADIUS_FRACTION = 0.25;

const TAU = Math.PI * 2;

export const distancePx = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Length of a fractional track resolved into one container. Used to derive
// the cruise speed from the cruise track rather than hard-coding it, so a
// re-authored `PATH` moves every figure in this file with it.
export const pathLengthPx = (path, width, height) => {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot((path[i].x - path[i - 1].x) * width, (path[i].y - path[i - 1].y) * height);
  }
  return total;
};

export const cruiseSpeedPxS = (path, width, height, loopMs) =>
  (pathLengthPx(path, width, height) / loopMs) * 1000;

// §28.5 — **no clamp, and that is the deliberate part.** `distance / speed`
// holds "the bee moves at one speed" by construction, which R81 established is
// strictly better than a bound a future preset can route around. A clamp was
// drafted and the sweep killed it: sampled uniformly in wall time the
// departure distance runs 41 -> 417px, so any clamp pair binds on a large
// fraction of taps — at which point it is not a guard, it is the mechanism
// wearing a guard's name. Strictly monotonic in distance, no flat region;
// gate row 5 sweeps the domain to say so.
export const approachDurationMs = (distance, speedPxS) => (distance / speedPxS) * 1000;

// §28.5 — the pollen count is DERIVED from what the trail pool has spare, not
// chosen. A trail particle lives `trailFadeMs` and one is dropped every
// `trailIntervalMs`, so `ceil(fade / interval)` slots are occupied at any
// moment; the rest are free. One left as slack, because the round-robin
// pointer and the burst must not race for the same slot.
//
// At the shipped numbers: 12 - ceil(750/160) = 12 - 5 = 7 free, minus slack = 6.
// Raise the cap or slow the cadence and this moves on its own; gate row 6
// asserts the derivation rather than the literal.
export const pollenCountFor = ({ poolSize, trailFadeMs, trailIntervalMs, slack = 1 }) =>
  Math.max(0, poolSize - Math.ceil(trailFadeMs / trailIntervalMs) - slack);

// Where the flecks go. Deterministic — no RNG, so a frame grab is
// reproducible and the gate can assert the fan rather than a distribution.
// Fanned across the lower half-plane (pollen falls), radii alternating so the
// burst reads as a puff rather than a rosette.
export const pollenFlecks = (count, radius) => {
  if (count <= 0) return [];
  const from = TAU * (20 / 360);
  const to = TAU * (160 / 360);
  return Array.from({ length: count }).map((_, i) => {
    const a = count === 1 ? (from + to) / 2 : from + ((to - from) * i) / (count - 1);
    const r = radius * (i % 2 === 0 ? 1 : 0.72);
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
  });
};

// One monotone easing standing in for two phases.
//
// Why not two timings in a sequence: `buildAttitude` takes ONE easing and ONE
// duration, and it needs them because a facing change is specified in wall
// time and only the easing converts that into a window in the driven value
// (R51/§17.3). Handing it a piecewise easing keeps attitude exact across both
// legs for free. It also keeps R46's rule literally: one driver, one
// animation, stopped and restarted — never two.
//
// The split lands the driven value on exactly 0.5 at the phase boundary,
// which is what lets the track keep `buildTrack`'s uniform waypoint spacing
// (`buildAttitude` assumes waypoints sit at i/n) while the two legs run at
// different speeds. All of the speed difference lives in the easing.
export const composePhaseEasing = (split, easeA, easeB) => (w) => {
  if (split <= 0) return 0.5 + 0.5 * easeB(w);
  if (split >= 1) return 0.5 * easeA(w);
  if (w <= split) return 0.5 * easeA(w / split);
  return 0.5 + 0.5 * easeB((w - split) / (1 - split));
};

/**
 * Build the visit: cruise position -> staging point -> the cell.
 *
 * Every coordinate here is in the FLIGHT'S OWN BOX, in the same corner-space
 * the cruise track already flies in. §28.2, ratified: **a flight's target is
 * MEASURED in the flight's own box; it is never COMPUTED in the target's.**
 * The caller converts once, from window coordinates, and no pixel constant
 * crosses between `HoneycombGrid` and `FlyingBee`.
 *
 * @param from      live bee position, px, corner-space (`posRef`) — §28.4
 *                  waypoint 0 is where he already is, so the break costs no
 *                  teleport
 * @param target    the cell centre, px, already corrected to corner-space by
 *                  the caller (§28.3: a coordinate is not a position until
 *                  you say what it is the position OF)
 * @param ringStep  one lattice step, px. Travels WITH the target because it
 *                  is a measured property of the comb; `FlyingBee` must not
 *                  know `cellSize`. The apothem the staging offset is bounded
 *                  by is half of it, so nothing new has to cross the boundary
 *                  for C′ — the bound is expressible in what already came.
 * @param bodyLengthPx  the DRAWN character's own length, px. Travels with the
 *                  bee for the same reason `ringStep` travels with the
 *                  target: each box owns its own measurements (§28.2).
 * @param width/height  the flight container, px
 * @param approachSpeedPxS  cruise speed x APPROACH_SPEED_RATIO
 * @param easeApproach/easeDescent  the two phase easings
 */
export const buildPollinationPlan = ({
  from,
  target,
  ringStep,
  bodyLengthPx,
  width,
  height,
  approachSpeedPxS,
  easeApproach,
  easeDescent,
}) => {
  // §28.4 waypoint 1: DIRECTLY ABOVE the cell centre, by the bee's own length
  // (C′ — see `stagingOffsetFor`). A bee approaching from below sweeps up and
  // over it, so the final leg is always a descent whatever direction he came
  // from — which is what makes the landing read as a landing rather than as
  // an arrival from the side. And because the offset is inside the target's
  // own hexagon, the one moment he is stationary is the moment he is hanging
  // over the face the user tapped.
  const staging = { x: target.x, y: target.y - stagingOffsetFor({ bodyLengthPx, ringStep }) };
  const approachMs = approachDurationMs(distancePx(from, staging), approachSpeedPxS);
  const durationMs = approachMs + DESCENT_MS;
  const split = durationMs > 0 ? approachMs / durationMs : 0;
  const path = [from, staging, target].map((p) => ({ x: p.x / width, y: p.y / height }));
  return {
    kind: 'visit',
    path,
    inputRange: path.map((_, i) => i / (path.length - 1)),
    easing: composePhaseEasing(split, easeApproach, easeDescent),
    durationMs,
    approachMs,
    descentMs: DESCENT_MS,
    split,
    landing: target,
  };
};

/**
 * Build the return: wherever he is now -> `PATH[0]`, at cruise speed.
 *
 * §28.4 — `PATH[0] === PATH[4]`, so when this finishes `t` restarts at 0 and
 * `Animated.loop` resumes with ZERO discontinuity. That is free, and it is the
 * only place a return can end without a seam.
 *
 * §28.9 — this is also the whole of "abort". The flight aborts rather than
 * re-aims, and aborting IS skipping to this leg from the live position: no
 * new mechanism, no pollen (he never landed), one state change the beat was
 * already built out of.
 */
export const buildReturnPlan = ({ from, home, width, height, cruiseSpeedPxS: speed, easing }) => {
  const durationMs = Math.max(1, (distancePx(from, home) / speed) * 1000);
  const path = [from, home].map((p) => ({ x: p.x / width, y: p.y / height }));
  return {
    kind: 'return',
    path,
    inputRange: [0, 1],
    easing,
    durationMs,
  };
};
