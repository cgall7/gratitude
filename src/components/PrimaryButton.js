import React from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// The one CTA shape in the app (Sunbeam §4): full-width ink pill, cream
// text. The button is the period at the end of the sentence — yellow never
// fills it.
export const PrimaryButton = ({ onPress, disabled, children, style }) => (
  <PressableScale
    style={[styles.button, style]}
    onPress={onPress}
    disabled={disabled}
    scaleTo={0.97}
    haptic={Haptics.ImpactFeedbackStyle.Light}
  >
    <Text style={styles.text}>{children}</Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...theme.type.button,
    color: theme.colors.backgroundWriting, // always cream text, per §4 — not the identity honey tone
  },
});
