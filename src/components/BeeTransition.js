import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { Bee } from './Bee';

// Per PLANS/HONEYCOMB_DESIGN.md §3 / §4: the bee arcs in and lifts off
// between claim screens, doing narrative work (stitching the argument
// together) rather than decorating. Scarcity rules: never idles, never
// loops, 2s cooldown between flights, reduced-motion collapses to a fade.
const COOLDOWN_MS = 2000;

export const BeeTransition = ({ triggerKey }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  const [flying, setFlying] = useState(false);
  const lastTriggerRef = useRef(triggerKey);
  const lastFireRef = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduced).catch(() => {});
  }, []);

  useEffect(() => {
    if (triggerKey === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerKey;

    const now = Date.now();
    if (now - lastFireRef.current < COOLDOWN_MS) return;
    lastFireRef.current = now;

    setFlying(true);
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start(() => setFlying(false));
  }, [triggerKey]);

  if (!flying) return null;

  if (reduced) {
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
    return (
      <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
        <Bee size={20} />
      </Animated.View>
    );
  }

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-60, 280] });
  const translateY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, -30, -70] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '-18deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
    >
      <Bee size={20} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '38%',
    left: '30%',
    zIndex: 10,
  },
});
