import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// C2 — one back-button affordance. It shipped as four: a surface card with
// shadow (CreateHive), raw glass with no shadow (SendHive/SealHive), the
// same raw glass duplicated three more times (HiveDetail/MemoryLane/
// PackageOpen), and a bare TouchableOpacity with no scale or haptic at all
// (Account/Legal/Onboarding). Two materials are legitimate — a circle on a
// plain page reads as a card and wants `shadows.card`; the same circle on a
// colour banner is glass and a drop shadow on glass over colour looks wrong
// — but every consumer gets the same size, scale, and haptic regardless of
// which material it sits on. `variant="glass"` is for banners/full-bleed
// covers; `solid` (the default) is for everything else.
export const BackButton = ({ onPress, variant = 'solid', color, style, accessibilityLabel = 'Go back' }) => (
  <PressableScale
    onPress={onPress}
    style={[styles.button, variant === 'glass' ? styles.glass : styles.solid, style]}
    accessibilityLabel={accessibilityLabel}
  >
    <Ionicons name="chevron-back" size={22} color={color ?? theme.colors.ink} />
  </PressableScale>
);

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  glass: {
    backgroundColor: theme.colors.glassFill,
  },
});
