import React from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';

// The one CTA shape in the app (Sunbeam §4): full-width ink pill, cream
// text. The button is the period at the end of the sentence — yellow never
// fills it.
// `haptic` is overridable for the rare CTA that means more than the rest —
// the lock screen's "Begin" takes Medium because it crosses a threshold.
// Everything else stays Light; if every button is heavy, none of them are.
export const PrimaryButton = ({
  onPress,
  disabled,
  children,
  style,
  // Forwarded straight to PressableScale's containerStyle — a caller
  // sizing the button within its own layout (e.g. Recap's centered column
  // needing `alignSelf: 'stretch'`) needs the outer Pressable node, not the
  // inner transform layer `style` targets.
  containerStyle,
  haptic = Haptics.ImpactFeedbackStyle.Light,
}) => (
  <PressableScale
    style={[styles.button, style]}
    containerStyle={containerStyle}
    onPress={onPress}
    disabled={disabled}
    scaleTo={0.97}
    haptic={haptic}
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
