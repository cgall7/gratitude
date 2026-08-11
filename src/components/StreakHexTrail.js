import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS, useReducedMotion } from '../constants/motion';

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

const hexPoints = (size) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return `${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`;
  }).join(' ');

const Hex = ({ delay, isLast, reduced, onIgnite }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const points = useMemo(() => hexPoints(HEX_SIZE), []);

  useEffect(() => {
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
      return;
    }

    const t = setTimeout(() => {
      Haptics.selectionAsync();
      Animated.spring(progress, { toValue: 1, ...SPRINGS.tick, useNativeDriver: true }).start();
      if (isLast) {
        Animated.timing(glow, { toValue: 1, duration: DURATIONS.arrival, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onIgnite?.();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [delay, isLast, reduced]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] });

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
  const reduced = useReducedMotion();
  const hexes = useMemo(() => Array.from({ length: Math.min(Math.max(count, 0), MAX_HEXES) }), [count]);

  useEffect(() => {
    if (hexes.length === 0) onSettle?.();
  }, [hexes.length]);

  return (
    <View style={styles.row}>
      {hexes.map((_, i) => (
        <Hex
          key={i}
          delay={i * IGNITE_STAGGER_MS}
          isLast={i === hexes.length - 1}
          reduced={reduced}
          onIgnite={onSettle}
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
