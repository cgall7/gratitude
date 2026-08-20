import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { DURATIONS, SPRINGS, useReducedMotionState } from '../constants/motion';

// One size, always (Sunbeam §4 R1 ruling) — 96pt, marigold fill, ink
// checkmark. Scale the moment around it, never the badge itself.
export const CelebrationBadge = () => {
  const { reduced, resolved } = useReducedMotionState();
  const reveal = useRef(new Animated.Value(0)).current;
  // The hook subscribes to live OS toggles, so this effect can
  // legitimately run more than once — the ref keeps the success haptic
  // to a single fire either way.
  const hapticFiredRef = useRef(false);

  useEffect(() => {
    // R19: hold the first frame until the OS preference is actually
    // known — starting the spring on the assumed-`false` value is the
    // race R18 found. `resolved` flips exactly once per mount.
    if (!resolved) return;
    // §14.1 Rule 4: reduced motion collapses the pop spring to a flat
    // fade — the same value drives opacity instead of scale below.
    const arrive = reduced
      ? Animated.timing(reveal, { toValue: 1, duration: DURATIONS.reducedMotionFade, useNativeDriver: true })
      : Animated.spring(reveal, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true });
    const sequence = Animated.sequence([Animated.delay(200), arrive]);
    sequence.start(({ finished }) => {
      // R20: a cleanup-triggered stop invokes this callback with
      // finished:false — the haptic marks the real arrival, so an
      // interrupted run must not fire it (or latch the ref and silence
      // the re-run that does arrive).
      if (!finished || hapticFiredRef.current) return;
      hapticFiredRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    // R18/R20: a live OS toggle re-runs this effect mid-animation — the
    // cleanup must stop the *composite* handle: `reveal.stopAnimation()`
    // can't reach the sequence during the 200ms Animated.delay, which
    // drives its own internal value, not `reveal`.
    return () => sequence.stop();
  }, [reduced, resolved]);

  return (
    <Animated.View style={[styles.badge, reduced ? { opacity: reveal } : { transform: [{ scale: reveal }] }]}>
      <Ionicons name="checkmark" size={44} color={theme.colors.ink} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.tinted(theme.colors.accent),
  },
});
