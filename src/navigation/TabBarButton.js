import React, { useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

// Every tab switch gets a light haptic tick and a small spring "press" —
// the default bottom-tabs button is a flat, silent touch target.
//
// Built on PlatformPressable, not a raw Pressable, because bottom-tabs hands
// every tab button an `href` (BottomTabBar builds one from navigation state
// even when NavigationContainer has no `linking` config). On web that `href`
// makes react-native-web render the button as a real <a>, so a raw Pressable
// lets the browser follow the link and do a full page navigation on every tab
// tap. PlatformPressable is the component bottom-tabs' own default button
// uses; it calls preventDefault for plain left clicks while still letting
// cmd/middle-click open a new tab. `pressOpacity: 1` arrives via `rest`, so
// its opacity fade stays off and the spring below is the only press feedback.
export const TabBarButton = ({ children, onPress, style, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, { toValue: value, friction: 6, tension: 220, useNativeDriver: true }).start();
  };

  return (
    <PlatformPressable
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
    </PlatformPressable>
  );
};

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
