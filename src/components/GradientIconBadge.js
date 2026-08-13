import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useSvgId } from '../utils/svgId';

// A small colored-glass roundel behind a glyph — the category cue that lets
// a stack of insight cards read at a glance instead of as a wall of
// identical white rectangles. One per card, at the top: it is the card's
// only accent fill, which is what keeps §1's one-accent rule intact while
// still giving each insight an identity.
export const GradientIconBadge = ({
  icon,
  size = 44,
  colors = theme.gradients.badge,
  style,
}) => {
  const gradientId = useSvgId('badgeWash');

  return (
    <View style={[styles.badge, { width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, i) => (
              <Stop
                key={color + i}
                offset={`${(i / (colors.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
      <Ionicons name={icon} size={size * 0.5} color={theme.colors.textInverse} />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.tinted(theme.colors.accent),
  },
});
