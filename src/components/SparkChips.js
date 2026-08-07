import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';
import { StaggeredItem } from './StaggeredItem';

// Gentle, tappable example completions shown only while the input is
// empty — fades out the moment someone starts typing their own words, so
// it never fights for attention once it's done its job.
export const SparkChips = ({ sparks, visible, onPick }) => {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Text style={styles.label}>Need a nudge?</Text>
      <View style={styles.chipRow}>
        {sparks.map((spark, index) => (
          <StaggeredItem key={spark} index={index}>
            <PressableScale
              style={styles.chip}
              onPress={() => onPick(spark)}
              haptic={Haptics.ImpactFeedbackStyle.Light}
            >
              <Text style={styles.chipText} numberOfLines={2}>{spark}</Text>
            </PressableScale>
          </StaggeredItem>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    maxWidth: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
});
