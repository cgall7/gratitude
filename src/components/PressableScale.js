import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

// Shared tap feedback for every primary interaction: a light haptic tick
// plus a spring scale-down, so choices and buttons feel physical instead
// of flat. One component so the feel is consistent everywhere it's used.
export const PressableScale = ({
  onPress,
  style,
  children,
  scaleTo = 0.96,
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
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 6,
      tension: 200,
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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <Animated.View style={[style, { opacity: disabled ? 0.4 : 1, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
