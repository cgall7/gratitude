import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
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
  // Pure passthrough, undefined by default — zero change for every existing
  // consumer, same shape as the one PressableScale documents above its own
  // label prop. Without it the prop was accepted at the call site and silently
  // dropped here, so a caller could write an accessibility label, see no
  // error, and ship a button that announces only its visible text. §23.7's
  // retry is the first caller that needs to name what it is retrying — "Try
  // again" is the right thing to read and the wrong thing to hear.
  accessibilityLabel,
  // Sealing a hive is the emotional peak of the product — it does not get
  // to answer with a 40% fade. `loading` blocks the press exactly like
  // `disabled` but swaps the label for a spinner instead of dimming it, so
  // the button keeps saying something instead of going quiet.
  loading = false,
}) => (
  <PressableScale
    style={[styles.button, style]}
    containerStyle={containerStyle}
    onPress={onPress}
    disabled={disabled || loading}
    disabledOpacity={loading ? 1 : 0.4}
    scaleTo={0.97}
    haptic={haptic}
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ busy: loading }}
  >
    {loading ? (
      <ActivityIndicator color={theme.colors.backgroundWriting} />
    ) : (
      <Text style={styles.text}>{children}</Text>
    )}
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
    // C7 — the app's one CTA was a flat ink slab despite `shadows.floating`
    // existing for exactly this ("anything that should feel pressable/
    // afloat"). `floating`, not `card`: this is the button, not a resting
    // surface.
    ...theme.shadows.floating,
  },
  text: {
    ...theme.type.button,
    color: theme.colors.backgroundWriting, // always cream text, per §4 — not the identity honey tone
  },
});
