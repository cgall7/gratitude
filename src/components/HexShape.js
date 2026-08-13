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

const hexVertex = (size, i) => {
  const angle = (Math.PI / 180) * 60 * i;
  return { x: size + size * Math.cos(angle), y: size + size * Math.sin(angle) };
};

// One mark centred on each of the six edges, inset toward the center — the
// segmented "blooming" ring (§21/6.4, Pixel-ruled 2026-08-13: cell fill is
// identity, marks and rings are state — fill can only ever hold one value
// and its range is capped by whichever tint the member's name hashed to,
// so it can't carry a second signal). Built off the same vertex formula as
// `hexPoints` so a mark and the cell it sits on always agree about where
// the edges are. Returns six `[x1, y1, x2, y2]` pairs for direct use as SVG
// `Line` endpoints.
export const hexEdgeMarks = (size, inset, edgeFraction) => {
  const center = { x: size, y: size };
  const marks = [];
  for (let i = 0; i < 6; i += 1) {
    const v0 = hexVertex(size, i);
    const v1 = hexVertex(size, (i + 1) % 6);
    const mid = { x: (v0.x + v1.x) / 2, y: (v0.y + v1.y) / 2 };
    const outLen = Math.hypot(mid.x - center.x, mid.y - center.y);
    const inward = { x: (mid.x - center.x) / outLen, y: (mid.y - center.y) / outLen };
    const p = { x: mid.x - inward.x * inset, y: mid.y - inward.y * inset };
    const edgeLen = Math.hypot(v1.x - v0.x, v1.y - v0.y);
    const along = { x: (v1.x - v0.x) / edgeLen, y: (v1.y - v0.y) / edgeLen };
    const half = (size * edgeFraction) / 2;
    marks.push([p.x - along.x * half, p.y - along.y * half, p.x + along.x * half, p.y + along.y * half]);
  }
  return marks;
};

// The "seeded" badge: a small hexagon seal on the cell's lower-right VERTEX
// ray (60° from centre), figure knocked out to whatever painted beneath it
// rather than painted in a second colour — R51's register rule, "it never
// flew," applied to a mark instead of a stripe. Two nested hexagons at one
// center, `evenodd`, punch the hole; draw the returned path in the SAME
// `Svg` as the cell's own fill so the hole reveals that fill, not a bare
// transparent gap.
//
// §21.10 (R59): this used to sit on the lower-right EDGE ray (30°, the
// midpoint of vertices 0 and 1) — the same ray `hexEdgeMarks` centres a
// blooming mark on, so the two collided 77% of the mark's width whenever a
// member was both blooming and seeded, and the ring silently read as five
// marks instead of six. `hexEdgeMarks` occupies the six EDGE directions, so
// the six VERTEX directions are free by construction. Moved to the 60°
// vertex ray at 0.682 × the circumradius (verified: ±17.1° seal clearance
// inside the ±18.7° gap between the 30°/90° marks; 12.12pt to each
// adjacent edge against an 8.80pt seal radius). Seal radius unchanged.
export const hexSealPath = (size) => {
  const angle = (Math.PI / 180) * 60; // lower-right vertex
  const dist = size * 0.682;
  const center = { x: size + Math.cos(angle) * dist, y: size + Math.sin(angle) * dist };
  const r = size * 0.2;
  const ring = (radius) => {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 180) * 60 * i;
      pts.push(`${center.x + radius * Math.cos(a)},${center.y + radius * Math.sin(a)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  };
  return `${ring(r)} ${ring(r * 0.5)}`;
};

// A single hexagon, sized to its own box. Used for the mini hex that marks
// a day in the week feed and for the empty seats in the comb.
export const HexShape = ({ size, fill = 'none', stroke, strokeWidth = 1.5, opacity = 1, style }) => (
  <Svg width={size * 2} height={size * 2} style={style} opacity={opacity}>
    <Polygon points={hexPoints(size)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  </Svg>
);
