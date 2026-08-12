import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, ClipPath, Stop, Ellipse, Circle, Path, Rect } from 'react-native-svg';
import { theme } from '../constants/theme';
import { useReducedMotion } from '../constants/motion';
import { useSvgId } from '../utils/svgId';

// Hero-scale sibling of Bee.js (GUIDES/HONEYCOMB_BEE_GLYPH.md) — same
// held-moment job, redrawn for the round-5 art direction Colin ratified in
// #UX Design (2026-08-12): glossy gradient body, folded venated wings,
// jointed legs, a wide stinger. Bee.js and the small animated `StripedBee`
// glyph are untouched — round 5's fur/gloss detail reads at this one
// still-and-large size and would melt into mush at StripedBee's 13-64pt
// flight/trail sizes (round 5's own reference sheet shows it going soft by
// 39px), so the small glyph stays the flat 2-tone icon it already is. That
// split is deliberate, not a TODO — see the #UX Design thread this shipped
// from before changing it.
//
// Three SVG layers, not two, because the wings now tuck partly UNDER the
// head/thorax (folded back over the body, per round 5) instead of sitting
// beside it. The wing-flutter transform can only own the middle layer:
// [body+legs+stinger] under [wings] under [head+antennae+eye].
export const WelcomeBee = ({ size = 148 }) => {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const wing = useRef(new Animated.Value(0)).current;
  const bodyGradId = useSvgId('heroBeeBody');
  const headGradId = useSvgId('heroBeeHead');
  const wingGradId = useSvgId('heroBeeWing');
  const bodyClipId = useSvgId('heroBeeBodyClip');

  useEffect(() => {
    if (reduced) return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    // Wings beat in a quick double-flick then rest, rather than buzzing
    // continuously — a held pose that twitches reads alive; one that
    // vibrates non-stop reads like a loading spinner.
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
  }, [reduced, bob, wing]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  const wingScaleY = wing.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const bodySize = size * 0.68;

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      <Animated.View
        style={{ width: bodySize, height: bodySize, transform: [{ translateY }, { rotate }] }}
      >
        <Svg width={bodySize} height={bodySize} viewBox="0 0 24 24" fill="none">
          <Defs>
            <LinearGradient id={bodyGradId} x1="7" y1="9" x2="16" y2="18" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={theme.colors.accent} />
              <Stop offset="1" stopColor={theme.colors.accentDeep} />
            </LinearGradient>
            <ClipPath id={bodyClipId}>
              <Ellipse cx={11.1} cy={13.2} rx={5.9} ry={4.4} />
            </ClipPath>
          </Defs>

          {/* legs, behind the body */}
          <Path d="M9.0 16.9 L8.0 18.4 L8.5 19.9 M8.0 18.4 L6.9 18.7" stroke={theme.colors.ink} strokeWidth={0.42} strokeLinecap="round" />
          <Path d="M11.6 17.3 L11.1 19.1 L11.7 20.5 M11.1 19.1 L10.0 19.4" stroke={theme.colors.ink} strokeWidth={0.42} strokeLinecap="round" />
          <Path d="M14.1 17.1 L14.5 18.9 L15.4 20.1 M14.5 18.9 L13.5 19.4" stroke={theme.colors.ink} strokeWidth={0.42} strokeLinecap="round" />
          <Circle cx={8.5} cy={19.9} r={0.55} fill={theme.colors.accentDeep} />

          {/* body, banded, glossy */}
          <Ellipse cx={11.1} cy={13.2} rx={5.9} ry={4.4} fill={`url(#${bodyGradId})`} />
          <Rect x={6.0} y={8.4} width={1.55} height={9.6} fill={theme.colors.ink} clipPath={`url(#${bodyClipId})`} />
          <Rect x={9.1} y={8.4} width={1.55} height={9.6} fill={theme.colors.ink} clipPath={`url(#${bodyClipId})`} />
          <Rect x={12.2} y={8.4} width={1.55} height={9.6} fill={theme.colors.ink} clipPath={`url(#${bodyClipId})`} />

          {/* tail tip fused with a wide, tapered stinger */}
          <Path
            d="M1.7 13.15 C3.1 12.5 4.4 12.2 5.35 12.15 C5.1 11.55 5.4 11.05 6.0 11.0 C6.9 10.95 7.15 12.05 7.05 13.25 C7.15 14.45 6.9 15.45 6.0 15.4 C5.4 15.35 5.1 14.85 5.35 14.25 C4.4 14.2 3.1 13.85 1.7 13.15 Z"
            fill={theme.colors.ink}
          />

          <Ellipse cx={9.9} cy={10.9} rx={1.6} ry={0.85} fill={theme.colors.surface} opacity={0.3} transform="rotate(-16 9.9 10.9)" />
        </Svg>

        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ scaleY: wingScaleY }] }]}
        >
          <Svg width={bodySize} height={bodySize} viewBox="0 0 24 24" fill="none">
            <Defs>
              <LinearGradient id={wingGradId} x1="0" y1="0" x2="0.4" y2="1">
                <Stop offset="0" stopColor={theme.colors.surface} stopOpacity={0.92} />
                <Stop offset="1" stopColor={theme.colors.ink} stopOpacity={0.15} />
              </LinearGradient>
            </Defs>
            {/* far wing, peeking above the near wing */}
            <Ellipse cx={11.4} cy={7.6} rx={3.5} ry={1.25} fill={`url(#${wingGradId})`} stroke={theme.colors.ink} strokeOpacity={0.3} strokeWidth={0.1} transform="rotate(-16 11.4 7.6)" />
            {/* near wing, with vein lines */}
            <Ellipse cx={12.7} cy={8.9} rx={3.7} ry={1.5} fill={`url(#${wingGradId})`} stroke={theme.colors.ink} strokeOpacity={0.3} strokeWidth={0.12} transform="rotate(-11 12.7 8.9)" />
            <Path d="M9.5 8.7 L15.8 8.4 M9.8 9.6 L15.6 9.3" stroke={theme.colors.ink} strokeOpacity={0.3} strokeWidth={0.09} />
          </Svg>
        </Animated.View>

        <View style={StyleSheet.absoluteFill}>
          <Svg width={bodySize} height={bodySize} viewBox="0 0 24 24" fill="none">
            <Defs>
              <RadialGradient id={headGradId} cx="35%" cy="28%" r="80%">
                <Stop offset="0" stopColor={theme.colors.inkSoft} />
                <Stop offset="1" stopColor={theme.colors.ink} />
              </RadialGradient>
            </Defs>

            {/* fuzz collar where the head meets the thorax */}
            <Path d="M14.9 10.6 C15.5 10.0 16.2 9.7 16.9 9.7 M15.0 14.6 C15.6 15.1 16.3 15.3 17.0 15.2" stroke={theme.colors.ink} strokeOpacity={0.5} strokeWidth={0.3} strokeLinecap="round" />

            <Circle cx={17.5} cy={12.0} r={2.95} fill={`url(#${headGradId})`} />

            {/* elbowed antennae */}
            <Path d="M17.6 9.2 C17.7 7.8 18.3 6.6 19.0 5.9" stroke={theme.colors.ink} strokeWidth={0.32} strokeLinecap="round" />
            <Circle cx={19.0} cy={5.9} r={0.3} fill={theme.colors.ink} />
            <Path d="M18.5 9.5 C19.0 8.2 19.9 7.4 20.8 7.1" stroke={theme.colors.ink} strokeWidth={0.32} strokeLinecap="round" />
            <Circle cx={20.8} cy={7.1} r={0.3} fill={theme.colors.ink} />

            {/* the big glossy eye, gold-rimmed */}
            <Circle cx={17.9} cy={12.0} r={2.2} fill={theme.colors.ink} stroke={theme.colors.goldField} strokeWidth={0.22} />
            <Circle cx={17.15} cy={11.25} r={0.62} fill={theme.colors.surface} />
            <Circle cx={18.65} cy={12.7} r={0.22} fill={theme.colors.surface} opacity={0.55} />

            <Path d="M19.6 13.2 C19.9 13.6 19.9 14.0 19.6 14.3" stroke={theme.colors.ink} strokeWidth={0.22} strokeLinecap="round" opacity={0.7} />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
