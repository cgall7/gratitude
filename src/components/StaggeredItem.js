import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Fades + slides an item in with a per-index delay so lists arrive one at a
// time instead of all snapping in at once. `pop` swaps the slide for a
// spring scale with a touch of overshoot — reads bouncier, meant for dense
// grids (calendar cells) rather than list rows.
export const StaggeredItem = ({ index, children, style, pop = false }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pop) {
      Animated.spring(anim, {
        toValue: 1,
        delay: index * 22,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 1,
        duration: 380,
        delay: index * 70,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  if (pop) {
    return (
      <Animated.View style={[style, { opacity: anim, transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    );
  }

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};
