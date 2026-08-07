import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

// Every tab switch gets a light haptic tick and a small spring "press" —
// the default bottom-tabs button is a flat, silent touch target.
export const TabBarButton = ({ children, onPress, style, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, { toValue: value, friction: 6, tension: 220, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={() => animateTo(0.88)}
      onPressOut={() => animateTo(1)}
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
    >
      <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
