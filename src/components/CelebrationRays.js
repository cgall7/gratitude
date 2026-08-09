import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { theme } from '../constants/theme';

const RAY_COUNT = 18;
const PARTICLE_COUNT = 7;
const RADIUS = 70;
const PARTICLE_DISTANCE = 60;

// First-ever-save treatment only (Sunbeam §4, upgraded §11.3): staggered
// accentBurst rays + scattering particle dots behind the CelebrationBadge,
// full-bleed washPeach staging. The badge itself never changes size — this
// is what scales the moment instead. Anchors at the center of a 96pt box —
// pair with a `width: 96, height: 96` wrapper around CelebrationBadge (its
// one fixed size, per spec).
export const CelebrationRays = () => (
  <View style={styles.anchor} pointerEvents="none">
    {Array.from({ length: RAY_COUNT }).map((_, i) => (
      <Ray key={i} index={i} angle={(360 / RAY_COUNT) * i} />
    ))}
    {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
      <Particle key={i} index={i} angle={(360 / PARTICLE_COUNT) * i + 12} />
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

// Scatter particles: fade+shrink out from the badge over ~500ms, staggered
// alongside the rays so the burst reads as one energetic moment, not spokes.
const Particle = ({ index, angle }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300 + index * 60),
      Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -PARTICLE_DISTANCE] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.3] });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          opacity,
          transform: [{ rotate: `${angle}deg` }, { translateY }, { scale }],
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
    backgroundColor: theme.colors.accentBurst,
  },
  particle: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accentBurst,
  },
});
