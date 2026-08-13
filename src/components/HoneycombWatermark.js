import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { hexPoints } from './HexShape';

// A comb of unnamed cells, quiet enough to sit behind body copy without
// competing with it or reporting on the reader's actual data (Pixel's
// beat-2 placement ruling, 2026-08-13: "the honeycomb IS that list,
// drawn... it illustrates the sentence rather than reporting on the
// user's data"). Same one-ring-of-seven shape HoneycombGrid seats a real
// hive in (HIVE_SLOTS), so this pre-teaches the shape before the tab is
// ever opened. Stroke only, no fill, no initials, no "+" — an EmptyCell
// still promises a tap target and this promises nothing.
const CELLS = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// Flat-top axial -> pixel, matches HoneycombGrid's own lattice so a cell
// drawn here sits exactly where it would in the real comb.
const axialToPixel = (q, r, size) => ({
  x: size * 1.5 * q,
  y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
});

export const HoneycombWatermark = ({ size = 16, style }) => {
  const layout = useMemo(() => {
    const positions = CELLS.map((c) => axialToPixel(c.q, c.r, size));
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const width = Math.max(...positions.map((p) => p.x)) - minX + size * 2;
    const height = Math.max(...positions.map((p) => p.y)) - minY + size * 2;
    return { width, height, cells: positions.map((p) => ({ x: p.x - minX, y: p.y - minY })) };
  }, [size]);

  const points = useMemo(() => hexPoints(size), [size]);

  return (
    <View pointerEvents="none" style={[{ width: layout.width, height: layout.height }, style]}>
      {layout.cells.map((c, i) => (
        <Svg key={i} width={size * 2} height={size * 2} style={{ position: 'absolute', left: c.x, top: c.y }}>
          {/* `surfaceBorder` (0.08 alpha), not `surfaceBorderStrong` — this
              sits directly behind live body-copy glyphs, not inside a card,
              and the stronger token is reserved for filled/selected states
              elsewhere in the comb. */}
          <Polygon points={points} fill="none" stroke={theme.colors.surfaceBorder} strokeWidth={1.5} />
        </Svg>
      ))}
    </View>
  );
};
