import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';

// Diagonal hatch fill for "not filled yet" cells — gives empty states a
// deliberate texture instead of dead flat space, without needing a second
// gray tone that would fight the one-accent palette. Relies on the parent
// having `overflow: hidden` + matching borderRadius to clip to shape.
export const StripeTexture = ({ color = 'rgba(34,27,3,0.10)' }) => (
  <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Defs>
      <Pattern id="stripes" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <Path d="M0,0 L0,6" stroke={color} strokeWidth="3" />
      </Pattern>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#stripes)" />
  </Svg>
);
