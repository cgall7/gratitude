import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import Svg, { Polygon, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import { theme } from '../constants/theme';
import { hexTintFor } from './Avatar';
import { hexPoints } from './HexShape';
import { useSvgId } from '../utils/svgId';
import { DURATIONS, STAGGER_MS, useReducedMotion } from '../constants/motion';

// Cube-direction walk around a hex ring, center-out — gives us the classic
// "spiral" fill order (1, 6, 12, 18…) that a honeycomb actually grows in,
// and doubles as the stagger order for the zoom-in animation below.
const AXIAL_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const hexRing = (radius) => {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const cells = [];
  let hex = { q: AXIAL_DIRS[4].q * radius, r: AXIAL_DIRS[4].r * radius };
  for (let side = 0; side < 6; side += 1) {
    for (let step = 0; step < radius; step += 1) {
      cells.push(hex);
      hex = { q: hex.q + AXIAL_DIRS[side].q, r: hex.r + AXIAL_DIRS[side].r };
    }
  }
  return cells;
};

const hexSpiral = (maxRadius) => {
  let cells = [];
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    cells = cells.concat(hexRing(radius));
  }
  return cells;
};

// ONE ring around one centre. A hex spiral only closes at 1, 7, 19 — at any
// other count the outer ring is part-built and the whole cluster hangs off
// to one side, which is what the old cap of 12 did: it left ring 2 five
// twelfths filled, so the shape's centre of area sat 29.4pt below "You".
// Seven is the first count that closes, and it is also an honest size for a
// gratitude circle.
export const HIVE_SLOTS = 7;
const SPIRAL = hexSpiral(1);

// Flat-top axial -> pixel, matches the flat-top polygon points in HexShape.
const axialToPixel = (q, r, size) => ({
  x: size * 1.5 * q,
  y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
});

// Inverse of axialToPixel (flat-top), pre-round — see Red Blob Games'
// pixel_to_hex. Used by the single hit-test overlay below instead of
// per-cell Pressables, which is what R25/R34 replaced.
const pixelToAxialRaw = (x, y, size) => ({
  q: ((2 / 3) * x) / size,
  r: ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size,
});

// Cube rounding: nearest-hex-center is exact for a tessellation (the
// Voronoi region of a hex center is the hexagon itself), so this is the
// correct hit-test, not an approximation.
const axialRound = (q, r) => {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
};

const initialsFor = (name) => {
  const parts = (name || '?').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
};

// The cell IS the portrait. Before this the grid drew a hexagon and then
// dropped a fully opaque circle on top of it, so the honeycomb read as
// circles with corners peeking out — two shapes fighting, at two different
// densities, for one person. The photo (or the initials wash) is clipped to
// the hexagon, so a face is simply a cell in a comb.
// Demo members sit a register back from real ones — present enough that the
// comb reads as populated, quiet enough that they never pass for someone you
// actually know.
const DEMO_OPACITY = 0.45;

const FilledCell = ({ member, size, selected }) => {
  const clipId = useSvgId('hivecell');
  const points = useMemo(() => hexPoints(size), [size]);
  const tint = hexTintFor(member.name);
  const register = member.isDemo && !selected ? DEMO_OPACITY : 1;

  return (
    <View>
      <Svg width={size * 2} height={size * 2}>
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        {/* The cell is dimmed against `surface`, never against the screen.
            Fading the whole cell down onto Sunlit Honey (`background`,
            #FFF7CC — this container is transparent, so that is the ground)
            composites a cool wash over a warm ground and lands somewhere
            neither token names:
            washSky at this register measured (243,245,225) on device —
            green as the max channel, a sage cell in a honey comb. Backing
            the tint with white first keeps blue the max channel (243,249,253)
            and keeps the dimming a matter of strength, not of hue. */}
        <Polygon points={points} fill={theme.colors.surface} />
        {member.avatarUrl ? (
          <SvgImage
            href={{ uri: member.avatarUrl }}
            x="0"
            y="0"
            width={size * 2}
            height={size * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            opacity={register}
          />
        ) : (
          <Polygon points={points} fill={tint} fillOpacity={register} />
        )}
        <Polygon
          points={points}
          fill="none"
          stroke={selected ? theme.colors.ink : theme.colors.surface}
          strokeWidth={selected ? 2.5 : 2}
        />
      </Svg>
      {!member.avatarUrl && (
        <View style={styles.cellOverlay} pointerEvents="none">
          <Text style={[styles.initials, { fontSize: size * 0.42, opacity: register }]}>
            {member.isOwn ? 'You' : initialsFor(member.name)}
          </Text>
        </View>
      )}
    </View>
  );
};

// An empty seat, and an honest one: a quiet outline with a `+`. The grid
// used to fabricate strangers to fill these, which made a hive of one look
// like a hive of twelve. An empty cell is also the invite target — the
// gap in the comb is the thing you tap to close it.
const EmptyCell = ({ size }) => {
  const points = useMemo(() => hexPoints(size), [size]);

  return (
    <View>
      <Svg width={size * 2} height={size * 2}>
        <Polygon
          points={points}
          fill={theme.colors.surface}
          fillOpacity={0.45}
          stroke={theme.colors.surfaceBorderStrong}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={styles.cellOverlay} pointerEvents="none">
        <Text style={[styles.plus, { fontSize: size * 0.5 }]}>+</Text>
      </View>
    </View>
  );
};

const HexCell = ({ member, size, x, y, delay, selected, reduced }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 420,
      delay: reduced ? 0 : delay,
      easing: reduced ? Easing.linear : Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [progress, delay, reduced]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.15, 1] });

  return (
    <Animated.View
      style={[
        styles.cellWrap,
        {
          left: x,
          top: y,
          width: size * 2,
          height: size * 2,
          transform: [{ scale }],
          opacity: progress,
        },
      ]}
    >
      {member ? <FilledCell member={member} size={size} selected={selected} /> : <EmptyCell size={size} />}
    </Animated.View>
  );
};

// The hive's Today view: who in your circle has shared today. Seven seats,
// you in the middle, one ring around you. Tap a face to read what they
// wrote; tap a gap to invite someone into it.
export const HoneycombGrid = ({ members, cellSize = 44, onInvitePress }) => {
  const [selected, setSelected] = useState(null);
  const reduced = useReducedMotion();
  const cameraProgress = useRef(new Animated.Value(0)).current;
  const revealProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cameraProgress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 600,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cameraProgress, reduced]);

  const layout = useMemo(() => {
    // Always seven slots. Members fill them centre-out; the rest stay empty
    // rather than being padded with people who don't exist.
    const seated = members.slice(0, HIVE_SLOTS);
    const positions = SPIRAL.map((axial) => axialToPixel(axial.q, axial.r, cellSize));
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const width = Math.max(...positions.map((p) => p.x)) - minX + cellSize * 2;
    const height = Math.max(...positions.map((p) => p.y)) - minY + cellSize * 2;

    const byAxial = new Map();
    const cells = SPIRAL.map((axial, index) => {
      const member = seated[index] ?? null;
      byAxial.set(`${axial.q},${axial.r}`, member);
      return {
        key: member?.id ?? `empty-${axial.q},${axial.r}`,
        member,
        x: positions[index].x - minX,
        y: positions[index].y - minY,
        delay: index * STAGGER_MS,
      };
    });

    // Single hit-test for the whole cluster (R25/R34): a tap lands on the
    // hexagon whose center it's nearest to, not on whichever cell's box
    // happened to paint last. Cell centers sit at (x + cellSize, y + cellSize)
    // in this same cluster space, so undo that offset before inverting.
    // A tap outside the seven slots returns undefined and is ignored.
    const hitTest = (tapX, tapY) => {
      const raw = pixelToAxialRaw(tapX + minX - cellSize, tapY + minY - cellSize, cellSize);
      const { q, r } = axialRound(raw.q, raw.r);
      const key = `${q},${r}`;
      return byAxial.has(key) ? { seat: key, member: byAxial.get(key) } : null;
    };

    return { cells, width, height, hitTest };
  }, [members, cellSize]);

  const handleSelect = (member) => {
    revealProgress.setValue(0);
    setSelected(member);
    Animated.timing(revealProgress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 260,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // The camera dive-in is the screen's signature move, but it's also pure
  // travel — under Reduce Motion the cluster simply fades up in place.
  const cameraScale = cameraProgress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.8, 1] });

  return (
    <View style={styles.container}>
      <View style={[styles.stage, { height: layout.height + 24 }]}>
        <Animated.View
          style={{
            width: layout.width,
            height: layout.height,
            alignSelf: 'center',
            transform: [{ scale: cameraScale }],
            opacity: cameraProgress,
          }}
        >
          {layout.cells.map(({ key, member, x, y, delay }) => (
            <HexCell
              key={key}
              member={member}
              size={cellSize}
              x={x}
              y={y}
              delay={delay}
              selected={!!member && selected?.id === member.id}
              reduced={reduced}
            />
          ))}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              const hit = layout.hitTest(locationX, locationY);
              if (!hit) return;
              if (hit.member) handleSelect(hit.member);
              else onInvitePress?.();
            }}
            accessible={false}
          />
        </Animated.View>
      </View>

      {selected && (
        <Animated.View
          style={[
            styles.revealCard,
            {
              opacity: revealProgress,
              transform: [
                {
                  translateY: revealProgress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 10, 0] }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.revealName}>{selected.isOwn ? 'You' : selected.name}</Text>
          <Text style={styles.revealQuote}>"{selected.gratitude}"</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWrap: {
    position: 'absolute',
  },
  cellOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
  plus: {
    fontFamily: theme.fonts.body,
    color: theme.colors.inkSoft,
    opacity: 0.55,
  },
  revealCard: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    ...theme.shadows.card,
  },
  revealName: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  revealQuote: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
});
