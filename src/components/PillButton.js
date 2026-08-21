import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// A small inline action pill — accept/decline a request, add a connection.
// Two variants only, both borrowed from the app's one law-abiding CTA
// instead of inventing a third fill:
//   - `filled`  — the same `ink` material as `PrimaryButton`, just shorter.
//     This is what "Accept" gets now (C4): §4's "yellow never fills it"
//     ruled out the `accent` fill it shipped with.
//   - `outline` — `surface` + a real border, replacing a border-alpha token
//     used as a background (C3), which is why "Not now" read muddy.
// `minHeight` is explicit (C5): the previous `addButton` had no height of
// its own and just inherited whatever its neighbour in the row happened to
// be.
export const PillButton = ({ onPress, children, variant = 'filled', disabled, style, accessibilityLabel }) => (
  <PressableScale
    onPress={onPress}
    disabled={disabled}
    style={[styles.pill, variant === 'outline' ? styles.outline : styles.filled, style]}
    scaleTo={0.96}
    accessibilityLabel={accessibilityLabel}
  >
    <Text style={[styles.text, variant === 'outline' ? styles.outlineText : styles.filledText]}>{children}</Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: theme.colors.ink,
  },
  outline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorderStrong,
  },
  text: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
  },
  filledText: {
    color: theme.colors.backgroundWriting,
  },
  outlineText: {
    color: theme.colors.ink,
  },
});
