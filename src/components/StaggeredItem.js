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
//
// Change `replayKey` to run the entrance again on a live item — §17.5's
// month pager re-staggers the incoming grid on every swipe, and doing that
// by remounting would tear down and rebuild 31 `<Svg>` cells per page turn.
// Undefined by default, so it never changes for any existing consumer and
// the effect fires exactly as often as it did before (R19).
export const StaggeredItem = ({ index, count = 1, children, style, pop = false, replayKey }) => {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // No-op on mount (the value is already 0); on a replay it rewinds so the
    // entrance starts from nothing instead of animating 1 → 1.
    anim.setValue(0);
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
  }, [reduced, replayKey]);

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
