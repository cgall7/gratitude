import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { DURATIONS, SPRINGS, staggerDelay, useReducedMotion } from '../constants/motion';

// Fades + slides an item in with a per-index delay so lists arrive one at a
// time instead of all snapping in at once.
//
// `pop` swaps the slide for a spring scale on `SPRINGS.tick` — the curve
// documented for streak hexes igniting one by one, which is literally what
// the filled cells of the month grid are. Dense grids want a quick bloom,
// not a row's worth of travel; at 31 cells a 14pt slide reads as the whole
// grid sliding, while a scale reads as each day lighting up.
//
// Cascade timing comes from the shared motion module (§14.1 "40-60ms
// cascade") rather than a local literal, and reduced motion collapses
// either path to a flat fade with no travel, no scale and no stagger
// (§12.5 Rule 4).
//
// Pass `count` when the collection is dense (R24): the cascade then
// divides a fixed budget instead of multiplying a fixed step, so a 30-cell
// grid still settles in under a second. Omitting it keeps the old timing
// exactly.
export const StaggeredItem = ({ index, count = 1, children, style, pop = false }) => {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pop && !reduced) {
      Animated.spring(anim, {
        toValue: 1,
        delay: staggerDelay(index, count),
        ...SPRINGS.tick,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 380,
      delay: reduced ? 0 : staggerDelay(index, count),
      useNativeDriver: true,
    }).start();
  }, [reduced]);

  if (pop) {
    // Reduced motion holds scale at 1 and lets the fade carry it alone.
    const scale = reduced ? 1 : anim;
    return (
      <Animated.View style={[style, { opacity: anim, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    );
  }

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
