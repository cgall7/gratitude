import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

// A small colored-glass roundel behind a glyph — the "category icon" cue
// stat-card apps use so a list of insights reads at a glance instead of
// as a wall of identical white cards.
export const GradientIconBadge = ({ icon, size = 44, colors = theme.gradients.badge, style }) => (
  <View style={[styles.badge, { width: size, height: size }, style]}>
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <LinearGradient id="badgeWash" x1="0%" y1="0%" x2="100%" y2="100%">
          {colors.map((color, i) => (
            <Stop key={color + i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#badgeWash)" />
    </Svg>
    <Ionicons name={icon} size={size * 0.5} color={theme.colors.textInverse} />
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.tinted(theme.colors.accent),
  },
});
