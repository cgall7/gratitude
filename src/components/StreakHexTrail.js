import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS } from '../constants/motion';

// §14.2 Beat 2 — The Streak. Longest streak as a trail of hexes that
// ignites one-by-one up to the final count; the last hex pops with a
// burst. Motion module's SPRINGS.tick is the shared spring for this
// exact moment (and for Tapestry's cell-fill). The 40ms-apart cadence is
// a spec-pinned literal, distinct from the general 40-60ms cascade
// (STAGGER_MS) and from Tapestry's own 15-20ms — same pattern §14.4
// already uses for Tapestry's stagger.
const IGNITE_STAGGER_MS = 40;
const HEX_SIZE = 14;

const hexPoints = (size) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return `${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`;
  }).join(' ');

const Hex = ({ delay, isLast, onIgnite }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const points = useMemo(() => hexPoints(HEX_SIZE), []);

  useEffect(() => {
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
  }, [delay, isLast]);

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
// `onSettle` — fires once the final hex has ignited.
export const StreakHexTrail = ({ count, onSettle }) => {
  const hexes = useMemo(() => Array.from({ length: Math.max(count, 0) }), [count]);

  return (
    <View style={styles.row}>
      {hexes.map((_, i) => (
        <Hex key={i} delay={i * IGNITE_STAGGER_MS} isLast={i === hexes.length - 1} onIgnite={onSettle} />
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
