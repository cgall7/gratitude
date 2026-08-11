import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { Avatar, avatarColorFor } from './Avatar';
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

// Flat-top axial -> pixel, matches the flat-top polygon points in HexCell.
const axialToPixel = (q, r, size) => ({
  x: size * 1.5 * q,
  y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
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

const hexPoints = (size) => {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
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
  const opacity = progress;
  const tint = avatarColorFor(member.name);
  const points = useMemo(() => hexPoints(size), [size]);

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
          opacity,
        },
      ]}
    >
      <View>
        <Svg width={size * 2} height={size * 2}>
          <Polygon
            points={points}
            fill={tint}
            fillOpacity={selected ? 0.9 : member.isDemo ? 0.35 : 0.55}
            stroke={selected ? theme.colors.ink : 'rgba(255,255,255,0.7)'}
            strokeWidth={selected ? 2 : 1.5}
          />
        </Svg>
        <View style={styles.avatarOverlay} pointerEvents="none">
          <Avatar name={member.name} avatarUrl={member.avatarUrl} size={size * 1.05} />
        </View>
      </View>
    </Animated.View>
  );
};

// The "super animated" hive: zoom the whole cluster in from far away while
// each hex cell pops in center-out, like the camera is diving into the
// honeycomb and cells are filling with people as it arrives. Tap a cell to
// reveal who it is and what they're grateful for.
export const HoneycombGrid = ({ members, cellSize = 34 }) => {
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
    const spiral = hexSpiral(3).slice(0, members.length);
    const positions = spiral.map((axial) => axialToPixel(axial.q, axial.r, cellSize));
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const width = maxX - minX + cellSize * 2;
    const height = maxY - minY + cellSize * 2;
    const byAxial = new Map();
    const cells = members.map((member, index) => {
      const axial = spiral[index];
      byAxial.set(`${axial.q},${axial.r}`, member);
      return {
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
    const hitTest = (tapX, tapY) => {
      const raw = pixelToAxialRaw(tapX + minX - cellSize, tapY + minY - cellSize, cellSize);
      const { q, r } = axialRound(raw.q, raw.r);
      return byAxial.get(`${q},${r}`) ?? null;
    };
    return { cells, width, height, hitTest };
  }, [members, cellSize]);

  const handlePress = (member) => {
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
  const cameraOpacity = cameraProgress;

  return (
    <View style={styles.container}>
      <View style={[styles.stage, { height: layout.height + 24 }]}>
        <Animated.View
          style={{
            width: layout.width,
            height: layout.height,
            alignSelf: 'center',
            transform: [{ scale: cameraScale }],
            opacity: cameraOpacity,
          }}
        >
          {layout.cells.map(({ member, x, y, delay }) => (
            <HexCell
              key={member.id}
              member={member}
              size={cellSize}
              x={x}
              y={y}
              delay={delay}
              selected={selected?.id === member.id}
              reduced={reduced}
            />
          ))}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              const member = layout.hitTest(locationX, locationY);
              if (member) handlePress(member);
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
          <View style={styles.revealHeader}>
            <Avatar name={selected.name} avatarUrl={selected.avatarUrl} size={36} />
            <Text style={styles.revealName}>{selected.isOwn ? 'You' : selected.name}</Text>
          </View>
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
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  revealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  revealName: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  revealQuote: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
});
