import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { theme } from '../constants/theme';

export const StartHiveDoorCard = ({ onPress }) => {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start a hive for someone"
      style={styles.card}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="add" size={28} color={theme.colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Start a hive for someone</Text>
        <Text style={styles.description}>Build a year of gratitude together</Text>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accentDeep + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...theme.type.bodyLg,
    color: theme.colors.accent,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
});
