import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from './PressableScale';

// One Private Hives cover card for the Today shelf (Design Language §9).
// No gold-register/sealed treatment yet — this PR doesn't build sealing
// (8b.5, merge-gated on migrations …000003–000006 landing on prod), so every
// card here is necessarily "in progress" and never wears `goldField`.
// `golden-honey` is not a selectable cover (Lumen's ruling, thread
// b57ad406, 2026-08-17): §1 reserves it for the sealed-state wax seal badge
// only, so `hiveCoverTheme` can never resolve one for an unsealed card.
export const HiveCard = ({ hive, onPress }) => {
  const cover = hiveCoverTheme(hive.coverTheme);
  const memoryLabel = hive.entryCount === 1 ? '1 memory' : `${hive.entryCount} memories`;

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: cover.base }]}
      accessibilityLabel={`Open the hive for ${hive.subjectName}, ${memoryLabel}`}
    >
      <Text style={[styles.name, { color: cover.textColor }]} numberOfLines={2}>
        {hive.subjectName}
      </Text>
      <Text style={[styles.count, { color: cover.textColor }]}>{memoryLabel}</Text>
    </PressableScale>
  );
};

const CARD_WIDTH = 150;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  name: {
    ...theme.type.h3,
  },
  count: {
    ...theme.type.bodySm,
  },
});
