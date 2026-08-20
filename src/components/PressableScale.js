import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPRINGS, PRESS } from '../constants/motion';

// Shared tap feedback for every primary interaction: a light haptic tick
// plus a spring scale-down, so choices and buttons feel physical instead
// of flat. One component so the feel is consistent everywhere it's used.
export const PressableScale = ({
  onPress,
  style,
  // Pixel (2026-08-11, R43 gate): `style` only ever reached the inner
  // `Animated.View` — the transform/opacity layer — while the outer
  // `Pressable` is the actual flex child of whatever container this sits
  // in. A caller asking for cross-axis sizing (`alignSelf: 'stretch'`,
  // `width`) on `style` was landing it one node too deep to matter.
  // Undefined by default: zero change for every existing consumer.
  containerStyle,
  children,
  scaleTo = PRESS.standard,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  disabled,
  // §17.7 scope note (R36): RN's Pressable is `accessible: true` by
  // default, so every one of these is already a VoiceOver stop — it just
  // announces nothing useful. `accessibilityLabel` is a pure passthrough so
  // a caller can name the stop it creates. `accessibilityRole` is NOT
  // additive: defaulting it to 'button' changes what all 9 consumer files
  // announce, from bare content to "<content>, button". That is the
  // intended change — every consumer is a press target and should say so —
  // but it is a behaviour change at every call site, not an opt-in.
  accessibilityLabel,
  accessibilityRole = 'button',
  // Pure passthrough like the label: undefined by default, so no existing
  // consumer's announcement changes. The §18 hive knob is the first caller
  // that needs a stateful stop ("selected") rather than a plain button.
  accessibilityState,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      ...SPRINGS.press,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => animateTo(scaleTo);
  const handlePressOut = () => animateTo(1);

  const handlePress = () => {
    if (haptic) Haptics.impactAsync(haptic);
    onPress?.();
  };

  return (
    <Pressable
      style={containerStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, { opacity: disabled ? 0.4 : 1, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
