import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { theme } from '../constants/theme';
import { DURATIONS, useReducedMotion } from '../constants/motion';

const RAY_COUNT = 18;
const PARTICLE_COUNT = 7;
const RADIUS = 70;
const PARTICLE_DISTANCE = 60;

// First-ever-save treatment only (Sunbeam §4, upgraded §11.3): staggered
// accentBurst rays + scattering particle dots behind the CelebrationBadge,
// full-bleed washYellow staging (R50 — activation is no longer wash-
// differentiated; light and motion carry the moment). The badge itself
// never changes size — this is what scales the moment instead. Self-
// centering (R18): the stage fills
// whatever box it is rendered into and the burst anchors at that box's
// center, so no wrapper-size contract exists to violate.
export const CelebrationRays = () => {
  const reduced = useReducedMotion();

  // §14.1 Rule 4 / §14.2 "burst → single soft glow": under Reduce Motion
  // the 18 spring rays + 7 scattering particles collapse to one soft glow
  // that fades in and out — same substitute StreakHexTrail's final hex
  // uses, so every burst call site degrades identically.
  return (
    <View style={styles.stage} pointerEvents="none">
      <View style={styles.anchor}>
        {reduced ? (
          <SoftGlow />
        ) : (
          <>
            {Array.from({ length: RAY_COUNT }).map((_, i) => (
              <Ray key={i} index={i} angle={(360 / RAY_COUNT) * i} />
            ))}
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
              <Particle key={i} index={i} angle={(360 / PARTICLE_COUNT) * i + 12} />
            ))}
          </>
        )}
      </View>
    </View>
  );
};

const SoftGlow = () => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: DURATIONS.reducedMotionFade, useNativeDriver: true }).start();
  }, []);

  const opacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] });

  return <Animated.View style={[styles.softGlow, { opacity }]} />;
};

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
  // Fill the parent and center the zero-size anchor inside it — the fixed
  // (48, 48) offset this replaces was only correct inside a 96pt box, a
  // contract SealCrack violated within a day of it existing (R17 §1).
  stage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: {
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
  // Sized to haze just past the 96pt badge it stages, centered on the
  // same zero-size anchor the rays use.
  softGlow: {
    position: 'absolute',
    left: -60,
    top: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.accentBurst,
  },
});
