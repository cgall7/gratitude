import React from 'react';
import Svg, { Polygon } from 'react-native-svg';

// The hive's hexagon, in one place.
//
// Flat-top, vertex-on-the-right — the same orientation HoneycombGrid's
// lattice is built from, so anything drawn with this reads as a piece of
// the same comb. `size` is the circumradius, so a cell is `size * 2` wide
// and `size * √3` tall.
//
// Written out as vertices rather than derived from a bounding box because
// the lattice maths (axialToPixel) and the polygon have to agree on what
// `size` means; deriving one from a box is how the Recap comb ended up
// with cells that never touched.
export const hexPoints = (size) => {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * 60 * i;
    points.push(`${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`);
  }
  return points.join(' ');
};

export const HEX_HEIGHT_RATIO = Math.sqrt(3) / 2; // height = width * this

// A single hexagon, sized to its own box. Used for the mini hex that marks
// a day in the week feed and for the empty seats in the comb.
export const HexShape = ({ size, fill = 'none', stroke, strokeWidth = 1.5, opacity = 1, style }) => (
  <Svg width={size * 2} height={size * 2} style={style} opacity={opacity}>
    <Polygon points={hexPoints(size)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  </Svg>
);
