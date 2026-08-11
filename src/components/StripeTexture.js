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
// Exists so a sibling-per-cell `<Svg>` grid (§14.4 Recap comb) never hands
// `Polygon` a raw color prop. Pixel's device matrix (2026-08-11) isolated
// the trigger for a react-native-svg/Fabric mispaint to sibling `<Svg>`
// roots whose `Polygon` `fill`/`stroke` differ in *value* between cells —
// solid-vs-pattern, or even just stroke color alone. Byte-identical
// `Polygon` props (both always a `url(#id)` reference, only the `<Defs>`
// content behind that id differing per cell) was the one variant that
// rendered pixel-perfect. Route every color that can vary per-cell —
// fill AND stroke — through a pattern reference like this one, never a
// literal theme color, on that Svg root.
export const SolidPattern = ({ id, color, size = 5 }) => (
  <Pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size}>
    <Rect x="0" y="0" width={size} height={size} fill={color} />
  </Pattern>
);
