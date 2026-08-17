import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MascotBee } from './MascotBee';
import { buildAttitude } from './beeAttitude';
import {
  APPROACH_SPEED_RATIO,
  POLLEN_RADIUS_FRACTION,
  buildPollinationPlan,
  composeSegmentEasing,
  pollenCountFor,
  pollenFlecks,
} from './pollinationFlight';
import {
  DART_SPEED_RATIO,
  STUB_GRAMMAR,
  chooseAnchor,
  makeRng,
  nextBeat,
  referenceSpeedPxS,
  resolveBeat,
  resolveGrammar,
} from './flightSequencer';
import { theme } from '../constants/theme';
import { MASCOT_WIDTH_FRACTION } from '../constants/mascot';
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
// §32.2 — **there is no cruise path any more.** The fixed 5-waypoint `PATH`
// on a 7000ms `Animated.loop` is deleted, not kept as a fallback, and the
// deletion is the ruling rather than a consequence of one: a fallback lap
// survives on whatever screen forgets to declare anchors, and that screen is
// exactly the one nobody looks at until Colin does. What replaces it is
// `flightSequencer` — the bee rests at a declared anchor, sometimes looks
// around, then darts to a different one, and the only thing that decides
// "different" is a seeded choice over the anchors the SCREEN declared
// (`PerchAnchor`). Nothing here knows what it is flying over.
//
// Two consequences worth stating where they will be read:
//
//  * **No perch set, no bee.** A cruise mount with fewer than two declared
//    anchors has nowhere to go, so it fades out over `PRESENCE_FADE_MS` and
//    stops — that is the whole mechanism behind the two ratified suppressions
//    (HoneycombTab's week view, TodayTab's error arm), each expressed as one
//    expression at its own call site rather than as a special case in here.
//  * **The §28.4 return seam dissolves rather than generalising.** The return
//    leg existed to land exactly on `PATH[0]` so `Animated.loop` could resume
//    without a discontinuity. With no loop there is no seam to hit: after a
//    visit, or after an abort, the next beat is simply a sortie to the next
//    chosen anchor — the same flight `buildReturnPlan` was flying, minus the
//    fixed destination.
//
// §28.5's speeds survive the deletion untouched, which is why they could be
// deleted from: `referenceSpeedPxS` reproduces the shipped 187.59 px/s to
// 0.06% at 393x852 because it is the same fractional path resolved against
// the same box, stated per-diagonal. See `CRUISE_DIAG_PER_S`.
//
// **Attitude is no longer part of that.** Which way the bee points and how
// far it tips is now `beeAttitude.js`, a bounded rule rather than a
// heading — and any new waypoint set inherits it for free, which is the
// point. Read that file before changing a path: `scripts/check-bee-attitude`
// resolves every `<FlyingBee>` call site's container and will fail on a
// path that flies the mascot at an attitude it can't be read at, or on a
// call site the table doesn't know about.
const TRAIL_INTERVAL_MS = 160;
const DEFAULT_SIZE = 44;

// How long the bee takes to leave, and to arrive, when a screen state stops
// (or starts) declaring anywhere to land.
//
// It is `settleMs` deliberately — the same 160ms the descent takes. A bee
// leaving is not a new gesture that needs a new number, and the two places a
// mascot appears and disappears reading at the same pace is the whole of why
// `DESCENT_MS` was pinned rather than tuned.
const PRESENCE_FADE_MS = STUB_GRAMMAR.settleMs;

// How many anchor keys the anti-repeat memory carries. `chooseAnchor` reads
// the TAIL of this, so it only has to be at least the largest depth any
// grammar will ask for; the rest is slack, and slack costs one string.
const RECENT_MEMORY = 8;

// Stable identity for "no perch set", so a mount without one does not hand a
// fresh `[]` to a dep array on every render.
const EMPTY_KEYS = [];

// A track is *position only*. Attitude — which way the bee points and how
// far it tips — is not a property of a fractional path: it needs the
// container's pixel dimensions and the bee's own size, neither of which
// exists at module scope. See `beeAttitude.js`, and `buildAttitude` in the
// component below.
const buildTrack = (path) => ({
  path,
  inputRange: path.map((_, i) => i / (path.length - 1)),
});

// Hoisted so the attitude builder can be handed the *same* easing the
// timing driver runs, rather than a second copy that could drift: a facing
// change is specified in wall time and only the easing converts that into
// a window in `t`.
const PRESET_EASING = Easing.out(Easing.cubic);

// The three easings a sequenced beat is flown on, named once. `dart` and
// `settle` are §28.5's approach and descent verbatim — a sortie IS a
// pollination visit without the pollen, so it must not be flown on a second
// pair that could drift from the one the tap uses.
const BEAT_EASINGS = {
  dart: Easing.inOut(Easing.ease),
  settle: Easing.out(Easing.cubic),
  hover: Easing.inOut(Easing.ease),
};

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
//
// §32.2 — `perches` is the live anchor set from `usePerchSet()`, or null.
// Null is not a degraded mode, it is the OFF switch: a cruise mount that is
// handed no anchors has nowhere to land and renders no bee. The host gates it
// (`perches={hiveView === 'week' ? null : perches}`) so that the two ratified
// suppressions read as one expression on the screen that owns the decision,
// instead of as a list of screen names in here.
export const FlyingBee = ({
  active = true,
  size = DEFAULT_SIZE,
  style,
  preset,
  onSettle,
  pollinate = null,
  onPollinateEnd,
  perches = null,
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
  // §32.2 — presence, not opacity-of-the-bee. It fades the whole flight box,
  // trail particles included, so a bee leaving a screen does not leave its own
  // glow hanging in the air behind it. Starts at 0 for a sequenced mount
  // because anchors register a frame after layout: the bee fades IN when the
  // screen finishes declaring where he can stand, which is the arrival this
  // beat should have had all along.
  const presence = useRef(new Animated.Value(preset ? 1 : 0)).current;
  // The machine's memory. Refs, not state: nothing renders off them, and a
  // beat is chosen inside an animation completion callback where a state read
  // would be one render behind.
  const recentRef = useRef([]);
  const rngRef = useRef(null);
  if (!rngRef.current) {
    // Per-session seed, per mount — Principle 4. Reproducibility lives in the
    // gate, which passes its own seed to the same `makeRng`; a shipped bee
    // that started from the same seed every launch would be the screensaver
    // with one extra layer of indirection.
    rngRef.current = makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  }
  const posRef = useRef({ x: 0, y: 0 });
  const beeOpacityRef = useRef(1);
  const loopRef = useRef(null);
  const trailTimerRef = useRef(null);
  const nextTrailIndexRef = useRef(0);
  const containerRef = useRef(null);
  // Last known window origin of this component's own box (§28.2). Seeded at
  // layout, refreshed at the moment of use — see `readOrigin` below for why it
  // is not simply cached.
  const originRef = useRef({ x: 0, y: 0 });
  const pollinateKeyRef = useRef(null);
  // Ref so a new callback identity never restarts an in-progress flight.
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const onPollinateEndRef = useRef(onPollinateEnd);
  onPollinateEndRef.current = onPollinateEnd;

  const presetDef = preset ? PRESETS[preset] : null;
  const track = plan ?? presetDef?.track ?? null;
  const flightSuppressed = reduced || !active;
  const easing = plan ? plan.easing : PRESET_EASING;
  const durationMs = plan ? plan.durationMs : presetDef ? presetDef.duration : 0;

  // §32.2 — is there anywhere to go? Two anchors is the floor and it is
  // `chooseAnchor`'s, not a taste call: with one anchor the bee flies a
  // zero-length sortie to the point he is already standing on, which is worse
  // than the loop this replaces. `resolveGrammar` returns null for the same
  // set and for the same reason, so the two agree by construction.
  //
  // A preset flight has no anchors and needs none — it is a one-shot arc to a
  // destination its host named, and it is not sequenced.
  const anchorKeys = perches?.keys ?? EMPTY_KEYS;
  const sequenced = !presetDef;
  const canSequence = sequenced && anchorKeys.length >= 2;
  // Everything that makes a bee visible or animated is off when this is true.
  // Note it is NOT folded into `flightSuppressed`: suppressed means "parked" —
  // a small static bee that breathes in the corner, which is the right answer
  // for Reduce Motion and for a text field taking focus. Halted means "not
  // here at all", which is the ratified answer for the week feed and the error
  // arm. Collapsing the two would have shipped a parked bee onto both.
  const sequenceHalted = sequenced && !canSequence;

  // Attitude is resolved against the measured container, not the path's
  // fractions — the call site names the box (`loginArc` is flown in a
  // 220×100 anchor, the cruise in a full-screen scene), and a heading read
  // off fractional deltas mis-faces the bee by up to 21° on a phone-shaped
  // container, differently on every device. Rebuilt only when the box, the
  // bee's size, or the track itself changes.
  //
  // `closed` is now always false, and that is the deletion of `PATH` showing
  // up two files away: the seam it wraps belonged to the looping cruise, and
  // no sequenced beat repeats — a hover's ellipse closes geometrically but is
  // flown once and handed to the next beat, so its tail holds rather than
  // wrapping. `heldFacing` is what replaces the continuity the seam gave: each
  // plan carries the facing the previous one ended on, so a perch (whose first
  // segment has `dx === 0`) does not snap the bee to face right.
  const attitude = useMemo(
    () =>
      layout && track
        ? buildAttitude(track.path, {
            width: layout.width,
            height: layout.height,
            size,
            closed: false,
            easing,
            durationMs,
            heldFacing: plan?.heldFacing,
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
      layout && track
        ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.x * layout.width) })
        : null,
    [layout, track]
  );
  const translateY = useMemo(
    () =>
      layout && track
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
  //
  // §28.13 — `pos` is an `Animated.Value` pair and MUST stay one. It used to
  // be two plain numbers mutated in place plus a state bump to re-render, and
  // every particle in the app rendered at the container origin for as long as
  // that was true. A plain number sharing a `transform` array with a natively
  // driven node is frozen at its first-committed value, by two steps that are
  // each deliberate:
  //
  //   1. `createAnimatedPropsMemoHook.js:162-189` builds the memo key from
  //      `AnimatedNode` instances only — a plain number becomes `null` in the
  //      key, so changing it cannot rebuild the `AnimatedProps` node. Measured
  //      in the running app: two styles differing only in `translateX`
  //      (0 -> 211) compare `areCompositeKeysEqual === true`.
  //   2. `AnimatedTransform.js:147-156` bakes non-node entries into the native
  //      config as `{type: 'static', value}`. That config is generated once,
  //      when the node is made native, and the node is never rebuilt. Measured:
  //      `{"type":"static","property":"translateX","value":0}`.
  //
  // The JS render path is fine (`__getValueWithStaticTransforms` reads the
  // fresh array), which is exactly why this was invisible in a state dump: the
  // model was right and only the native side was stale. `setValue` on an
  // `Animated.Value` routes to the native node, so a node-valued `pos` cannot
  // reach that state.
  const trailPool = useRef(
    Array.from({ length: MAX_TRAIL_PARTICLES }).map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      driftX: new Animated.Value(0),
      driftY: new Animated.Value(0),
      pos: { x: new Animated.Value(0), y: new Animated.Value(0) },
    }))
  ).current;

  const takeSlot = () => {
    const slot = trailPool[nextTrailIndexRef.current];
    nextTrailIndexRef.current = (nextTrailIndexRef.current + 1) % trailPool.length;
    return slot;
  };

  // §28.2 — measure the bee's own container, not the target's. Everything
  // arriving from the comb is in window coordinates and converts through this
  // one number.
  //
  // Measure-on-use, not cache-on-layout, and the difference is a defect class:
  // `onLayout` is emitted only from a Yoga pass (`ShadowTree.cpp:571-574` ->
  // `YogaLayoutableShadowNode.cpp:701`) and Yoga does not handle transforms at
  // all (`YGNode.h:279`), so a container moved by an ancestor *transform*
  // leaves a cached origin stale with no signature — the miss is small,
  // silent, and has no sign to spot it by.
  //
  // The callback is synchronous on this stack: `NativeDOM.cpp:439-440` calls it
  // in line, measured `ranBeforeReturn: true` in the running app. That is why
  // this reads like a getter. If it ever stops being synchronous the write
  // simply lands late and we return the previous value, which is exactly the
  // cache-on-layout behaviour this replaces — never worse, so the shape is
  // safe either way.
  //
  // What it does NOT buy is immunity to *why* the box moved. `measureInWindow`
  // reads the shadow tree (`DOM.cpp:536-539`, `includeTransform: true`), and a
  // `useNativeDriver: true` transform never reaches it — it is written straight
  // onto the layer (`RCTMountingManager.mm:316-324`). Measured: 18 samples of
  // `y = 0` while a natively-driven view slid 200pt. So a natively-animated
  // ancestor (a collapse-on-scroll header is the obvious one) still lies to
  // this, and the guarantee that closes it is structural rather than measured:
  // a pollinate-capable mount must not sit under a native-driven transform.
  const readOrigin = () => {
    containerRef.current?.measureInWindow?.((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) originRef.current = { x, y };
    });
    return originRef.current;
  };

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setLayout({ width, height });
    readOrigin();
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
    if (!layout || flightSuppressed || !translateX) return undefined;
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

  // §28.5 / §32.1 — every speed in the beat still derives from one reference,
  // and the reference is still a property of the box rather than a constant.
  // What changed is only where it is measured from: it was the resolved length
  // of `PATH` over `LOOP_MS`, and `PATH` is gone, so it is now the same
  // quantity stated per diagonal. 187.59 px/s at 393 x 852 either way, to
  // 0.06% — see `CRUISE_DIAG_PER_S` for the seven boxes that were measured to
  // establish the diagonal is the basis that makes that true.
  const cruiseSpeed = layout ? referenceSpeedPxS(layout.width, layout.height) : 0;
  const bodyLengthPx = MASCOT_WIDTH_FRACTION * size;

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
      slot.pos.x.setValue(origin.x);
      slot.pos.y.setValue(origin.y);
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
  };

  // --- §32.2, the sequencer's side of the boundary ------------------------
  //
  // Anchors are resolved HERE, at the moment of choosing, and never cached.
  // `PerchAnchor.read` calls `measureInWindow` on the element itself, so the
  // point the bee flies to is where that card is standing right now — after a
  // scroll, after a keyboard, after a card appeared above it. There is no
  // coordinate to go stale because there is no coordinate stored, and that is
  // strictly better than a scroll listener: no throttle, no re-render, and no
  // window in which the two disagree.
  //
  // The conversion is the one `pollinate` already does and it is done in one
  // place for both: window point, minus this box's own origin, minus the
  // half-box that turns a corner-driven track into a centred character (§28.3).
  const readAnchors = () => {
    if (!perches || !layout) return [];
    const boxOrigin = readOrigin();
    return anchorKeys
      .map((key) => {
        const p = perches.read(key);
        return p ? { key, x: p.x - boxOrigin.x - size / 2, y: p.y - boxOrigin.y - size / 2 } : null;
      })
      .filter(Boolean);
  };

  // A sortie's duration for a given hop, computed by the builder that will fly
  // it. `perchRangeFor` takes this as an argument for exactly one reason: the
  // dwell is solved to hit an airborne FRACTION, so it has to be solved against
  // the real plan geometry — staging offset and settle included — rather than
  // against a second copy of the arithmetic living in the grammar.
  const sortieDurationFor = (hopPx) =>
    buildPollinationPlan({
      from: { x: 0, y: 0 },
      target: { x: hopPx, y: 0 },
      ringStep: Infinity,
      bodyLengthPx,
      width: layout.width,
      height: layout.height,
      approachSpeedPxS: cruiseSpeed * DART_SPEED_RATIO,
      easeApproach: BEAT_EASINGS.dart,
      easeDescent: BEAT_EASINGS.settle,
    }).durationMs;

  /**
   * Advance the machine one beat: choose, resolve, fly.
   *
   * `finishedState` is the beat that just ended — `nextBeat` branches on it,
   * and 'perch' is the state that produces a sortie, which is why an ABORT
   * passes 'perch'. That is not a lie about what happened; it is the sentence
   * "he has finished being where he was, go somewhere". §28.9's ruling is
   * unchanged and it is now free: aborting is leaving, and leaving is the only
   * thing this machine does.
   *
   * The grammar is re-solved per beat rather than once per anchor-set change,
   * and the reason is the measure-on-use above: the anchors have coordinates
   * only at the instant they are read, so a dwell solved at mount would be
   * solved against a layout the user has since scrolled. It is `meanHopPx`
   * over at most four anchors — twelve `hypot`s once every few seconds.
   */
  const advance = (finishedState) => {
    const anchors = readAnchors();
    const grammar = resolveGrammar({ grammar: STUB_GRAMMAR, anchors, sortieDurationFor });
    // Null grammar means fewer than two anchors, i.e. the screen stopped
    // declaring anywhere to go mid-flight. Stop; `sequenceHalted` fades him.
    if (!grammar) {
      setPlan(null);
      return;
    }
    const beat = nextBeat({
      state: finishedState,
      recent: recentRef.current,
      anchors,
      rng: rngRef.current,
      grammar,
    });
    const next = resolveBeat({
      beat,
      from: { ...posRef.current },
      width: layout.width,
      height: layout.height,
      bodyLengthPx,
      grammar,
      easings: BEAT_EASINGS,
      builders: { buildPollinationPlan, composeSegmentEasing },
      // The facing the bee is ACTUALLY wearing as this beat ends, read off the
      // same attitude the render is drawing with rather than recomputed from
      // the path — `scaleXOutput` is the mirror channel, ±1, and its last
      // entry is where the flight left him. Recomputing it here would be a
      // second copy of `beeAttitude`'s walk, and the seam it exists to close
      // (a perched bee snapping to face right, because a stationary path's
      // first segment has `dx === 0`) is exactly the kind that only shows up
      // when the two copies disagree.
      heldFacing: attitude?.scaleXOutput?.[attitude.scaleXOutput.length - 1],
    });
    if (!next) {
      setPlan(null);
      return;
    }
    if (next.anchorKey) {
      recentRef.current = [...recentRef.current, next.anchorKey].slice(-RECENT_MEMORY);
    }
    setPlan(next);
  };

  /**
   * Put the bee somewhere before the first beat.
   *
   * He starts PERCHED on a chosen anchor rather than flying in, and the choice
   * is not decoration: `posRef` is seeded from the animation and its
   * initialiser is `{ x: 0, y: 0 }`, so "just start a sortie" begins every
   * session with a flight out of this container's top-left corner — the exact
   * artefact R89 found already shipping, arrived at a second way. Seeding the
   * position from the anchor and opening with a landing beat means the first
   * thing the screen shows is a bee who was already here.
   */
  const start = () => {
    const anchors = readAnchors();
    if (anchors.length < 2) return false;
    const first = chooseAnchor(anchors, [], rngRef.current, STUB_GRAMMAR.antiRepeatDepth);
    if (!first) return false;
    posRef.current = { x: first.x, y: first.y };
    recentRef.current = [first.key];
    // 'sortie' = "a flight just ended here", which is what being placed on an
    // anchor is. `nextBeat` answers it with a hover or a perch, never with
    // another flight, so nothing moves until he has been seen standing still.
    advance('sortie');
    return true;
  };

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
    if (!layout || flightSuppressed || sequenceHalted) return;
    if (!pollinate) {
      // Abort. It used to be `buildReturnPlan` to `PATH[0]`; it is now just
      // the next beat, which is a sortie to a different anchor. Same flight,
      // no fixed destination — §28.4's seam had nothing left to close.
      if (planRef.current?.kind === 'visit') advance('perch');
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
    // `boxOrigin`, not `origin` — `origin` is already taken in this file by the
    // pollen emission point, and two different origins one screen apart is how
    // a later reader subtracts the wrong one.
    const boxOrigin = readOrigin();
    const target = {
      x: pollinate.x - boxOrigin.x - size / 2,
      y: pollinate.y - boxOrigin.y - size / 2,
    };
    setPlan({
      ...buildPollinationPlan({
        from: { ...posRef.current },
        target,
        ringStep: pollinate.ringStep,
        // C′ — the staging offset is the bee's own drawn length, so it is
        // measured here, in the box that owns the bee, and never inferred
        // from the comb. `size` is the BOX; the character inside it spans
        // `MASCOT_WIDTH_FRACTION` of that, and it is the character the eye
        // reads a length off.
        bodyLengthPx: MASCOT_WIDTH_FRACTION * size,
        width: layout.width,
        height: layout.height,
        approachSpeedPxS: cruiseSpeed * APPROACH_SPEED_RATIO,
        easeApproach: Easing.inOut(Easing.ease),
        easeDescent: Easing.out(Easing.cubic),
      }),
      ringStep: pollinate.ringStep,
    });
  }, [pollinate, layout, flightSuppressed, sequenceHalted]);

  // Drive the flight — one beat of the sequence, a one-shot preset that
  // settles, or a pollination visit.
  //
  // **Every state is a plan and the completion callback is the only thing that
  // advances the machine.** There is no `setTimeout` anywhere in the sequence,
  // and a perch is an `Animated.timing` driving a constant rather than a
  // pause — one driver, one mechanism, R46 unchanged. What that buys is that
  // an interrupt (a tap, a screen state change, an unmount) stops exactly one
  // thing and cannot leave a queued beat behind it.
  useEffect(() => {
    if (!layout || flightSuppressed || sequenceHalted) {
      loopRef.current?.stop();
      return undefined;
    }
    if (!plan && !presetDef) {
      // Nothing in the air and nothing to resume from: open the sequence.
      //
      // **And retry until it takes.** `anchorKeys` says a `PerchAnchor`
      // MOUNTED; it does not say the native view behind it has been laid out,
      // and `read()` returns null until the first `measureInWindow` lands.
      // Without the retry the two facts disagree exactly once — at the first
      // render after registration — and this effect's deps (`layout`, `plan`,
      // `preset`, the two suppressions) contain nothing that would ever change
      // again to bring it back. The bee would simply never appear, on a screen
      // whose anchors are all present and correct. A one-shot `start()` was
      // that bug, written and caught here.
      //
      // It is self-terminating rather than capped: success sets `plan`, which
      // re-runs this effect down the other branch. A screen where it never
      // succeeds is a screen whose anchors never measure, and one measure per
      // `PRESENCE_FADE_MS` is the right cost for the bee it is still trying to
      // put on it.
      if (!start()) {
        const retry = setInterval(() => {
          if (start()) clearInterval(retry);
        }, PRESENCE_FADE_MS);
        return () => clearInterval(retry);
      }
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
        }
        // A visit is a landing like any other: he may look around the cell he
        // just pollinated before leaving it. 'sortie' is the finished state for
        // every arrival, and the machine does not need to know which kind of
        // errand brought him.
        advance(plan.kind === 'visit' ? 'sortie' : plan.kind);
      });
    } else {
      loopRef.current = Animated.timing(t, {
        toValue: 1,
        duration: presetDef.duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      loopRef.current.start(({ finished }) => {
        if (finished) onSettleRef.current?.();
      });
    }
    return () => loopRef.current?.stop();
  }, [layout, flightSuppressed, sequenceHalted, preset, plan]);

  // §32.2 — arrive and leave at the descent's own pace. Driving `presence`
  // rather than unmounting keeps the fade honest in both directions: a screen
  // that stops declaring anchors mid-hover gets a bee that fades from wherever
  // he is, not one that vanishes on a frame boundary.
  useEffect(() => {
    Animated.timing(presence, {
      toValue: sequenceHalted ? 0 : 1,
      duration: PRESENCE_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [sequenceHalted]);

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
  //
  // §32.2 — and the trail is now a property of the BEAT, not of the component.
  // `plan.trail` is false for a perch and for a hover, because the glow marks
  // travel: a bee that stays inside a 17px bob for 1.5s otherwise piles ~9
  // particles into one blob at the anchor, and a perched bee would sit inside
  // a growing puddle of his own light.
  useEffect(() => {
    if (!layout || flightSuppressed || sequenceHalted) return undefined;
    if (plan && !plan.trail) return undefined;
    trailTimerRef.current = setInterval(() => {
      const slot = takeSlot();
      slot.pos.x.setValue(posRef.current.x);
      slot.pos.y.setValue(posRef.current.y);
      // Reset the pollen push: the pool is shared, so a slot last used as a
      // fleck still holds its outward drift.
      slot.driftX.setValue(0);
      slot.driftY.setValue(0);
      slot.opacity.setValue(0.8 * beeOpacityRef.current);
      slot.scale.setValue(1);
      Animated.parallel([
        Animated.timing(slot.opacity, { toValue: 0, duration: DURATIONS.trailFade, useNativeDriver: true }),
        Animated.timing(slot.scale, { toValue: 0.3, duration: DURATIONS.trailFade, useNativeDriver: true }),
      ]).start();
    }, TRAIL_INTERVAL_MS);
    return () => clearInterval(trailTimerRef.current);
  }, [layout, flightSuppressed, sequenceHalted, preset, plan]);

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

  // A screen that declares nowhere to land has no bee — parked or otherwise.
  // Easy to get backwards: Reduce Motion on the week feed must render NOTHING,
  // not a parked bee in the corner of a screen the ruling took the bee off.
  //
  // Halted under Reduce Motion returns immediately rather than fading, and
  // that is not an optimisation — a 160ms fade IS motion, and §12.5 Rule 4
  // has no exceptions. Halted with motion on keeps the tree mounted at
  // `presence: 0` instead of unmounting, because unmounting is how you get a
  // bee that vanishes on a frame boundary the first time the fade and the
  // render disagree about which of them finishes first.
  if (flightSuppressed) {
    if (presetDef || sequenceHalted) return null;
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
      <Animated.View style={[styles.fill, { opacity: presence }]} pointerEvents="none">
      {layout &&
        trailPool.map((slot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.trailDot,
              {
                opacity: slot.opacity,
                // `pos` is where the particle was born (jumped to with
                // `setValue`, never animated) and `drift` is the pollen push
                // (zero for a trail drop). Two translations compose additively,
                // so one pool serves both. `scale` stays last: RN applies the
                // array right-to-left, so it scales about the fleck's own
                // centre before it is moved.
                //
                // Every entry here is an `Animated.Value` and §28.13 is why:
                // one plain number in this array is frozen at its first commit.
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
      {layout && translateX && (
        <Animated.View
          style={[
            styles.bee,
            {
              opacity: flightOpacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scaleX }],
            },
          ]}
        >
          {/* §19.5 puts wing motion on the airborne path only, and the beat
              now says which that is: a perched bee holds his wings, a hovering
              one does not. `plan.flutter` is the plan builder's, so this stays
              one source rather than a second reading of `kind`. */}
          <MascotBee size={size} flutter={plan ? plan.flutter !== false : true} />
        </Animated.View>
      )}
      </Animated.View>
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
