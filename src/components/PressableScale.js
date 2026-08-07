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
    >
      <Animated.View style={[style, { opacity: disabled ? 0.4 : 1, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
