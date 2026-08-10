import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, AccessibilityInfo } from 'react-native';
import Svg, { Ellipse, Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { theme } from '../constants/theme';

// Hero-scale sibling of Bee.js (GUIDES/HONEYCOMB_BEE_GLYPH.md) — same
// geometric language (ellipse wings, ink body, curved antennae) scaled up
// and given honey-stripe bands + a soft glow so it can carry the Welcome
// step on its own. Bee.js itself stays untouched; the Honeycomb transition
// glyph and this mascot are deliberately separate assets with separate jobs
// (traversal vs. a still hero moment).
export const WelcomeBee = ({ size = 148 }) => {
  const bob = useRef(new Animated.Value(0)).current;
  const wing = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduced).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduced) return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const wingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wing, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: 620, useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    wingLoop.start();
    return () => {
      bobLoop.stop();
      wingLoop.stop();
    };
  }, [reduced]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  const wingScaleY = wing.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFillObject}>
        <Svg width={size} height={size} viewBox="0 0 148 148">
          <Defs>
            <RadialGradient id="beeGlow" cx="50%" cy="52%" r="55%">
              <Stop offset="0%" stopColor={theme.colors.accentDeep} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={theme.colors.accentDeep} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={74} cy={78} r={74} fill="url(#beeGlow)" />
        </Svg>
      </View>
      <Animated.View style={{ width: size * 0.68, height: size * 0.68, transform: [{ translateY }, { rotate }] }}>
        <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none">
          <Ellipse cx={11} cy={13.4} rx={5.8} ry={4.2} fill={theme.colors.ink} />
          <Path d="M6.1 12 A5.8 4.2 0 0 0 6.6 15.6 L15.4 15.6 A5.8 4.2 0 0 0 15.9 12 Z" fill={theme.colors.accent} fillOpacity={0.9} />
          <Circle cx={17.4} cy={12.2} r={2.5} fill={theme.colors.ink} />
          <Circle cx={18.1} cy={11.5} r={0.55} fill={theme.colors.background} />
          <Path d="M18 10.1 C18.4 8.9 19.3 8.1 20.3 7.8" stroke={theme.colors.ink} strokeWidth={1.1} strokeLinecap="round" />
          <Path d="M18.8 10.8 C19.6 9.9 20.7 9.6 21.6 9.8" stroke={theme.colors.ink} strokeWidth={1.1} strokeLinecap="round" />
        </Svg>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { transform: [{ scaleY: wingScaleY }] },
          ]}
        >
          <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none">
            <Ellipse cx={8.5} cy={8.6} rx={3.4} ry={2.1} fill={theme.colors.ink} fillOpacity={0.22} transform="rotate(-24 8.5 8.6)" />
            <Ellipse cx={13.2} cy={8.4} rx={3.4} ry={2.1} fill={theme.colors.ink} fillOpacity={0.22} transform="rotate(22 13.2 8.4)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
};
