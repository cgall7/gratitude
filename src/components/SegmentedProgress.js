import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

// Onboarding's top-of-screen progress rhythm (Sunbeam §4) — also reused by
// Gratitude Wrapped's story sequence, deliberately rhyming the two.
export const SegmentedProgress = ({ total, current }) => (
  <View style={styles.row}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.segment,
          i < current && styles.segmentDone,
          i === current && styles.segmentCurrent,
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.ink + '1F',
  },
  segmentDone: {
    backgroundColor: theme.colors.ink,
  },
  segmentCurrent: {
    backgroundColor: theme.colors.accent,
  },
});
