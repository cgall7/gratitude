import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from './PressableScale';
import { GradientCard } from './GradientCard';

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
      style={styles.card}
      accessibilityLabel={`Open the hive for ${hive.subjectName}, ${memoryLabel}`}
    >
      {/* Same ruling as the cover picker: the cover never touches the page.
          It's an inset fill inside this `surface` mat, so separation is
          cover-vs-white regardless of which ground the shelf underneath
          happens to use — the ghost that used to follow the hive around
          the app can't reappear here either. */}
      <GradientCard
        style={styles.material}
        contentStyle={[styles.fill, { backgroundColor: cover.base }]}
        colors={theme.gradients.sheen}
      >
        <Text style={[styles.name, { color: cover.textColor }]} numberOfLines={2}>
          {hive.subjectName}
        </Text>
        <Text style={[styles.count, { color: cover.textColor }]}>{memoryLabel}</Text>
      </GradientCard>
    </PressableScale>
  );
};

const CARD_WIDTH = 150;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.surface,
    padding: 6,
    ...theme.shadows.card,
  },
  material: {
    flex: 1,
  },
  fill: {
    flex: 1,
    borderRadius: theme.borderRadius.medium - 6,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorderStrong,
    padding: 10,
    justifyContent: 'space-between',
  },
  name: {
    ...theme.type.h3,
  },
  count: {
    ...theme.type.bodySm,
  },
});
