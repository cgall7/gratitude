import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../constants/theme';

// §19.5 — StripedBee circuit-wings redesign. Flat vector cousin of the 3D hero
// mascot, with circuit-trace wings that support independent flutter animation.
//
// The bee reads as the same character across all sizes (13–64pt flights, plus
// 132pt hero via separate render). Wings are a separable layer with circuit-
// trace geometry that can be driven by flutter (scaleY) independently from any
// parent caller motion.
//
// Prop contract (byte-identical across 9 call sites):
// - size: 13 | 16 | 22 | 32 | 44 | 64 (flight scales only; hero uses 3D render)
// - fieldColor: ground color (theme.colors.* — used for contrast tuning, not knockout)
// - bandColor: stripe color (default theme.colors.ink; can be overridden for accent)
// - flutter: boolean (enables internal wing scaleY animation)
// - wingStyle: "circuit" (future extensibility for other wing designs)
//
// Design constraint: at 64pt on gold field (#F0C023), the body is ΔE00 4.93
// from ground — form is carried by the ink bands, not the body-ground edge.
// At all other sites and sizes, contrast is strong enough for silhouette reads.
//
// Flutter animation: wing layer scaleY oscillates 0.95–1.05 (gentle flutter,
// not the 1–0.55 compression of the old design) to keep the character
// readable at all scales. Pass flutter=true only during flight, and never
// under Reduce Motion.
const WING_FLICK_MS = 80;
const GRADIENT_ID = 'striped-bee-hero-gradient';

export const StripedBee = ({
  size = 44,
  fieldColor = theme.colors.background,
  bandColor = theme.colors.ink,
  wingStyle = 'circuit',
  flutter = false,
}) => {
  const wing = useRef(new Animated.Value(0)).current;
  const isHeroSize = size >= 100;
  const isMicroSize = size <= 22;

  useEffect(() => {
    if (!flutter) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wing, { toValue: 1, duration: WING_FLICK_MS, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: WING_FLICK_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flutter, wing]);

  const flutterStyle = flutter
    ? { transform: [{ scaleY: wing.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }] }
    : null;

  // Circuit-trace stroke adapts color and opacity to size
  const circuitStrokeColor = size >= 64 ? '#A67C00' : '#8B7500';
  const circuitOpacity = isHeroSize ? 0.8 : 0.7;
  const wingGlowOpacity = isHeroSize ? 0.2 : 0.15;
  const strokeWidth = isMicroSize ? 0.4 : isHeroSize ? 0.6 : 0.5;

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Defs>
          {isHeroSize && (
            <LinearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFE033" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFD200" stopOpacity="1" />
            </LinearGradient>
          )}
        </Defs>

        {/* Body layer — golden with ink banding */}
        <G id="body">
          {/* Thorax */}
          <Ellipse
            cx="12"
            cy="10"
            rx="5"
            ry="6"
            fill={isHeroSize ? `url(#${GRADIENT_ID})` : '#FFD200'}
          />

          {/* Abdomen */}
          <Ellipse
            cx="12"
            cy="16"
            rx="4.5"
            ry="5"
            fill={isHeroSize ? `url(#${GRADIENT_ID})` : '#FFD200'}
          />

          {/* Abdominal stripes */}
          <Path d="M 10 13.5 L 14 13.5" stroke={bandColor} strokeWidth="1" />
          <Path d="M 10 16 L 14 16" stroke={bandColor} strokeWidth="0.8" />
          <Path d="M 10 18.5 L 14 18.5" stroke={bandColor} strokeWidth="0.8" />

          {/* Head */}
          <Circle
            cx="12"
            cy="4"
            r="3"
            fill={isHeroSize ? `url(#${GRADIENT_ID})` : '#FFD200'}
          />

          {/* Eye */}
          <Circle cx="12" cy="3.5" r="1.2" fill={bandColor} />
          {isHeroSize && (
            <Circle cx="12" cy="3.5" r="1" fill="#FFD200" />
          )}

          {/* Antennae (22pt+) */}
          {size > 16 && (
            <>
              <Path
                d="M 11.5 2.5 Q 10.5 1.5 10 1"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 12.5 2.5 Q 13.5 1.5 14 1"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Legs (32pt+) */}
          {size >= 32 && (
            <>
              <Path
                d="M 8 12 L 6 15"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 8 14 L 6.5 17"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 16 12 L 18 15"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 16 14 L 17.5 17"
                stroke={bandColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
        </G>
      </Svg>

      {/* Wing layer — separable, can be animated via flutter */}
      <Animated.View style={[StyleSheet.absoluteFill, flutterStyle, wingStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {wingStyle === 'circuit' && (
            <>
              {/* Wing glows */}
              <Ellipse cx="7" cy="8" rx="3.5" ry="5.5" fill="#FFD200" opacity={wingGlowOpacity} />
              <Ellipse cx="17" cy="8" rx="3.5" ry="5.5" fill="#FFD200" opacity={wingGlowOpacity} />

              {/* Left wing circuit trace */}
              <Path
                d="M 6 5 Q 5 7 5.5 10 Q 6 13 7.5 15"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 5.5 7 Q 5 9 5.8 11"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 6.5 6 Q 6 8.5 7 12"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 7 5.5 Q 6.5 8 7.5 11"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              {!isMicroSize && (
                <>
                  <Circle cx="5.8" cy="8" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                  <Circle cx="6.5" cy="10" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                  <Circle cx="7" cy="12" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                </>
              )}

              {/* Right wing circuit trace (mirrored) */}
              <Path
                d="M 18 5 Q 19 7 18.5 10 Q 18 13 16.5 15"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 18.5 7 Q 19 9 18.2 11"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 17.5 6 Q 18 8.5 17 12"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              <Path
                d="M 17 5.5 Q 17.5 8 16.5 11"
                stroke={circuitStrokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={circuitOpacity}
                strokeLinecap="round"
              />
              {!isMicroSize && (
                <>
                  <Circle cx="18.2" cy="8" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                  <Circle cx="17.5" cy="10" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                  <Circle cx="17" cy="12" r="0.3" fill={circuitStrokeColor} opacity={circuitOpacity} />
                </>
              )}
            </>
          )}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};
