import React from 'react';
import Svg, { Ellipse, Circle, Path } from 'react-native-svg';

// Per GUIDES/HONEYCOMB_BEE_GLYPH.md — the one custom motion asset in the app.
// Static glyph; callers animate it via Animated.View transforms (translateX/Y,
// rotation) along a bezier path. Color is hardcoded to theme.colors.ink — grep
// `#221B03` here if ink ever changes.
export const Bee = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Ellipse cx={8.5} cy={8.6} rx={3.1} ry={1.9} fill="#221B03" fillOpacity={0.22} transform="rotate(-24 8.5 8.6)" />
    <Ellipse cx={13.2} cy={8.4} rx={3.1} ry={1.9} fill="#221B03" fillOpacity={0.22} transform="rotate(22 13.2 8.4)" />
    <Ellipse cx={11} cy={13.2} rx={5.6} ry={4} fill="#221B03" />
    <Circle cx={17.3} cy={12.1} r={2.3} fill="#221B03" />
    <Path d="M17.9 10.1 C18.3 9 19.1 8.3 20 8" stroke="#221B03" strokeWidth={1} strokeLinecap="round" />
    <Path d="M18.7 10.7 C19.4 9.9 20.4 9.6 21.2 9.8" stroke="#221B03" strokeWidth={1} strokeLinecap="round" />
  </Svg>
);
