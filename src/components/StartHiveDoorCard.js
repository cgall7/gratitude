import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// Always-visible entry point into 8b.2's create flow — the sole content of
// the hives shelf at zero hives, and the trailing card once at least one
// exists (Today shelf, Design Language §9).
export const StartHiveDoorCard = ({ onPress }) => (
  <PressableScale
    onPress={onPress}
    style={styles.card}
    accessibilityLabel="Start a Private Hive for someone"
  >
    <View style={styles.iconRing}>
      <Ionicons name="add" size={28} color={theme.colors.ink} />
    </View>
    <Text style={styles.label}>Start a hive{'\n'}for someone</Text>
  </PressableScale>
);

const CARD_WIDTH = 150;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorderStrong,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.washYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  label: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
