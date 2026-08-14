import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MascotBee } from './MascotBee';
import { buildAttitude } from './beeAttitude';
import {
  APPROACH_SPEED_RATIO,
  POLLEN_RADIUS_FRACTION,
  buildPollinationPlan,
  buildReturnPlan,
  cruiseSpeedPxS,
  pollenCountFor,
  pollenFlecks,
} from './pollinationFlight';
import { theme } from '../constants/theme';
import { DURATIONS, MAX_TRAIL_PARTICLES, useReducedMotion } from '../constants/motion';

// Sunbeam §12.2 — the marquee motion. Distinct from BeeTransition (a scarce
// narrative beat that arcs once between screens): this bee is ambient
// *presence* — it cruises a bounded loop around the screen and exhales a
// short trail of `accentBurst` glow particles that drift and fade behind
// it. §14.1 (R9) makes this default-ON for Today/Honeycomb idle; the only
// guardrails are: never over active text input (`active={false}` parks it
// small in a corner, motionless), max one airborne bee per screen (one
// <FlyingBee> per host), and reduced-motion collapses it to a slow static
// opacity breathe with zero particles (§12.5 Rule 4 — no exceptions).
//
// §13.3 — `preset="loginArc"`: the same engine flown as a one-shot instead
// of a loop. The bee spirals inward from off-edge, tightens to the anchor's
// center, fades on settle, and fires `onSettle` when done — Welcome uses it
// over the wordmark once per app open. Under Reduce Motion (or `active`
// false) a preset flight renders nothing and settles immediately: an
// entrance flourish someone asked the OS to suppress is skipped, not
// slowed. Until this preset existed the Welcome call site silently fell
// through to the cruise loop and circled the wordmark forever.
//
// §19.5 / R79 — flown as `MascotBee`, the ratified render itself, with
// `flutter` on the airborne path only (never on the parked/RM pose). The
// §17.3 flight ruling this replaces chose `StripedBee` with
// `bandColor={accent}` so a cruising bee never knocked an opaque band out of
// unknown content; a raster has no colour props at all, so the question
// retires rather than being answered differently. R83: `StripedBee` no longer
// survives anywhere — the keepsake register it was held for is `KeepsakeBee`,
// the same character with the ink/yellow partition inverted.
//
// The *path* is still a first engine pass (loose 5-point loop, eased
// timing driver) — Deezine owns cruise posture/wing-flutter/glow-particle
// design per §12.5 ownership split; swap the waypoint set or easing here
// without touching the trail/pooling engine.
//
// **Attitude is no longer part of that.** Which way the bee points and how
// far it tips is now `beeAttitude.js`, a bounded rule rather than a
// heading — and any new waypoint set inherits it for free, which is the
// point. Read that file before changing a path: `scripts/check-bee-attitude`
// resolves every `<FlyingBee>` call site's container and will fail on a
// path that flies the mascot at an attitude it can't be read at, or on a
// call site the table doesn't know about.
const LOOP_MS = 7000;
const TRAIL_INTERVAL_MS = 160;
const DEFAULT_SIZE = 44;

// Loose loop in fractional (0-1) container coordinates — five stops
// (closing back on the first) so the path reads as a lazy figure-eight
// rather than a bouncing ball.
const PATH = [
  { x: 0.14, y: 0.72 },
  { x: 0.52, y: 0.16 },
  { x: 0.86, y: 0.58 },
  { x: 0.42, y: 0.84 },
  { x: 0.14, y: 0.72 },
];

// A track is *position only*. Attitude — which way the bee points and how
// far it tips — is not a property of a fractional path: it needs the
// container's pixel dimensions and the bee's own size, neither of which
// exists at module scope. See `beeAttitude.js`, and `buildAttitude` in the
// component below.
const buildTrack = (path) => ({
  path,
  inputRange: path.map((_, i) => i / (path.length - 1)),
});

const CRUISE = buildTrack(PATH);

// Hoisted so the attitude builder can be handed the *same* easing the
// timing driver runs, rather than a second copy that could drift: a facing
// change is specified in wall time and only the easing converts that into
// a window in `t`.
const CRUISE_EASING = Easing.inOut(Easing.ease);
const PRESET_EASING = Easing.out(Easing.cubic);

const PRESETS = {
  // In from off-right, up over the top, back down across to the lower
  // right, then up into the anchor's center. Fades over the last stretch
  // so the settle reads as the bee alighting, not vanishing.
  //
  // Owed: this path was authored as an inward spiral against an implied
  // full-screen box, and it isn't flown in one — `Onboarding:235` mounts it
  // inside a 220×100 wordmark anchor, where the same fractions draw a wide
  // flat zigzag ("down the left edge" is 52px of drop). Re-authoring it
  // against its real anchor is a separate change with its own frames; this
  // one only fixes how the bee is *held* along whatever path it flies.
  loginArc: {
    track: buildTrack([
      { x: 1.08, y: 0.1 },
      { x: 0.55, y: -0.12 },
      { x: 0.1, y: 0.4 },
      { x: 0.58, y: 0.92 },
      { x: 0.5, y: 0.5 },
    ]),
    duration: 1800,
    opacity: { inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] },
  },
};

// §28 — the pollination visit. `pollinate` is `{ key, x, y, ringStep }` in
// WINDOW coordinates, or null. Window coordinates are the only honest currency
// between two boxes that both exist at runtime (§28.2): the comb measures the
// cell in its own space and converts once; this component measures its OWN
// container and subtracts. No pixel constant crosses the two files, and
// `ringStep` travels with the target because it is a measured property of the
// comb — a bee that knew the comb's cell size would be a bee that knew what it
// was flying over.
export const FlyingBee = ({
  active = true,
  size = DEFAULT_SIZE,
  style,
  preset,
  onSettle,
  pollinate = null,
  onPollinateEnd,
}) => {
  const reduced = useReducedMotion();
  const [layout, setLayout] = useState(null);
  // The pollination plan currently in the air: a `visit`, then a `return`,
  // then null (cruise). One driver throughout — R46: `AnimatedValue` holds a
  // single `_animation` and both `setValue` and `animate` stop the incumbent,
  // so the legal move is stop, rebuild the track, and re-run `t` from 0 in a
  // TIMING. Never a spring onto a just-rewound value; that is the one
  // configuration R46 left open.
  const [plan, setPlan] = useState(null);
  const planRef = useRef(null);
  planRef.current = plan;
  const t = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const posRef = useRef({ x: 0, y: 0 });
  const beeOpacityRef = useRef(1);
  const loopRef = useRef(null);
  const trailTimerRef = useRef(null);
  const nextTrailIndexRef = useRef(0);
  const containerRef = useRef(null);
  // Window origin of this component's own box. Measured once per layout and
  // then held, which is sound precisely because §28.2's screen-anchoring is
  // deliberate (`HoneycombTab:358-361`) — this box never scrolls. The thing
  // that moves is the comb, and that is handled by aborting, not by re-aiming
  // (§28.9).
  const originRef = useRef({ x: 0, y: 0 });
  const pollinateKeyRef = useRef(null);
  // Ref so a new callback identity never restarts an in-progress flight.
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const onPollinateEndRef = useRef(onPollinateEnd);
  onPollinateEndRef.current = onPollinateEnd;

  const presetDef = preset ? PRESETS[preset] : null;
  const track = plan ?? (presetDef ? presetDef.track : CRUISE);
  const flightSuppressed = reduced || !active;
  const easing = plan ? plan.easing : presetDef ? PRESET_EASING : CRUISE_EASING;
  const durationMs = plan ? plan.durationMs : presetDef ? presetDef.duration : LOOP_MS;

  // Attitude is resolved against the measured container, not the path's
  // fractions — the call site names the box (`loginArc` is flown in a
  // 220×100 anchor, the cruise in a full-screen scene), and a heading read
  // off fractional deltas mis-faces the bee by up to 21° on a phone-shaped
  // container, differently on every device. Rebuilt only when the box, the
  // bee's size, or the track itself changes.
  const attitude = useMemo(
    () =>
      layout
        ? buildAttitude(track.path, {
            width: layout.width,
            height: layout.height,
            size,
            closed: !presetDef && !plan,
            easing,
            durationMs,
          })
        : null,
    [layout, size, preset, plan]
  );

  // One interpolation node per channel, built once and shared by the render
  // style AND the sampler below. Two things rest on that single identity, and
  // only the first is obvious:
  //
  //  * **drift** — a node built fresh in each place could hold a different
  //    spec even though both were written from the same source arrays.
  //  * **liveness** — the sampler reads these nodes by calling `__getValue()`
  //    on them from inside a listener on `t`. A node rebuilt in the render
  //    body leaves that listener holding whichever copy existed when the
  //    effect last ran: correct only for as long as two dep arrays happen to
  //    agree, and the dep array is the thing most likely to be edited by
  //    someone who does not know a listener depends on it. Memoised, **the
  //    node is the dependency** — the effect below lists these identifiers
  //    rather than the inputs they were built from.
  const presetOpacity = useMemo(
    () => (presetDef?.opacity ? t.interpolate(presetDef.opacity) : null),
    [preset]
  );
  const translateX = useMemo(
    () =>
      layout
        ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.x * layout.width) })
        : null,
    [layout, track]
  );
  const translateY = useMemo(
    () =>
      layout
        ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.y * layout.height) })
        : null,
    [layout, track]
  );

  // Fixed pool of trail-particle drivers — hard-capped per §12.5 Rule 3
  // (bee trail is the #1 low-end perf risk). Reused round-robin instead of
  // growing an array, so live particle count never exceeds the cap.
  //
  // `drift` is the pollen burst's only addition to the pool: a trail particle
  // is dropped and fades in place, a pollen fleck is dropped and pushed
  // outward. Same particle, different push — which is why the burst reuses
  // this pool rather than adding a second one, and why the hard cap still
  // means what §12.5 Rule 3 says it means.
  const trailPool = useRef(
    Array.from({ length: MAX_TRAIL_PARTICLES }).map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      driftX: new Animated.Value(0),
      driftY: new Animated.Value(0),
      pos: { x: 0, y: 0 },
    }))
  ).current;
  const [, forceTrailRender] = useState(0);

  const takeSlot = () => {
    const slot = trailPool[nextTrailIndexRef.current];
    nextTrailIndexRef.current = (nextTrailIndexRef.current + 1) % trailPool.length;
    return slot;
  };

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setLayout({ width, height });
    // §28.2 — measure the bee's own container, not the target's. Everything
    // arriving from the comb is in window coordinates and converts through
    // this one number.
    containerRef.current?.measureInWindow?.((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) originRef.current = { x, y };
    });
  };

  // Live numeric read of the current translated position and of the bee's own
  // opacity, kept in refs (not state) so the 160ms trail tick and the plan
  // builders can sample them without re-rendering every frame.
  //
  // **Listen on `t`; read the nodes.** R89 — a listener on a DERIVED node
  // (`t.interpolate(...)`) is registered and then never called once `t` goes
  // native. `AnimatedWithChildren.__callListeners` cascades to children only
  // `if (!this.__isNative)` (`:74`), and `__makeNative` walks *down* (`:24-39`),
  // so every descendant of a natively-driven value loses its listeners — the
  // class of the child is irrelevant, and attaching it to a real transform
  // does not help (measured: 0 callbacks in 800ms either way). That guard is
  // *correct*: under the native driver JS has no fresh value to propagate, and
  // RN chose frozen over stale. It is also why `posRef` held its initialiser
  // `{ x: 0, y: 0 }` for the lifetime of the component, and why the break that
  // "costs no teleport" started every flight in this container's top-left
  // corner instead — for as long as the beat has existed.
  //
  // `AnimatedValue` DOES override `addListener` (`AnimatedValue.js:137-145`)
  // to open a native update subscription, and `__makeNative` (`:130-134`)
  // opens one for listeners that were already registered — so this fires
  // whichever order the effects run in, once per display frame. `_updateValue`
  // writes `this._value` (`:359`) before calling listeners (`:363`), so
  // `__getValue()` down the chain is already current inside the callback.
  //
  // What it reads is not the same arithmetic as the render — it is the same
  // *node*, the one in the transform at the bottom of this file. It therefore
  // cannot drift from what is on screen, and there is no captured `track` to
  // go stale behind. `__getValue` is private API: that is the price, and it is
  // cheaper than re-deriving the interpolation in JS, which reintroduces
  // exactly the drift the memo above exists to prevent.
  useEffect(() => {
    if (!layout || flightSuppressed) return undefined;
    // Cruise opacity is a constant 1, so there is nothing to sample; a preset
    // is the only flight whose bee fades, and a seeded particle scales by this.
    if (!presetOpacity) beeOpacityRef.current = 1;
    const id = t.addListener(() => {
      posRef.current.x = translateX.__getValue();
      posRef.current.y = translateY.__getValue();
      if (presetOpacity) beeOpacityRef.current = presetOpacity.__getValue();
    });
    return () => t.removeListener(id);
    // The nodes themselves are the deps. `translateX`/`translateY` change
    // identity exactly when `track` does (a new plan, a preset, a resize), and
    // `presetOpacity` exactly when `preset` does — so this can no longer be
    // right by coincidence between two hand-written dep arrays.
  }, [layout, flightSuppressed, translateX, translateY, presetOpacity]);

  // §28.5 — every speed in the beat derives from the cruise the bee is already
  // flying, so a re-authored `PATH` or a different container moves all of them
  // together. The published 187.59 px/s is what this returns at 393 x 852; it
  // is a consequence of the box, not a constant.
  const cruiseSpeed = layout ? cruiseSpeedPxS(PATH, layout.width, layout.height, LOOP_MS) : 0;
  const homePx = layout ? { x: PATH[0].x * layout.width, y: PATH[0].y * layout.height } : null;

  // Pollen. The count is derived from what the trail pool has spare, never
  // chosen: raise the cap or slow the cadence and it moves on its own.
  const pollenCount = pollenCountFor({
    poolSize: MAX_TRAIL_PARTICLES,
    trailFadeMs: DURATIONS.trailFade,
    trailIntervalMs: TRAIL_INTERVAL_MS,
  });

  const burstPollen = (landingCorner, ringStep) => {
    // The flecks leave the CHARACTER, not its box: `landingCorner` is the
    // top-left the track drives (§28.3), so put the burst's origin back at the
    // centre the same `size / 2` took it off.
    const origin = { x: landingCorner.x + size / 2, y: landingCorner.y + size / 2 };
    pollenFlecks(pollenCount, ringStep * POLLEN_RADIUS_FRACTION).forEach((fleck) => {
      const slot = takeSlot();
      slot.pos.x = origin.x;
      slot.pos.y = origin.y;
      slot.driftX.setValue(0);
      slot.driftY.setValue(0);
      // Same seed as a trail drop. The burst reads as an event through its
      // count and its outward push, not by being brighter than the trail that
      // led to it — one fewer invented number, and it keeps R51's "no particle
      // outglows the bee it came from" true without a second rule.
      slot.opacity.setValue(0.8 * beeOpacityRef.current);
      slot.scale.setValue(1);
      Animated.parallel([
        Animated.timing(slot.driftX, { toValue: fleck.dx, duration: DURATIONS.trailFade, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slot.driftY, { toValue: fleck.dy, duration: DURATIONS.trailFade, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slot.opacity, { toValue: 0, duration: DURATIONS.trailFade, useNativeDriver: true }),
        Animated.timing(slot.scale, { toValue: 0.3, duration: DURATIONS.trailFade, useNativeDriver: true }),
      ]).start();
    });
    forceTrailRender((n) => n + 1);
  };

  const returnFromHere = () =>
    buildReturnPlan({
      from: { ...posRef.current },
      home: homePx,
      width: layout.width,
      height: layout.height,
      cruiseSpeedPxS: cruiseSpeed,
      easing: CRUISE_EASING,
    });

  // A target arrives, or the one in the air stops being the one you tapped.
  //
  // §28.9, ratified: **the flight aborts; it does not re-aim.** By §28.1 the
  // bee is off the critical path, so a bee that gives up costs the user
  // exactly nothing — while a bee that chases a moving cell is doing the very
  // thing "never fetch the card" exists to prevent. And abort needs no new
  // mechanism: it IS the return leg, started early, with no pollen because he
  // never landed.
  //
  // A second tap mid-flight re-targets by the same stop-and-rebuild, so unlike
  // `BeeTransition` this beat needs no cooldown — there is no state to protect.
  useEffect(() => {
    if (!layout || flightSuppressed) return;
    if (!pollinate) {
      if (planRef.current?.kind === 'visit') setPlan(returnFromHere());
      return;
    }
    if (pollinate.key === pollinateKeyRef.current) return;
    pollinateKeyRef.current = pollinate.key;
    // §28.3 — the waypoint names a CORNER, not a bee. `styles.bee` is
    // absolutely positioned with no offsets, so `translateX/Y` place the
    // top-left of the box; the character is centred inside it. Uncorrected the
    // bee lands `size / 2` down and right of the face he came to visit, which
    // on a 7-seat comb is 0.408 of a seat step — most of the way to the
    // neighbour. One place, one expression.
    const target = {
      x: pollinate.x - originRef.current.x - size / 2,
      y: pollinate.y - originRef.current.y - size / 2,
    };
    setPlan({
      ...buildPollinationPlan({
        from: { ...posRef.current },
        target,
        ringStep: pollinate.ringStep,
        width: layout.width,
        height: layout.height,
        approachSpeedPxS: cruiseSpeed * APPROACH_SPEED_RATIO,
        easeApproach: Easing.inOut(Easing.ease),
        easeDescent: Easing.out(Easing.cubic),
      }),
      ringStep: pollinate.ringStep,
    });
  }, [pollinate, layout, flightSuppressed]);

  // Drive the flight — looping cruise, a one-shot preset that settles, or a
  // pollination visit/return.
  useEffect(() => {
    if (!layout || flightSuppressed) {
      loopRef.current?.stop();
      return undefined;
    }
    t.setValue(0);
    if (plan) {
      loopRef.current = Animated.timing(t, {
        toValue: 1,
        duration: plan.durationMs,
        easing: plan.easing,
        useNativeDriver: true,
      });
      loopRef.current.start(({ finished }) => {
        if (!finished) return;
        if (plan.kind === 'visit') {
          burstPollen(plan.landing, plan.ringStep);
          // The abort window closes the instant he lands; tell the host so it
          // stops publishing scroll positions for a flight that can no longer
          // be aborted.
          onPollinateEndRef.current?.();
          setPlan(returnFromHere());
        } else {
          // §28.4 — the return ends exactly on `PATH[0]`, and `PATH[0] ===
          // PATH[4]`, so `t` restarting at 0 resumes the loop with zero
          // discontinuity. The only place a return can end without a seam.
          setPlan(null);
        }
      });
    } else if (presetDef) {
      loopRef.current = Animated.timing(t, {
        toValue: 1,
        duration: presetDef.duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      loopRef.current.start(({ finished }) => {
        if (finished) onSettleRef.current?.();
      });
    } else {
      loopRef.current = Animated.loop(
        Animated.timing(t, {
          toValue: 1,
          duration: LOOP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }
    return () => loopRef.current?.stop();
  }, [layout, flightSuppressed, preset, plan]);

  // A suppressed preset flight settles instantly — the host is waiting on
  // onSettle to move on, and there is no parked pose for an entrance.
  useEffect(() => {
    if (presetDef && flightSuppressed) onSettleRef.current?.();
  }, [flightSuppressed, preset]);

  // Drop a pooled glow-trail particle at the bee's current position on a
  // fixed cadence, fading it out over DURATIONS.trailFade. Paused whenever
  // the flight itself is paused (reduced motion, inactive, or no layout).
  //
  // §17.3 R51 addendum 1 (final): seed-scale, don't cut off. An earlier
  // pass stopped dropping particles once the bee's own fade began, so the
  // trail went dark for the back ~58% of a one-shot flight — deleting the
  // named glow from most of the one flight a cold launch actually shows.
  // Instead every dropped particle's seed opacity is scaled by the bee's
  // OWN opacity at the moment it's born (`0.8 * beeOpacityRef.current`),
  // read off the same interpolation the render uses. That satisfies "no
  // particle outglows the bee it came from" literally — worst case is a
  // particle seeded a hair before settle, already near-zero — while
  // keeping the glow lit the whole arc. Cruise opacity is a constant 1, so
  // the scale is the identity there; no preset-vs-cruise branch needed.
  useEffect(() => {
    if (!layout || flightSuppressed) return undefined;
    trailTimerRef.current = setInterval(() => {
      const slot = takeSlot();
      slot.pos.x = posRef.current.x;
      slot.pos.y = posRef.current.y;
      // Reset the pollen push: the pool is shared, so a slot last used as a
      // fleck still holds its outward drift.
      slot.driftX.setValue(0);
      slot.driftY.setValue(0);
      slot.opacity.setValue(0.8 * beeOpacityRef.current);
      slot.scale.setValue(1);
      forceTrailRender((n) => n + 1);
      Animated.parallel([
        Animated.timing(slot.opacity, { toValue: 0, duration: DURATIONS.trailFade, useNativeDriver: true }),
        Animated.timing(slot.scale, { toValue: 0.3, duration: DURATIONS.trailFade, useNativeDriver: true }),
      ]).start();
    }, TRAIL_INTERVAL_MS);
    return () => clearInterval(trailTimerRef.current);
  }, [layout, flightSuppressed, preset]);

  // Reduced motion (§12.5 Rule 4) / parked (inactive): no flight, no
  // particles — a small static bee that breathes via opacity only.
  useEffect(() => {
    if (!flightSuppressed || presetDef) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: DURATIONS.reducedMotionFade * 4, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: DURATIONS.reducedMotionFade * 4, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flightSuppressed, preset]);

  if (flightSuppressed) {
    if (presetDef) return null;
    const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
    return (
      <View style={[styles.parkedAnchor, style]} pointerEvents="none">
        <Animated.View style={{ opacity }}>
          <MascotBee size={size} />
        </Animated.View>
      </View>
    );
  }

  // `translateX`/`translateY` are the memoised nodes above, because something
  // samples them. `rotate` and `scaleX` stay here, rebuilt per render, because
  // nothing does — memoise them the same way the moment anything listens.
  //
  // Two channels, never one angle. `rotate` is a bank bounded by ±22° by
  // construction; `scaleX` is the mirror, and it crosses zero at the same
  // instant the bank does, so a facing change reads as the bee wheeling
  // around rather than an angle popping. Transform order matters and is
  // not cosmetic: RN folds the array left to right onto a row vector, so
  // the *last* entry is applied first — scaleX must sit after rotate for
  // the bee to be mirrored and then banked, and the sign of the bank is
  // already folded into `rotateOutput` for that reason.
  const rotate = attitude
    ? t.interpolate({
        inputRange: attitude.inputRange,
        outputRange: attitude.rotateOutput.map((deg) => `${deg}deg`),
      })
    : '0deg';
  const scaleX = attitude
    ? t.interpolate({ inputRange: attitude.inputRange, outputRange: attitude.scaleXOutput })
    : 1;
  const flightOpacity = presetOpacity ?? 1;

  return (
    <View ref={containerRef} style={[styles.fill, style]} onLayout={onLayout} pointerEvents="none">
      {layout &&
        trailPool.map((slot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.trailDot,
              {
                opacity: slot.opacity,
                // `pos` is where the particle was born (a plain number, set
                // once) and `drift` is the pollen push (zero for a trail
                // drop). Two translations compose additively, so one pool
                // serves both. `scale` stays last: RN applies the array
                // right-to-left, so it scales about the fleck's own centre
                // before it is moved.
                transform: [
                  { translateX: slot.pos.x },
                  { translateY: slot.pos.y },
                  { translateX: slot.driftX },
                  { translateY: slot.driftY },
                  { scale: slot.scale },
                ],
              },
            ]}
          />
        ))}
      {layout && (
        <Animated.View
          style={[
            styles.bee,
            {
              opacity: flightOpacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scaleX }],
            },
          ]}
        >
          <MascotBee size={size} flutter />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  bee: {
    position: 'absolute',
  },
  trailDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accentBurst,
  },
  parkedAnchor: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 5,
  },
});
