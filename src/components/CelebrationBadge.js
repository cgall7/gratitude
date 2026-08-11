import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { DURATIONS, useReducedMotion } from '../constants/motion';

// One size, always (Sunbeam §4 R1 ruling) — 96pt, marigold fill, ink
// checkmark. Scale the moment around it, never the badge itself.
export const CelebrationBadge = () => {
  const reduced = useReducedMotion();
  const reveal = useRef(new Animated.Value(0)).current;
  // The hook resolves async and subscribes to live OS toggles, so this
  // effect can legitimately run more than once — the ref keeps the
  // success haptic to a single fire either way.
  const hapticFiredRef = useRef(false);

  useEffect(() => {
    // §14.1 Rule 4: reduced motion collapses the pop spring to a flat
    // fade — the same value drives opacity instead of scale below.
    const arrive = reduced
      ? Animated.timing(reveal, { toValue: 1, duration: DURATIONS.reducedMotionFade, useNativeDriver: true })
      : Animated.spring(reveal, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true });
    Animated.sequence([Animated.delay(200), arrive]).start(() => {
      if (hapticFiredRef.current) return;
      hapticFiredRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  }, [reduced]);

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
