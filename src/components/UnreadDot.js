import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { DURATIONS, SPRINGS, useReducedMotion } from '../constants/motion';

// A note landing should feel like it arrived, not like a badge count that
// silently ticked up — so this springs in (SPRINGS.land, the same landing
// curve MainTabs' TabIcon uses) rather than fading. Renders nothing at
// scale 0 rather than unmounting, so the spring always starts from a real
// zero instead of racing a mount.
export const UnreadDot = ({ visible, style }) => {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      Animated.timing(scale, {
        toValue: visible ? 1 : 0,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(scale, { toValue: visible ? 1 : 0, ...SPRINGS.land, useNativeDriver: true }).start();
  }, [visible, reduced, scale]);

  return <Animated.View pointerEvents="none" style={[styles.dot, style, { transform: [{ scale }] }]} />;
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.accentDeep,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
});
