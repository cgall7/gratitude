import React from 'react';
import { Pattern, Path, Rect } from 'react-native-svg';
import { theme } from '../constants/theme';

// The "not filled yet" material: pale surface with a faint diagonal hatch.
//
// An empty day drawn as flat 50%-opacity white reads as a rendering gap —
// something missing rather than something waiting. Hatching it makes the
// absence deliberate: the cell is clearly *there*, clearly *unearned*. It
// buys that without a second gray tone, which a one-accent palette has no
// room for.
//
// This is a `<Defs>` entry, not a view: render it inside the same `<Svg>`
// as the shape it fills and use `fill={`url(#${id})`}`. That way the hatch
// is clipped by the §14.4 hex itself instead of by a parent's
// `overflow: hidden` — a rounded-rect overlay can't follow a hex edge.
export const StripePattern = ({
  id,
  color = theme.colors.inkSoft,
  base = theme.colors.surface,
  size = 5,
}) => (
  <Pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform="rotate(45)">
    <Rect x="0" y="0" width={size} height={size} fill={base} fillOpacity={0.5} />
    {/* Centred in the tile, not on its edge. A stroke on `x = 0` is centred
        on the boundary and pattern content is clipped to the tile rather
        than wrapped, so half of every band would be discarded — even
        spacing, but half the weight, at an opacity that can't spare it. */}
    <Path
      d={`M${size / 2},0 L${size / 2},${size}`}
      stroke={color}
      strokeWidth={size / 2}
      strokeOpacity={0.14}
    />
  </Pattern>
);

// A flat-color `<Defs>` fill, same paint-server shape as `StripePattern`.
//
// Exists so Recap's sibling-per-cell `<Svg>` grid (§14.4 comb) never hands
// `Polygon` a raw color prop. Pixel's device matrix (2026-08-11) proved this
// grid mispaints when siblings mix solid-fill and paint-server (`url(#…)`)
// `Polygon`s — the two take structurally different CGContext paths on this
// react-native-svg/Fabric build. Byte-identical `Polygon` props (always a
// `url(#id)` reference, only the `<Defs>` content behind that id differing
// per cell) was the variant that rendered pixel-perfect; that's the scope
// this rule is proven for. Whether plain differing color *values* on an
// all-solid or all-pattern sibling grid also mispaints is still open —
// Deezine's counter-examples (JourneyCell, HexCell) work today and aren't
// covered by this fix — pending Pixel's re-run of that isolated matrix row.
// Route every color that can vary per-cell on this grid — fill AND stroke —
// through a pattern reference like this one, never a literal theme color.
export const SolidPattern = ({ id, color, size = 128 }) => (
  // Deliberately larger than any hex it paints: a flat color has no repeat,
  // so this never actually tiles. Avoids RNSVGPainter's constant-spacing
  // tiling (rounds to whole device pixels) firing ~120x per cell for a
  // color that has no pattern to preserve — same pixels, no artifact class.
  <Pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size}>
    <Rect x="0" y="0" width={size} height={size} fill={color} />
  </Pattern>
);
