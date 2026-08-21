import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// C6 — the tertiary text-link action. It shipped as at least three
// treatments (padding 8 / 12 / 18, one of them underlined) scattered across
// CreateHive, Onboarding and HoneycombTab. One hit target (44pt via
// hitSlop, not layout padding — a link should look like a link, not a
// button-shaped thing with no fill), one type style, underline as an
// explicit opt-in rather than a per-screen accident.
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export const LinkButton = ({ onPress, children, underline, danger, disabled, style, accessibilityLabel }) => (
  <PressableScale
    onPress={onPress}
    disabled={disabled}
    haptic={null}
    style={[styles.link, style]}
    hitSlop={HIT_SLOP}
    accessibilityLabel={accessibilityLabel}
  >
    <Text
      style={[styles.text, underline && styles.underline, danger && styles.danger]}
    >
      {children}
    </Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  link: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  text: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  danger: {
    color: theme.colors.danger,
  },
});
