import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { StripedBee } from './StripedBee';
import { theme } from '../constants/theme';
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

// §17.3 flight ruling: a bee mid-transition crosses arbitrary content, so
// it renders `StripedBee` with `bandColor={accent}` (painted, field-
// independent) hardcoded internally rather than as a forwarded prop — no
// call site has ever needed to vary it, and hardcoding keeps the engine
// signature frozen per R16. `flutter` is on for the live flight only; the
// reduced-motion fade stays a static pose, same as FlyingBee's parked path.
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

  if (reduced) {
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
    return (
      <Animated.View pointerEvents="none" style={[styles.wrap, anchorStyle, { opacity }]}>
        <StripedBee size={size} bandColor={theme.colors.accent} />
      </Animated.View>
    );
  }

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: path.translateX });
  const translateY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: path.translateY });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: path.rotate });
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, anchorStyle, { opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
    >
      <StripedBee size={size} bandColor={theme.colors.accent} flutter />
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
