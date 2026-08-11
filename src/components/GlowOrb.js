import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { theme } from '../constants/theme';
import { useReducedMotion } from '../constants/motion';
import { useSvgId } from '../utils/svgId';

// The ambient light behind the lock/reflection moments.
//
// This replaces the flat `backgroundColor` circles those screens used to
// draw: a solid disc at 10-25% opacity has a hard edge no matter how low
// you take the opacity, so it read as a pale yellow *shape* sitting on the
// cream rather than light falling across it. A radial gradient that runs
// the accent out to fully transparent has no edge to see.
//
// Breathing is opt-in (`breathe`) and reduced-motion aware — under Reduce
// Motion the orb holds at its midpoint instead of pulsing, so the light
// still reads without any movement.
export const GlowOrb = ({
  size,
  color = theme.colors.accent,
  intensity = 0.5,
  breathe = false,
  style,
}) => {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;
  const gradientId = useSvgId('glowOrb');

  useEffect(() => {
    if (!breathe || reduced) {
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduced, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [intensity * 0.75, intensity] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.orb, { width: size, height: size, opacity, transform: [{ scale }] }, style]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="55%" stopColor={color} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
});
