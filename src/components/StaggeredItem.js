import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { DURATIONS, STAGGER_MS, useReducedMotion } from '../constants/motion';

// Fades + slides an item in with a per-index delay so lists arrive one at a
// time instead of all snapping in at once.
//
// Cascade timing comes from the shared motion module (§14.1 "40-60ms
// cascade") rather than a local literal, and reduced motion collapses the
// whole thing to a flat fade with no travel and no stagger (§12.5 Rule 4).
export const StaggeredItem = ({ index, children, style }) => {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 380,
      delay: reduced ? 0 : index * STAGGER_MS,
      useNativeDriver: true,
    }).start();
  }, [reduced]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [reduced ? 0 : 14, 0],
  });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};
