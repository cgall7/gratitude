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
//
// R43 FAIL 3 (Pixel + Deezine, 2026-08-11, device-confirmed): index 0's
// `staggerDelay` is always 0, and both `SpringAnimation.js:234` and
// `TimingAnimation.js` special-case a falsy delay to call `start()`
// synchronously inside this effect instead of deferring via `setTimeout`.
// Recap's day-1 numeral took that path and rendered frozen at its start
// frame — the driven value reached 1 while the view never moved. Flooring
// index 0 to one frame (invisible on its own) heals it, confirmed on
// device for both cold start and swipe replay. `staggerDelay` itself is
// untouched: shared token math, every other index byte-identical.
//
// The underlying native mechanism is OPEN. An earlier version of this
// comment asserted that a synchronous start races the JS→native handoff
// so the value→view connection "never takes" — the device falsified that
// (R46), and this comment would rather record what was observed than a
// chain nobody has closed. Every configuration gated with a live Reduce
// Motion receipt:
//
//   timing, sync start, no stop (RecapTab's StatsCard, always)   renders
//   timing, sync restart after a stop, every index (RM flip)     renders
//   spring stopped mid-flight -> timing sync restart (RM, cold)  renders
//   spring, sync start on a value just stopped and rewound       FROZE
//
// So the only configuration ever observed to freeze is a native *spring*
// started synchronously on a value that was just stopped and rewound —
// the replay path, not synchronous starts in general. This is why the
// reduced-motion branch below deliberately keeps `delay: 0`: its restart
// always lands in the timing branch, which cannot reach the failing
// configuration, and it is device-verified clean across Today and Recap.
export const StaggeredItem = ({ index, count = 1, children, style, pop = false, replayKey }) => {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const lastReplay = useRef(replayKey);

  useEffect(() => {
    // Rewind ONLY on a real replay. This effect also re-runs when the OS
    // Reduce Motion preference flips, and rewinding there would snap every
    // settled item on screen back to zero and re-play its entrance — the
    // whole of Today blinking out because someone reached for the
    // accessibility switch. Left unrewound, that re-fire animates 1 → 1 and
    // is invisible, which is what it did before `replayKey` existed.
    if (lastReplay.current !== replayKey) {
      lastReplay.current = replayKey;
      anim.setValue(0);
    }
    // Stop a live entrance when this item goes away. NOT a double-driver
    // guard, which is what an earlier version of this comment claimed: an
    // `AnimatedValue` holds exactly one `_animation`, and both entry points
    // stop the incumbent before proceeding — `setValue` at
    // `AnimatedValue.js:197-201`, `animate` at `:316-319`. So the rewind
    // above and the `.start()` below cannot leave two drivers racing on one
    // value; RN has already made that unreachable.
    //
    // What it does buy is unmount: this effect can be torn down mid-entrance
    // (a month swipe inside the 700ms cascade, an OS Reduce Motion toggle),
    // and without this a native animation keeps running against a value
    // nobody reads. A settled item stops as a no-op.
    const stop = () => anim.stopAnimation();
    if (pop && !reduced) {
      Animated.spring(anim, {
        toValue: 1,
        delay: staggerDelay(index, count) || 16,
        ...SPRINGS.tick,
        useNativeDriver: true,
      }).start();
      return stop;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 380,
      delay: reduced ? 0 : staggerDelay(index, count) || 16,
      useNativeDriver: true,
    }).start();
    return stop;
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
