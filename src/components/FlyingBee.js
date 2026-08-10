import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Bee } from './Bee';
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
// Path/posture is a first engine pass (loose 5-point loop, eased timing
// driver) — Deezine owns cruise posture/wing-flutter/glow-particle design
// per §12.5 ownership split; swap the waypoint set or easing here without
// touching the trail/pooling engine.
const LOOP_MS = 7000;
const TRAIL_INTERVAL_MS = 160;
const DEFAULT_SIZE = 20;

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
const PATH_INPUT_RANGE = PATH.map((_, i) => i / (PATH.length - 1));

// Rough heading per segment so the bee banks into its turn instead of
// sliding sideways — deliberately coarse, refined later against real
// on-device geometry.
const headingBetween = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};
const HEADINGS = PATH.slice(0, -1).map((p, i) => headingBetween(p, PATH[i + 1]));
const ROTATE_OUTPUT = [...HEADINGS, HEADINGS[0]];

export const FlyingBee = ({ active = true, size = DEFAULT_SIZE, style }) => {
  const reduced = useReducedMotion();
  const [layout, setLayout] = useState(null);
  const t = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const posRef = useRef({ x: 0, y: 0 });
  const loopRef = useRef(null);
  const trailTimerRef = useRef(null);
  const nextTrailIndexRef = useRef(0);

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
  // re-rendering the whole component every frame.
  useEffect(() => {
    if (!layout || reduced || !active) return undefined;
    const translateX = t.interpolate({ inputRange: PATH_INPUT_RANGE, outputRange: PATH.map((p) => p.x * layout.width) });
    const translateY = t.interpolate({ inputRange: PATH_INPUT_RANGE, outputRange: PATH.map((p) => p.y * layout.height) });
    const id = Animated.event(
      [{ value: { x: translateX, y: translateY } }],
      { useNativeDriver: false }
    );
    // Animated doesn't expose a plain "read combined interpolated value"
    // API, so we track x/y independently via two lightweight listeners.
    const xId = translateX.addListener(({ value }) => { posRef.current.x = value; });
    const yId = translateY.addListener(({ value }) => { posRef.current.y = value; });
    return () => {
      translateX.removeListener(xId);
      translateY.removeListener(yId);
    };
  }, [layout, reduced, active]);

  // Drive the cruise loop.
  useEffect(() => {
    if (!layout || reduced || !active) {
      loopRef.current?.stop();
      return undefined;
    }
    t.setValue(0);
    loopRef.current = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: LOOP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [layout, reduced, active]);

  // Drop a pooled glow-trail particle at the bee's current position on a
  // fixed cadence, fading it out over DURATIONS.trailFade. Paused whenever
  // the cruise itself is paused (reduced motion, inactive, or no layout).
  useEffect(() => {
    if (!layout || reduced || !active) return undefined;
    trailTimerRef.current = setInterval(() => {
      const slot = trailPool[nextTrailIndexRef.current];
      nextTrailIndexRef.current = (nextTrailIndexRef.current + 1) % trailPool.length;
      slot.pos.x = posRef.current.x;
      slot.pos.y = posRef.current.y;
      slot.opacity.setValue(0.8);
      slot.scale.setValue(1);
      forceTrailRender((n) => n + 1);
      Animated.parallel([
        Animated.timing(slot.opacity, { toValue: 0, duration: DURATIONS.trailFade, useNativeDriver: true }),
        Animated.timing(slot.scale, { toValue: 0.3, duration: DURATIONS.trailFade, useNativeDriver: true }),
      ]).start();
    }, TRAIL_INTERVAL_MS);
    return () => clearInterval(trailTimerRef.current);
  }, [layout, reduced, active]);

  // Reduced motion (§12.5 Rule 4) / parked (inactive): no flight, no
  // particles — a small static bee that breathes via opacity only.
  useEffect(() => {
    if (active && !reduced) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: DURATIONS.reducedMotionFade * 4, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: DURATIONS.reducedMotionFade * 4, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduced]);

  if (!active || reduced) {
    const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
    return (
      <View style={[styles.parkedAnchor, style]} pointerEvents="none">
        <Animated.View style={{ opacity }}>
          <Bee size={size} />
        </Animated.View>
      </View>
    );
  }

  const translateX = layout ? t.interpolate({ inputRange: PATH_INPUT_RANGE, outputRange: PATH.map((p) => p.x * layout.width) }) : 0;
  const translateY = layout ? t.interpolate({ inputRange: PATH_INPUT_RANGE, outputRange: PATH.map((p) => p.y * layout.height) }) : 0;
  const rotate = layout
    ? t.interpolate({ inputRange: PATH_INPUT_RANGE, outputRange: ROTATE_OUTPUT.map((deg) => `${deg}deg`) })
    : '0deg';

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
          style={[styles.bee, { transform: [{ translateX }, { translateY }, { rotate }] }]}
        >
          <Bee size={size} />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
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
