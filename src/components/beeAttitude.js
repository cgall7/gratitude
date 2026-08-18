// Sunbeam §17.3 / §19.5 — how the mascot is *held* while it flies.
//
// The rig this replaces rotated the bee to its heading with nothing
// bounding the result. On the cruise loop two of four segments carry
// headings past vertical (+149.4°, −156.8°), and `Easing.inOut` is
// symmetric about its midpoint, so the bee flew belly-up for exactly half
// of every 7000ms loop. An abstract bee survives that — upside-down reads
// as a loop-the-loop when there's no face on it. The mascot does not.
//
// Worse than the inversion: the old rotation was a single interpolated
// *angle*, so the two segments either side of the +149.4 → −156.8 step
// swept the short way through zero — 306° of backwards barrel roll in a
// quarter of the loop. Nothing bounded it because an angle that wraps has
// no bound to violate.
//
// So: **bank, don't spin.** Attitude is two quantities, not one.
//
//   • **bank** — how far the bee tips, a continuous value that can never
//     leave ±MAX_BANK_DEG *by construction* (it's a fixed fraction of a
//     pitch that is itself bounded by ±90 out of `atan2`). There is no
//     clamp, so there is nothing for a later preset to route around.
//   • **facing** — which way it points, a ±1 mirror on X. Discrete,
//     because "left or right" has no in-between, and animated through
//     zero so the change reads as the bee wheeling rather than popping.
//
// Two rules earn their keep here, both learned the expensive way:
//
// 1. **Pixel deltas, not fractional ones.** The old `headingBetween` took
//    its angle from fractional path deltas and the render then applied
//    those fractions to `layout.width`/`layout.height` separately, so the
//    bee mis-faced its own path by up to 21° — and by a *different* 21°
//    on every screen size. Attitude is therefore layout-dependent and
//    cannot be built at module scope.
//
// 2. **A fractional coordinate is not a position until you name the box,
//    and the call site names the box.** `loginArc` is flown inside a
//    220×100 wordmark anchor, not the screen; its last segment is 17.6px
//    of horizontal travel, not 31. Every figure here is a function of the
//    container the *call site* mounts, which is why `width`/`height` are
//    required arguments with no defaults.
//
// Facing threshold: **one body width of horizontal travel.** Not a pixel
// deadband (which would be tuned against one container) and not an angle
// deadband (loginArc's settle is 22.7° off vertical and clears any
// threshold you'd write for "near-vertical"). Whether sideways reads as
// sideways is a question about the character's own length, so `size` —
// already a prop — is the measure. It sits in a 3× gap on both live
// tracks, and at 13pt that same 17.6px *is* 1.35 body widths, where the
// bee should turn.
//
// This module is deliberately dependency-free: no React, no
// react-native, no theme. That is what lets `scripts/check-bee-attitude.mjs`
// import and sample it directly instead of pattern-matching the source of
// a file it cannot load.

// The bank a vertical dive or climb is drawn at. Every other pitch is a
// proportional fraction of it, so this is a scale factor and not a limit —
// see `bankFor`.
export const MAX_BANK_DEG = 22;

// Wall-clock length of a facing change. Fixed in *milliseconds*, which is
// the whole reason `buildAttitude` needs the easing and the duration:
// `t` is already eased, so a window of fixed width in `t` is a window of
// wildly varying width in wall time. On the cruise loop, buying the same
// 120ms costs 0.0288 of `t` at the apex (driver at 1.724× peak velocity)
// and 0.00107 at the loop seam (driver velocity → 0). Those are *required
// windows*, not durations: hard-code one Δt instead and the wall times it
// produces differ by 5.6× at Δt = 0.0288, 12.9× at Δt = 0.005 — the spread
// isn't a single number because the relationship isn't linear.
// §17.3 R51's rule, third outing: every timeline figure states its space.
export const TURN_MS = 120;

const DEG = 180 / Math.PI;
const EPS = 1e-4;

// Pitch of a travel vector, in degrees, measured from horizontal and
// folded onto the right half-plane: |dx| discards the direction of travel
// (that's `facing`'s job) and keeps only the steepness. Bounded ±90 by
// construction, which is what makes `bankFor` bounded without a clamp.
export const pitchFor = (dxPx, dyPx) => Math.atan2(dyPx, Math.abs(dxPx)) * DEG;

// The one place attitude magnitude is decided. Proportional, not clamped:
// a clamp at ±22 saturates on *every* segment of the live cruise loop
// (raw pitches −72.6 / +69.5 / +52.0 / −42.9) and emits two latching
// values, which is a heading in a bound's clothing.
export const bankFor = (pitchDeg) => (MAX_BANK_DEG * pitchDeg) / 90;

// Which way the bee points, given one stretch of horizontal travel and the
// facing it is already holding. Facing holds through travel too vertical to
// read a direction from — including, deliberately, the loginArc settle, whose
// last segment is 0.80 body widths. A pixel deadband would have been tuned
// against one container and an angle deadband fails outright (that settle is
// 22.7° off vertical and clears any threshold you would write for
// "near-vertical"), so the measure is the bee's own BOX — `size`, the prop
// every call site already passes.
//
// The word matters and this comment had it wrong. It used to say "the
// character's own length," and the code divides by `size` (44) while the
// character is drawn at MASCOT_WIDTH_FRACTION of it (30.07) — a quantity
// 1.46x smaller than the rule uses. Nothing ratified moves: every published
// body-width figure was computed as `dx / size` (R81's cruise table
// 3.39/3.04/3.93/2.50, loginArc's 0.80 settle), so the arithmetic was always
// self-consistent and only the justification was false. Fifth outing of
// right-measurement-wrong-name, and the first with the name inside a comment
// justifying a constant — a justification comment is a dependency (R83).
//
// Two consumers, same question: `buildAttitude` walks a track's segments, and
// `BeeTransition` has one stretch of travel and no track at all. The rule is
// here rather than duplicated because those are the same question, not two
// questions with the same answer.
//
// The first segment of a track has nothing to hold, so callers seed `held`
// from its own travel whatever the magnitude; `check-bee-attitude` asserts
// separately that every track's first segment clears the threshold on its
// own, because that fallback is a base case and not a licence.
export const facingFor = (dxPx, size, held) =>
  (Math.abs(dxPx) / size >= 1 ? Math.sign(dxPx) || held : held);

// Numeric inverse of a monotonic easing. Bisection rather than an
// analytic inverse so this works for whatever easing a track is actually
// flown with, including one it hasn't been given yet.
const easingInverse = (easing, target) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (easing(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const lerpAt = (ts, values, t) => {
  if (t <= ts[0]) return values[0];
  for (let i = 1; i < ts.length; i += 1) {
    if (t <= ts[i]) {
      const span = ts[i] - ts[i - 1];
      if (span <= 0) return values[i];
      const k = (t - ts[i - 1]) / span;
      return values[i - 1] + (values[i] - values[i - 1]) * k;
    }
  }
  return values[values.length - 1];
};

/**
 * Resolve a fractional flight path into the two attitude channels the
 * render drives, for one specific container.
 *
 * @param path      waypoints in fractional (0-1) container coordinates,
 *                  closing back on the first for a looping track
 * @param width     container width in px — from the call site's box
 * @param height    container height in px — from the call site's box
 * @param size      the bee's rendered size in px; the facing threshold
 * @param closed    true for the cruise loop (wraps at the seam)
 * @param easing    the timing easing the track is flown with, w → t
 * @param durationMs  the flight's wall-clock length
 * @param turnMs    wall-clock length of one facing change
 * @param heldFacing  the facing the bee arrives holding, for a caller that
 *                  flies a SEQUENCE of plans rather than one track
 *
 * Returns `inputRange` / `rotateOutput` (degrees) / `scaleXOutput` ready
 * for `Animated.interpolate`, plus a `segments` table carrying the
 * derivation so a gate — or a reviewer — can check the numbers rather
 * than the shape.
 */
export const buildAttitude = (
  path,
  { width, height, size, closed, easing = (w) => w, durationMs, turnMs = TURN_MS, heldFacing }
) => {
  const n = path.length - 1;
  const waypointTs = path.map((_, i) => i / n);

  const segments = path.slice(0, -1).map((p, i) => {
    const dx = (path[i + 1].x - p.x) * width;
    const dy = (path[i + 1].y - p.y) * height;
    const pitch = pitchFor(dx, dy);
    return { dx, dy, pitch, bank: bankFor(pitch), bodyWidths: Math.abs(dx) / size };
  });

  // R122 — THE BASE CASE WAS DOING THE WHOLE JOB, AND IT DOES NOT CONSULT THE
  // THRESHOLD.
  //
  // `flightSequencer` puts `heldFacing` on every plan it builds and its own
  // comment says "`buildAttitude` has to accept it — see its `heldFacing`
  // option." There was no such option. The field was written by three plan
  // builders, threaded through `resolveBeat`, carried across the component
  // boundary, and read by nothing — a justification comment naming a
  // dependency that did not exist (R83, and this is the second outing).
  //
  // What that cost is not the perch snap the sequencer comment warns about;
  // it is bigger. With nothing to hold, EVERY plan re-seeded from
  // `Math.sign(dx)` — a sign, with no magnitude in it — so `facingFor`'s
  // threshold was never consulted BETWEEN plans, only within one. Measured
  // over 40 chained sorties on a three-anchor set, sweeping the set's
  // x-extent:
  //
  //     x-extent    0    8   16   24   32   43   44   345
  //     turns       0   27   27   27   27   27   27    27
  //
  // Eight pixels of horizontal separation — under a fifth of a bee-box, far
  // too little to read as a direction — mirrored the whole character exactly
  // as often as 345px did. Only an extent of EXACTLY zero was quiet, and only
  // because `Math.sign(0) || 1` pins it. That is the deadband the threshold
  // exists to provide, absent for every caller that flies more than one plan.
  //
  // Seeding from `heldFacing` puts segment 0 back under `facingFor` like every
  // other segment. Callers that pass nothing are unaffected to the bit: the
  // seed is `Math.sign(segments[0].dx) || 1`, and `facingFor` applied to that
  // same segment returns it unchanged whichever branch it takes.
  let held = heldFacing || Math.sign(segments[0].dx) || 1;
  segments.forEach((seg) => {
    held = facingFor(seg.dx, size, held);
    seg.facing = held;
  });

  // Attitude at a waypoint is the attitude of the segment leaving it; the
  // last waypoint wraps to the first segment on a closed track and holds
  // the last one otherwise. Between waypoints the bank ramps, so the bee
  // leans into a turn instead of snapping to it.
  const tailIndex = closed ? 0 : n - 1;
  const waypointBanks = [...segments.map((s) => s.bank), segments[tailIndex].bank];
  const waypointFacings = [...segments.map((s) => s.facing), segments[tailIndex].facing];

  // Every facing change becomes a window of `turnMs` in *wall* time,
  // converted into `t` through the real easing at that point of the
  // flight. A seam turn on a closed track is placed entirely *before*
  // t = 1: `Animated.loop` snaps `t` back to 0, so a window straddling the
  // seam would teleport scaleX from −0.5 to +0.5. Placed before it, the
  // turn lands exactly where the driver has already slowed to a stop —
  // the bee hovers, wheels around, and leaves the other way.
  const halfWall = turnMs / durationMs / 2;
  const windows = [];
  const addWindow = (tCenter, from, to, seam) => {
    const w = seam ? 1 : easingInverse(easing, tCenter);
    const wStart = seam ? 1 - 2 * halfWall : w - halfWall;
    const wEnd = seam ? 1 : w + halfWall;
    const tStart = easing(Math.max(0, wStart));
    const tEnd = easing(Math.min(1, wEnd));
    const tMid = easing(Math.max(0, Math.min(1, (wStart + wEnd) / 2)));
    if (tEnd - tStart < EPS) return;
    windows.push({ tStart, tMid, tEnd, from, to });
  };

  for (let j = 1; j < n; j += 1) {
    if (waypointFacings[j] !== waypointFacings[j - 1]) {
      addWindow(waypointTs[j], waypointFacings[j - 1], waypointFacings[j], false);
    }
  }
  if (closed && segments[n - 1].facing !== segments[0].facing) {
    addWindow(1, segments[n - 1].facing, segments[0].facing, true);
  }

  const facingAt = (t) => {
    for (let i = 0; i < windows.length; i += 1) {
      const win = windows[i];
      if (t >= win.tStart && t <= win.tEnd) {
        if (t <= win.tMid) return (win.from * (win.tMid - t)) / (win.tMid - win.tStart);
        return (win.to * (t - win.tMid)) / (win.tEnd - win.tMid);
      }
    }
    const j = Math.min(n - 1, Math.floor(t * n + EPS));
    return segments[j].facing;
  };

  const nodes = [...waypointTs];
  windows.forEach((win) => nodes.push(win.tStart, win.tMid, win.tEnd));
  const inputRange = [...new Set(nodes)]
    .sort((a, b) => a - b)
    .filter((t, i, all) => i === 0 || t - all[i - 1] > EPS / 10);

  // Rotation is `facing × bank`, evaluated node by node. The transform
  // composes scale-then-rotate (RN folds the array left to right and
  // applies it to a row vector, so the *last* entry is applied first), and
  // a mirrored bee rotated by +θ tips its nose **up** — without the sign
  // the whole leftward half of the loop climbs where it should dive.
  //
  // It falls out of this that rotation passes through 0 at the exact
  // instant scaleX does: the bee flattens to nothing, levels off, and
  // opens out the other way already banked. One interpolation, no
  // `Animated.multiply`, safe on the native driver.
  const rotateOutput = inputRange.map((t) => facingAt(t) * lerpAt(waypointTs, waypointBanks, t));
  const scaleXOutput = inputRange.map((t) => facingAt(t));

  return { inputRange, rotateOutput, scaleXOutput, segments, windows };
};
