import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Fades + slides an item in with a per-index delay so lists arrive one at a
// time instead of all snapping in at once.
export const StaggeredItem = ({ index, children, style }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: index * 70,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};
