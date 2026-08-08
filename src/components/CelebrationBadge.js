import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

// One size, always (Sunbeam §4 R1 ruling) — 96pt, marigold fill, ink
// checkmark. Scale the moment around it, never the badge itself.
export const CelebrationBadge = () => {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }, []);

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
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
