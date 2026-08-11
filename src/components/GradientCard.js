import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSvgId } from '../utils/svgId';

// Corner-to-corner color wash behind a card, so hero content reads as
// catching light instead of sitting on a flat white rect. Stops come from
// `theme.gradients` (token-built) — never pass literal hex.
//
// The shadow has to live on the outer `style` view: `overflow: hidden` is
// what clips the wash to the rounded corners, and on the same node it
// silently kills RN shadows on iOS.
export const GradientCard = ({ colors, style, contentStyle, children }) => {
  const gradientId = useSvgId('cardWash');

  return (
    <View style={style}>
      <View style={[styles.clip, contentStyle]}>
        {/* `width`/`height` are explicit on purpose. `Svg` only defaults
            them to "100%" when `position !== 'absolute'` on the flattened
            style (Svg.tsx:125) — an absolutely-positioned Svg is expected
            to take its size from layout, so it refuses to infer a viewport
            and leaves `bbWidth`/`bbHeight` unset. The `<Rect>` below is
            percentage-sized and has nothing to resolve against without
            them. */}
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" pointerEvents="none">
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
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
