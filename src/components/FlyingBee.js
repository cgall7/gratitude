import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MascotBee } from './MascotBee';
import { buildAttitude } from './beeAttitude';
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

export const FlyingBee = ({ active = true, size = DEFAULT_SIZE, style, preset, onSettle }) => {
  const reduced = useReducedMotion();
  const [layout, setLayout] = useState(null);
  const t = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const posRef = useRef({ x: 0, y: 0 });
  const beeOpacityRef = useRef(1);
  const loopRef = useRef(null);
  const trailTimerRef = useRef(null);
  const nextTrailIndexRef = useRef(0);
  // Ref so a new callback identity never restarts an in-progress flight.
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  const presetDef = preset ? PRESETS[preset] : null;
  const track = presetDef ? presetDef.track : CRUISE;
  const flightSuppressed = reduced || !active;
  const easing = presetDef ? PRESET_EASING : CRUISE_EASING;
  const durationMs = presetDef ? presetDef.duration : LOOP_MS;

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
            closed: !presetDef,
            easing,
            durationMs,
          })
        : null,
    [layout, size, preset]
  );

  // One interpolation node per preset, shared by the render style AND the
  // trail sampler below — a node built fresh in each place could drift
  // across re-renders even though both read the same spec. `t` is a stable
  // ref so this only rebuilds when `preset` itself changes.
  const presetOpacity = useMemo(
    () => (presetDef?.opacity ? t.interpolate(presetDef.opacity) : null),
    [preset]
  );

  // Fixed pool of trail-particle drivers — hard-capped per §12.5 Rule 3
  // (bee trail is the #1 low-end perf risk). Reused round-robin instead of
  // growing an array, so live particle count never exceeds the cap.
  const trailPool = useRef(
    Array.from({ length: MAX_TRAIL_PARTICLES }).map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      pos: { x: 0, y: 0 },
    }))
  ).current;
  const [, forceTrailRender] = useState(0);

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setLayout({ width, height });
  };

  // Live numeric read of the current translated position, kept in a ref
  // (not state) so the 160ms trail-drop tick can sample it without
  // re-rendering the whole component every frame. Same pattern covers the
  // bee's own opacity for one-shot presets — read off the identical
  // `presetDef.opacity` spec the render interpolates, never a second
  // hand-derived easing, so a seeded trail particle can never claim a
  // brighter opacity than the bee it was born from.
  useEffect(() => {
    if (!layout || flightSuppressed) return undefined;
    const translateX = t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.x * layout.width) });
    const translateY = t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.y * layout.height) });
    const xId = translateX.addListener(({ value }) => { posRef.current.x = value; });
    const yId = translateY.addListener(({ value }) => { posRef.current.y = value; });
    let oId = null;
    if (presetOpacity) {
      oId = presetOpacity.addListener(({ value }) => { beeOpacityRef.current = value; });
    } else {
      beeOpacityRef.current = 1;
    }
    return () => {
      translateX.removeListener(xId);
      translateY.removeListener(yId);
      if (presetOpacity) presetOpacity.removeListener(oId);
    };
  }, [layout, flightSuppressed, preset, presetOpacity]);

  // Drive the flight — looping cruise, or a one-shot preset that settles.
  useEffect(() => {
    if (!layout || flightSuppressed) {
      loopRef.current?.stop();
      return undefined;
    }
    t.setValue(0);
    if (presetDef) {
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
  }, [layout, flightSuppressed, preset]);

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
      const slot = trailPool[nextTrailIndexRef.current];
      nextTrailIndexRef.current = (nextTrailIndexRef.current + 1) % trailPool.length;
      slot.pos.x = posRef.current.x;
      slot.pos.y = posRef.current.y;
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

  const translateX = layout ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.x * layout.width) }) : 0;
  const translateY = layout ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.y * layout.height) }) : 0;
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
    <View style={[styles.fill, style]} onLayout={onLayout} pointerEvents="none">
      {layout &&
        trailPool.map((slot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.trailDot,
              {
                opacity: slot.opacity,
                transform: [
                  { translateX: slot.pos.x },
                  { translateY: slot.pos.y },
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
