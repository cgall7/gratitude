import React from 'react';
import { StyleSheet, View, Text, Image, AccessibilityInfo } from 'react-native';
import { PressableScale } from './PressableScale';
import { theme } from '../constants/theme';

export const HiveCard = ({ name, avatarUrl, isPackaged, onPress }) => {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Hive with ${name}`}
      style={[
        styles.card,
        isPackaged && { backgroundColor: theme.colors.goldField }
      ]}
    >
      {avatarUrl && (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          accessibilityLabel={`${name}'s avatar`}
        />
      )}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={[styles.status, isPackaged && styles.statusPackaged]}>
          {isPackaged ? 'Sealed' : 'Building'}
        </Text>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.washYellow,
  },
  content: {
    flex: 1,
  },
  name: {
    ...theme.type.bodyLg,
    color: theme.colors.ink,
    fontWeight: '600',
    marginBottom: 4,
  },
  status: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  statusPackaged: {
    color: theme.colors.accentDeep,
  },
});
