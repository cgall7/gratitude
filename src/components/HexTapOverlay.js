import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, Ellipse } from 'react-native-svg';
import { theme } from '../constants/theme';
import { ringStepFor } from './combLattice';
import { useSvgId } from '../utils/svgId';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// react-native-svg's gradient `<Stop>` extraction (`extractGradient.ts`)
// takes `stopColor`'s RGB channels via `processColor` and then MASKS OUT
// whatever alpha that carried, rebuilding the pixel from `stopOpacity`
// alone. Every alpha token in this app (`withAlpha()`) IS an `rgba(...)`
// string, so handing one straight to `stopColor` renders at `stopOpacity`'s
// value, not at the product of the two — found on-device (§ Beat 1's dim
// rendered near-opaque instead of 0.25). Split it once here so the token
// stays the single source for both the colour and its alpha; this is a
// library quirk to work around, not a reason to hardcode the alpha instead.
const RGBA_RE = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;
const stopFor = (rgbaToken) => {
  const m = RGBA_RE.exec(rgbaToken);
  if (!m) throw new Error(`stopFor(): expected an rgba() token, got '${rgbaToken}'`);
  return { rgb: `rgb(${m[1]}, ${m[2]}, ${m[3]})`, alpha: parseFloat(m[4]) };
};

// Sub-1pt at rest, ~10pt diameter at swell's peak — the spec's "8-12pt
// sphere." The drip is 60% of that, per Beat 4's "one drip only, ~60% of
// the main bead's size at peak."
const BEAD_PEAK_R = 5;
const DRIP_PEAK_R = BEAD_PEAK_R * 0.6;
// How far the drip separates before Fall takes over, and how far Fall
// carries it. Falls "toward the reveal card below" per the spec, but the
// card isn't at a fixed offset from every cell — this is a local distance
// under the cell, not a literal card-anchored landing point. Open item for
// the on-device pass: does this read as landing on the card, or just near it.
const NECK_SEPARATION = BEAD_PEAK_R * 1.3;
const FALL_DISTANCE_FACTOR = 1.6; // × cellSize

/**
 * Lane D — the hex-tap honey drip's whole visual score (Beats 1-6;
 * Beat 7's reveal-card motion is Bumble's). One `<Svg>`, container-level,
 * sitting between the stage and the reveal card (ruling 4:
 * GUIDES/HEX_TAP_SPEC_LUXURY_PASS.md) so the card lands inside the dimmed
 * region instead of beside it.
 *
 * Geometry is a single point — `center` (cluster-space, converted to
 * container space by the caller via the cluster's own `onLayout` origin,
 * ruling 3) — and everything here (dim's punch-out, glow, bead, drip, pool)
 * is centred on it, so none of them can drift apart from one another.
 *
 * Bead/neck/drip shape is a first build against `HONEY`'s durations and
 * easings, not a final pass — `motion.js`'s own comment on `HONEY.neck`
 * says the exact geometry is Deezine's storyboard to score. This is what
 * that duration looks like rendered, for review.
 */
export const HexTapOverlay = ({
  width,
  height,
  center,
  cellSize,
  cameraProgress,
  revealProgress,
  honeyDecay,
  glowBloomOpacity,
  glowRestOpacity,
  beadProgress,
  neckProgress,
  fallProgress,
  poolProgress,
}) => {
  const dimId = useSvgId('hexScrimDim');
  const bloomId = useSvgId('hexScrimBloom');
  const restId = useSvgId('hexScrimRest');

  if (!center || !width || !height) return null;

  // R7 (First-Build Review): a dim that holds at full strength to the edge
  // of its own box is a mask, not a light — the container is narrower than
  // the comb's worst-case reach, so any radius that fully covers the comb
  // also hits the box edge at full strength. Falloff, not coverage: `R` is
  // 3 ringsteps out, and a third stop releases back to transparent before
  // the box edge. `punchStop`/`fullStop` stay fractions of `R`, never
  // typed, so `punchStop · R === cellSize` and `fullStop · R ===
  // ringStepFor(cellSize)` hold structurally if `cellSize` ever retunes.
  const R = 3 * ringStepFor(cellSize);
  const punchStop = cellSize / R;
  const fullStop = ringStepFor(cellSize) / R; // = 1/3, independent of cellSize

  // R5 (First-Build Review, BLOCKING): `shadowRadius` is a blur spread
  // measured outward from a view's EDGE; an SVG `RadialGradient`'s `r` is a
  // total extent measured from a CENTRE. Used directly, `bloom` (24pt) and
  // `rest` (12pt) both land inside the punch-out's transparent radius
  // (`cellSize` = 44pt) — the glow can only ever paint on ground the scrim
  // already left undimmed, which is why it measured cooler than neutral
  // on-device instead of reading as light. Converting the frame means the
  // blur begins at the punch-out's own edge, not at `center`.
  const bloom = theme.shadows.glow(theme.colors.accentBurst, 'bloom');
  const rest = theme.shadows.glow(theme.colors.accentBurst, 'rest');
  const bloomR = cellSize + bloom.shadowRadius; // 44 + 24 = 68pt
  const restR = cellSize + rest.shadowRadius; // 44 + 12 = 56pt
  const dim = stopFor(theme.colors.spotlightDim);

  // Ruling 3(b): the scrim is exactly as transparent as its geometry is
  // wrong during the camera dive, and hits full strength once the transform
  // lands identity. Wrapping the whole overlay in `cameraProgress` extends
  // that guard to the glow and the bead/drip/pool too — they're drawn in
  // the same container-space point, so they carry the same risk.
  const dimOpacity = Animated.multiply(revealProgress, honeyDecay);
  const bloomOpacity = glowBloomOpacity;
  const restOpacity = Animated.multiply(glowRestOpacity, honeyDecay);

  // Swell grows the bead 0.5 -> peak and holds at peak once Beat 3 ends;
  // neck then subtracts a shrink delta on top of that held value (0 until
  // Beat 4 starts, so the two compose with no seam between them) — one
  // circle's radius, not two animations racing each other for the same prop.
  const beadGrowR = beadProgress.interpolate({ inputRange: [0, 1], outputRange: [0.5, BEAD_PEAK_R] });
  const neckShrinkDelta = neckProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -(BEAD_PEAK_R * 0.25)] });
  const mainBeadR = Animated.add(beadGrowR, neckShrinkDelta);
  const mainBeadOpacity = fallProgress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });

  const dripR = neckProgress.interpolate({ inputRange: [0, 1], outputRange: [0, DRIP_PEAK_R] });
  const dripSeparationY = neckProgress.interpolate({ inputRange: [0, 1], outputRange: [0, NECK_SEPARATION] });
  const fallDistance = cellSize * FALL_DISTANCE_FACTOR;
  const dripFallDelta = fallProgress.interpolate({ inputRange: [0, 1], outputRange: [0, fallDistance - NECK_SEPARATION] });
  const dripY = Animated.add(dripSeparationY, dripFallDelta);
  const dripOpacity = Animated.multiply(
    fallProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
    poolProgress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0, 0] })
  );

  // Pool: starts as a bead, flattens and spreads (rx grows, ry shrinks) over
  // the whole pool duration; opacity crossfades in from the drip over the
  // first 15% and holds until the fade in the last 600ms of 1100ms (§ Beat 6).
  const HOLD_FRACTION = 1 - 600 / 1100;
  const poolRx = poolProgress.interpolate({ inputRange: [0, 1], outputRange: [DRIP_PEAK_R, DRIP_PEAK_R * 2.4] });
  const poolRy = poolProgress.interpolate({ inputRange: [0, 1], outputRange: [DRIP_PEAK_R, DRIP_PEAK_R * 0.55] });
  const poolOpacity = poolProgress.interpolate({
    inputRange: [0, 0.15, HOLD_FRACTION, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: cameraProgress }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={dimId} cx={center.x} cy={center.y} r={R} gradientUnits="userSpaceOnUse">
            <Stop offset={punchStop} stopColor={dim.rgb} stopOpacity="0" />
            <Stop offset={fullStop} stopColor={dim.rgb} stopOpacity={dim.alpha} />
            <Stop offset={1} stopColor={dim.rgb} stopOpacity="0" />
          </RadialGradient>
          {/* Glow opacity reads straight off `shadows.glow()` so a
              View-shadow retune moves this for free; radius is the SAME
              level converted into the gradient's frame (`bloomR`/`restR`
              above), never `shadowRadius` directly — see R5. */}
          <RadialGradient id={bloomId} cx={center.x} cy={center.y} r={bloomR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.colors.accentBurst} stopOpacity={bloom.shadowOpacity} />
            <Stop offset="1" stopColor={theme.colors.accentBurst} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={restId} cx={center.x} cy={center.y} r={restR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.colors.accentBurst} stopOpacity={rest.shadowOpacity} />
            <Stop offset="1" stopColor={theme.colors.accentBurst} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <AnimatedRect x={0} y={0} width={width} height={height} fill={`url(#${dimId})`} opacity={dimOpacity} />
        <AnimatedCircle cx={center.x} cy={center.y} r={bloomR} fill={`url(#${bloomId})`} opacity={bloomOpacity} />
        <AnimatedCircle cx={center.x} cy={center.y} r={restR} fill={`url(#${restId})`} opacity={restOpacity} />

        {/* Beat 3 (swell) — main bead, gathers and grows from the centroid. */}
        <AnimatedCircle
          cx={center.x}
          cy={center.y}
          r={mainBeadR}
          fill={theme.colors.accent}
          opacity={mainBeadOpacity}
        />

        {/* Beat 4-5 (neck + fall) — the drip: forms, separates, falls straight down. */}
        <AnimatedCircle
          cx={center.x}
          cy={Animated.add(center.y, dripY)}
          r={dripR}
          fill={theme.colors.accentDeep}
          opacity={dripOpacity}
        />

        {/* Beat 6 (pool) — lands, flattens, fades over its last 600ms. */}
        <AnimatedEllipse
          cx={center.x}
          cy={center.y + fallDistance}
          rx={poolRx}
          ry={poolRy}
          fill={theme.colors.honeyPool}
          opacity={poolOpacity}
        />
      </Svg>
    </Animated.View>
  );
};
