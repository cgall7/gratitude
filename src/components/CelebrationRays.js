import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { theme } from '../constants/theme';

const RAY_COUNT = 10;
const RADIUS = 70;

// First-ever-save treatment only (Sunbeam §4): staggered marigold rays
// behind the CelebrationBadge, full-bleed washPeach staging. The badge
// itself never changes size — this is what scales the moment instead.
// Anchors at the center of a 96pt box — pair with a `width: 96, height: 96`
// wrapper around CelebrationBadge (its one fixed size, per spec).
export const CelebrationRays = () => (
  <View style={styles.anchor} pointerEvents="none">
    {Array.from({ length: RAY_COUNT }).map((_, i) => (
      <Ray key={i} index={i} angle={(360 / RAY_COUNT) * i} />
    ))}
  </View>
);

const Ray = ({ index, angle }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300 + index * 60),
      Animated.spring(progress, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.ray,
        {
          opacity: progress,
          transform: [{ rotate: `${angle}deg` }, { translateY: -RADIUS }, { scaleY: progress }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 48,
    left: 48,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    left: -2,
    top: -18,
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
});
