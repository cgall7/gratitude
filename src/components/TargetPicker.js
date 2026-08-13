import React from 'react';
import { StyleSheet, ScrollView, Text } from 'react-native';
import { theme } from '../constants/theme';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';

// §8b.1 — "Whether you're writing for yourself or for Mateo, you're writing
// in Today" (docs/strategy/POLLINATE_THE_RULING.md). One compose surface,
// N possible subjects: "Me" first and always present, then one chip per
// Private Hive. TodayTab only mounts this when targets.length > 1, so a
// user with zero private hives sees the pre-8b Today screen unchanged —
// this component makes no claim about whether hive entries exist yet.
export const TargetPicker = ({ targets, activeId, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}
  >
    {targets.map((target) => {
      const selected = target.id === activeId;
      return (
        <PressableScale
          key={target.id}
          onPress={() => onSelect(target.id)}
          style={[styles.chip, selected && styles.chipSelected]}
          accessibilityLabel={`Write about ${target.name}`}
        >
          <Avatar name={target.name} avatarUrl={target.avatarUrl} size={28} />
          <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
            {target.name}
          </Text>
        </PressableScale>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.washYellow,
  },
  label: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    maxWidth: 96,
  },
  labelSelected: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
});
