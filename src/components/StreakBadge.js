import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { DURATIONS, SPRINGS, useReducedMotion } from '../constants/motion';
import { isStreakMilestone } from '../utils/dateRanges';

// The streak, as a hexagon — the app's own shape rather than a borrowed
// flame. Filled marigold once a run is going, hollow ink outline at zero so
// day one still has something to fill in.
//
// Milestone days (3/7/14/30/…) land with the §11.3 pop spring instead of a
// quiet fade, so the number you've been chasing visibly *arrives*. Every
// beat here is gated on reduced motion (§12.5 Rule 4).
const HEX_POINTS = (size) => {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    // Pointy-top: rotate the flat-top set by 30° so the badge reads as a
    // cell standing upright next to text.
    const angle = (Math.PI / 180) * (60 * i - 90);
    points.push(`${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`);
  }
  return points.join(' ');
};

export const StreakBadge = ({ streak, size = 30, label }) => {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const active = streak > 0;
  const milestone = active && isStreakMilestone(streak);

  useEffect(() => {
    pop.setValue(0);
    if (reduced) {
      Animated.timing(pop, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(pop, {
      toValue: 1,
      ...(milestone ? SPRINGS.pop : SPRINGS.tick),
      useNativeDriver: true,
    }).start();
  }, [streak, reduced, milestone, pop]);

  // Milestones overshoot; ordinary days just settle in.
  const scale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [milestone ? 0.4 : 0.85, 1],
  });

  return (
    <Animated.View style={[styles.row, { opacity: pop, transform: [{ scale }] }]}>
      <View style={{ width: size * 2, height: size * 2 }}>
        <Svg width={size * 2} height={size * 2}>
          <Polygon
            points={HEX_POINTS(size)}
            fill={active ? theme.colors.accent : 'transparent'}
            stroke={active ? theme.colors.accentDeep : theme.colors.surfaceBorderStrong}
            strokeWidth={active ? 1.5 : 2}
          />
        </Svg>
        <View style={styles.countOverlay} pointerEvents="none">
          <Text style={[styles.count, { fontSize: size * 0.8 }, !active && styles.countIdle]}>
            {streak}
          </Text>
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: theme.fonts.headerExtraBold,
    color: theme.colors.ink,
  },
  countIdle: {
    color: theme.colors.inkSoft,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
});
