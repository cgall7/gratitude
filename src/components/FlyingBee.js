import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { StripedBee } from './StripedBee';
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
// §17.3 flight ruling — flown as `StripedBee` with `bandColor={accent}`
// (the host under a cruising bee is never a known field, so a `fieldColor`
// knockout would paint an opaque band over whatever it's crossing) and
// `flutter` (airborne render path only — never on the parked/RM pose).
//
// Path/posture is a first engine pass (loose 5-point loop, eased timing
// driver) — Deezine owns cruise posture/wing-flutter/glow-particle design
// per §12.5 ownership split; swap the waypoint set or easing here without
// touching the trail/pooling engine.
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

// Rough heading per segment so the bee banks into its turn instead of
// sliding sideways — deliberately coarse, refined later against real
// on-device geometry.
const headingBetween = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

// `closed` paths (the cruise loop) wrap the final heading back to the
// first so the loop seam doesn't snap; one-shot presets hold their last
// heading into the settle instead.
const buildTrack = (path, { closed }) => {
  const headings = path.slice(0, -1).map((p, i) => headingBetween(p, path[i + 1]));
  return {
    path,
    inputRange: path.map((_, i) => i / (path.length - 1)),
    rotateOutput: [...headings, closed ? headings[0] : headings[headings.length - 1]],
  };
};

const CRUISE = buildTrack(PATH, { closed: true });

const PRESETS = {
  // Inward spiral: in from off-right, over the top, down the left edge,
  // under, then tightening up into the anchor's center. Fades over the
  // last stretch so the settle reads as the bee alighting, not vanishing.
  loginArc: {
    track: buildTrack(
      [
        { x: 1.08, y: 0.1 },
        { x: 0.55, y: -0.12 },
        { x: 0.1, y: 0.4 },
        { x: 0.58, y: 0.92 },
        { x: 0.5, y: 0.5 },
      ],
      { closed: false }
    ),
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
  //
  // Pollen reskin (Deezine, 2026-08-13, per Pixel's ownership ruling —
  // "straight visual swap on the existing trail engine, no touching
  // pooling/perf code"): `rotation` is the only thing added to the pool
  // itself, and it's a fixed per-slot value, not an animated one — a
  // stable tilt read off the slot index, not Math.random(), so scattered
  // dust costs nothing per drop and the pool stays exactly as cheap as it
  // was. 30deg apart across 12 slots means the round-robin reuse order
  // never drops two flecks at the same tilt back-to-back.
  const trailPool = useRef(
    Array.from({ length: MAX_TRAIL_PARTICLES }).map((_, i) => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      pos: { x: 0, y: 0 },
      rotation: i * (360 / MAX_TRAIL_PARTICLES),
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
          <StripedBee size={size} bandColor={theme.colors.accent} />
        </Animated.View>
      </View>
    );
  }

  const translateX = layout ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.x * layout.width) }) : 0;
  const translateY = layout ? t.interpolate({ inputRange: track.inputRange, outputRange: track.path.map((p) => p.y * layout.height) }) : 0;
  const rotate = layout
    ? t.interpolate({ inputRange: track.inputRange, outputRange: track.rotateOutput.map((deg) => `${deg}deg`) })
    : '0deg';
  const flightOpacity = presetOpacity ?? 1;

  return (
    <View style={[styles.fill, style]} onLayout={onLayout} pointerEvents="none">
      {layout &&
        trailPool.map((slot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.trailWrap,
              {
                opacity: slot.opacity,
                transform: [
                  { translateX: slot.pos.x },
                  { translateY: slot.pos.y },
                  { scale: slot.scale },
                  { rotate: `${slot.rotation}deg` },
                ],
              },
            ]}
          >
            {/* Two flat tones, not a rendered gradient — §19.5's LOD note
                applies here too (these flights sit at 22-44pt, well under
                the ~64pt hero-detail threshold), so the fleck stays a
                simple shape a viewer's eye fills in rather than a textured
                sprite that would smear at this scale. */}
            <View style={styles.trailHalo} />
            <View style={styles.trailCore} />
          </Animated.View>
        ))}
      {layout && (
        <Animated.View
          style={[styles.bee, { opacity: flightOpacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
        >
          <StripedBee size={size} bandColor={theme.colors.accent} flutter />
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
  // Pollen fleck: a soft golden halo (accent, tapered oval — not a perfect
  // circle, so a chain of them reads as scattered dust) around a small hot
  // core (accentBurst, the same "motion only, never a static fill" token
  // the old flat dot used). Concentric inside one rotated/scaled Animated
  // wrapper — the old trailDot WAS that wrapper (a single self-rendering
  // node); the pollen version is wrapper + halo + core, three nodes where
  // there was one, so it's two extra plain Views per pooled particle
  // (Pixel, 2026-08-13 — the earlier "one extra" undercounted the wrapper
  // itself), +24 across the 12-slot pool. Still bounded and pool-scoped:
  // the fade curve, cadence and cap above are all untouched.
  trailWrap: {
    position: 'absolute',
    width: 9,
    height: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailHalo: {
    position: 'absolute',
    width: 9,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    opacity: 0.4,
  },
  trailCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accentBurst,
  },
  parkedAnchor: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 5,
  },
});
