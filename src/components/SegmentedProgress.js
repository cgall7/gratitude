import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { theme } from '../constants/theme';

// Onboarding's top-of-screen progress rhythm (Sunbeam §4) — also reused by
// Gratitude Wrapped's story sequence, deliberately rhyming the two.
// Was a row of thin equal-width dashes: fine at 6 steps, unreadable at
// Flow B's 10 (Colin, 2026-08-09 — "journey map at the top is not very
// good"). One rounded track with an animated fill reads as an actual
// journey — and scales to any step count without getting cluttered.
export const SegmentedProgress = ({ total, current }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Math.min(1, (current + 1) / Math.max(total, 1));
    Animated.spring(progress, {
      toValue: target,
      friction: 10,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.ink + '14',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accentDeep,
  },
});
