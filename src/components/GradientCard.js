import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// Corner-to-corner color wash behind a card, so hero content reads as
// catching light instead of sitting on a flat white rect. Shadow has to
// live on the outer `style` view — `overflow: hidden` (needed to clip the
// gradient to the rounded corners) silently kills RN shadows on iOS if
// they're on the same node.
export const GradientCard = ({ colors, style, contentStyle, children }) => (
  <View style={style}>
    <View style={[styles.clip, contentStyle]}>
      <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Defs>
          <LinearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, i) => (
              <Stop key={color + i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash)" />
      </Svg>
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
