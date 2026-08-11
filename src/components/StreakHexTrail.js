import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS, useReducedMotionState } from '../constants/motion';

// §14.2 Beat 2 — The Streak. Longest streak as a trail of hexes that
// ignites one-by-one up to the final count; the last hex pops with a
// burst. Motion module's SPRINGS.tick is the shared spring for this
// exact moment (and for Tapestry's cell-fill). The 40ms-apart cadence is
// a spec-pinned literal, distinct from the general 40-60ms cascade
// (STAGGER_MS) and from Tapestry's own 15-20ms — same pattern §14.4
// already uses for Tapestry's stagger.
const IGNITE_STAGGER_MS = 40;
const HEX_SIZE = 14;
// Pacing budget, not a display limit on the real number: at the 40ms
// cadence, 30 hexes ≈ 1.2s, which keeps the beat from running long (and
// firing 300+ haptic ticks) on a real year-long streak. The trail is a
// motif, not a literal tally — the wiring's copy/numeral carries the true
// count alongside it.
const MAX_HEXES = 30;
// R16 item 1 (Pixel): the visual cap doesn't bound the haptic rate — 30
// ticks at the 40ms cadence is 25Hz, which reads as one continuous buzz
// instead of discrete ticks. Cap ignite haptics at 12 regardless of hex
// count; the final hex's success haptic is unaffected by this stride.
const HAPTIC_CAP = 12;

const hexPoints = (size) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return `${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`;
  }).join(' ');

const Hex = ({ delay, isLast, reduced, resolved, haptic, onIgnite }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const points = useMemo(() => hexPoints(HEX_SIZE), []);

  useEffect(() => {
    // R19 (Pixel): hold on `resolved`, from the opt-in useReducedMotionState,
    // not on a nullable `reduced` — that would have reseeded the shared
    // useReducedMotion's initial state and broken its same-value bail-out
    // for every consumer, not just this one. A delay:0 first hex would
    // otherwise fire a real haptic + spring before the promise settles,
    // which is exactly the opt-out a Reduce Motion user asked for.
    if (!resolved) return undefined;

    if (reduced) {
      // §12.5 Rule 4 / §14.1: reduced motion collapses to a flat fade, no
      // stagger and no per-cell haptic — every hex fades in together
      // ("tapestry fades in whole" extended to this trail), and the last
      // hex's burst becomes a single soft glow instead of a spring pop.
      Animated.timing(progress, { toValue: 1, duration: DURATIONS.reducedMotionFade, useNativeDriver: true }).start();
      if (isLast) {
        Animated.timing(glow, { toValue: 1, duration: DURATIONS.reducedMotionFade, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onIgnite?.();
      }
      // R18: a live OS toggle mid-beat can still re-run this effect after
      // the full-motion branch below already started a spring — stop it
      // rather than letting two drivers fight the same Animated.Value.
      return () => {
        progress.stopAnimation();
        glow.stopAnimation();
      };
    }

    const t = setTimeout(() => {
      if (haptic) Haptics.selectionAsync();
      Animated.spring(progress, { toValue: 1, ...SPRINGS.tick, useNativeDriver: true }).start();
      if (isLast) {
        Animated.timing(glow, { toValue: 1, duration: DURATIONS.arrival, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onIgnite?.();
      }
    }, delay);
    return () => {
      clearTimeout(t);
      progress.stopAnimation();
      glow.stopAnimation();
    };
  }, [delay, isLast, reduced, resolved, haptic]);

  // Reduced motion pins scale flat (opacity-only fade) — same Rule 4
  // reading HoneyDropProgress already uses, so a hex/glow never zooms
  // even though the underlying Animated.Value still ramps 0->1.
  const scale = reduced ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] });
  const glowScale = reduced ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] });

  return (
    <View style={styles.hexWrap}>
      {isLast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
      )}
      <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>
        <Svg width={HEX_SIZE * 2} height={HEX_SIZE * 2}>
          <Polygon points={points} fill={theme.colors.accentDeep} />
        </Svg>
      </Animated.View>
    </View>
  );
};

// `count` — the longest-streak day count (utils/dateRanges#longestStreak).
// `onSettle` — fires once the final hex has ignited (or immediately, for a
// zero-day streak, since an empty trail otherwise never fires it and the
// ceremony would stall on Beat 2 for a brand-new user).
export const StreakHexTrail = ({ count, onSettle }) => {
  const { reduced, resolved } = useReducedMotionState();
  const hexes = useMemo(() => Array.from({ length: Math.min(Math.max(count, 0), MAX_HEXES) }), [count]);
  // Fire on every ceil(N/12)-th hex so the tick rate never exceeds the cap
  // regardless of trail length; the final hex's success haptic (below) is
  // unconditional and separate from this stride.
  const hapticStride = Math.max(1, Math.ceil(hexes.length / HAPTIC_CAP));
  // R17 (Pixel): onSettle could double-fire — the zero-length effect fires
  // it, then `count` arrives async and the real last hex fires it again;
  // or a live useReducedMotion toggle mid-beat re-runs every Hex effect.
  // Same settledRef pattern as ThemeCardFlip/FlyingBee's loginArc.
  const settledRef = useRef(false);
  const settle = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettle?.();
  };

  useEffect(() => {
    if (hexes.length === 0) settle();
  }, [hexes.length]);

  return (
    <View style={styles.row}>
      {hexes.map((_, i) => (
        <Hex
          key={i}
          delay={i * IGNITE_STAGGER_MS}
          isLast={i === hexes.length - 1}
          reduced={reduced}
          resolved={resolved}
          haptic={i % hapticStride === 0}
          onIgnite={settle}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  hexWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: HEX_SIZE * 2,
    height: HEX_SIZE * 2,
    borderRadius: HEX_SIZE,
    backgroundColor: theme.colors.accentBurst,
  },
});
