import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { MascotBee } from './MascotBee';
import { facingFor } from './beeAttitude';
import { useReducedMotion } from '../constants/motion';

// Per PLANS/HONEYCOMB_DESIGN.md §3 / §9.4: the bee arcs in and lifts off
// between claim screens, doing narrative work (stitching the argument
// together) rather than decorating. Scarcity rules: never idles, never
// loops, 2s cooldown between flights, reduced-motion collapses to a fade.
// Uses a glide spring (friction 9 / tension 60), not §4's pop spring —
// flight is traversal, not feedback, so a bounce reads wrong here. Pixel
// ratified this as the standard for all three Honeycomb bee moments too
// (gate R7, §9.4 amendment) — `path`/`anchorStyle`/`size` let each of those
// call sites tune the trajectory to its own geometry while sharing the same
// spring + scarcity engine as the claim-screen flights.
const COOLDOWN_MS = 2000;

// Matches the original claim-screen flight exactly — the default for every
// caller that doesn't pass its own `path`.
const DEFAULT_PATH = {
  translateX: [-60, 280],
  translateY: [20, -30, -70],
  rotate: ['-4deg', '-18deg'],
};

// §19.5 / R79: the bee here is `MascotBee`, the ratified render. The §17.3
// ruling this replaces picked `StripedBee` with `bandColor={accent}` so a bee
// crossing arbitrary content never knocked an opaque band out of it; a raster
// has no colour props, so that question retires. `flutter` is on for the live
// flight only; the reduced-motion fade stays a static pose, same as
// FlyingBee's parked path.
//
// **Facing.** The mascot has a face, so which way it points is now legible,
// and `SHARE_CARRY_PATH` travels 40pt to the *left* — a bee that has always
// flown that leg tail-first, invisibly, because the drawing it replaced had
// no expression to contradict it. Facing comes from `facingFor`, the same
// one-body-width rule the cruise rig uses, applied to this flight's net
// horizontal travel. It is constant for the whole flight — one stretch of
// travel has nothing to turn between — so there is no through-zero wheel
// here, only a mirror. The path's own bank is signed by it for R81's reason:
// scaleX is applied before rotate, so a mirrored bee rotated +θ tips its nose
// up, and these numbers were authored for the unmirrored drawing.
// Default size 20 → 32 — the claim arc crosses text, and 32 reads as a
// character without going cartoon (44 is the ambient cruiser's register).
export const BeeTransition = ({ triggerKey, path = DEFAULT_PATH, anchorStyle, size = 32 }) => {
  const progress = useRef(new Animated.Value(0)).current;
  // R17 (Pixel): switched from a mount-once AccessibilityInfo read to the
  // shared subscribing hook so a mid-flight Reduce Motion toggle is
  // honored, same as every other animating component. The opacity tail
  // and shared call sites (claim screens, §13.3 login arc) are untouched.
  const reduced = useReducedMotion();
  const [flying, setFlying] = useState(false);
  const lastTriggerRef = useRef(triggerKey);
  const lastFireRef = useRef(0);

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

  const facing = facingFor(path.translateX[path.translateX.length - 1] - path.translateX[0], size, 1);

  if (reduced) {
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.wrap, anchorStyle, { opacity, transform: [{ scaleX: facing }] }]}
      >
        <MascotBee size={size} />
      </Animated.View>
    );
  }

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: path.translateX });
  const translateY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: path.translateY });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: path.rotate.map((deg) => `${parseFloat(deg) * facing}deg`),
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        anchorStyle,
        { opacity, transform: [{ translateX }, { translateY }, { rotate }, { scaleX: facing }] },
      ]}
    >
      <MascotBee size={size} flutter />
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
