import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

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
  scaleTo = 0.96,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  disabled,
  // A caller showing its own in-place state (e.g. PrimaryButton's spinner)
  // needs `disabled` to still block the press without the default 0.4 fade
  // fighting the thing it's rendering instead of the label.
  disabledOpacity = 0.4,
  // C9 — press was scale-only everywhere; nothing answered a touch with
  // colour. A translucent overlay (theme's `pressedOnDark`/`pressedOnLight`,
  // never a raw literal) fades in over press-in and out over press-out,
  // layered on top of `children` rather than replacing `style`'s own
  // `backgroundColor` — the base fill has to stay visible underneath a
  // partial-alpha tint. Undefined by default: zero visual change for every
  // existing consumer until it opts in.
  pressedColor,
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
  hitSlop,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const colorOpacity = useRef(new Animated.Value(0)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const animateColorTo = (value) => {
    Animated.timing(colorOpacity, {
      toValue: value,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    animateTo(scaleTo);
    if (pressedColor) animateColorTo(1);
  };
  const handlePressOut = () => {
    animateTo(1);
    if (pressedColor) animateColorTo(0);
  };

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
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { opacity: disabled ? disabledOpacity : 1, transform: [{ scale }] }]}>
        {children}
        {pressedColor ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: pressedColor, opacity: colorOpacity, borderRadius: StyleSheet.flatten(style)?.borderRadius },
            ]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
};
