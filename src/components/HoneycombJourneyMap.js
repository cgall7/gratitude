import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { useReducedMotion } from '../constants/motion';

// Internal stage keys only — never rendered as on-screen text (Deezine,
// ratified by Sage 2026-08-09). Claims collapse into `why`; signup/name is
// `you`.
const STAGE_ORDER = ['welcome', 'why', 'you', 'moment', 'entry', 'done'];
const STAGE_LABELS = ['Welcome', 'Why', 'You', 'Moment', 'Entry', 'Done'];
const A11Y_LABEL = STAGE_LABELS.join(', ');

const CELL_SIZE = 10;

const hexPoints = (size) => {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
};

const HEX_POINTS = hexPoints(CELL_SIZE);

const JourneyCell = ({ status }) => {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'current') return undefined;
    // Reduce Motion drops the pulse, but it must not drop the marker. The
    // animated style below applies to the current cell only, so resting at
    // `pulse = 0` would leave it at opacity 0.55 — dimmer than every
    // completed cell, i.e. the current step would become the least visible
    // thing on the map. Rest at 1 instead: scale 1.18, opacity 1, so the
    // current cell stays the most prominent one and only the motion goes.
    // (§14.1 "no exceptions" for indefinite motion; R16-R19's principle —
    // keep the distinction, drop the motion.)
    if (reduced) {
      pulse.setValue(1);
      return undefined;
    }
    // Start from the trough every time. Matters on the Reduce Motion
    // toggle-off path, where the guard above has parked `pulse` at 1: the
    // sequence leads with a rise, so without this the first cycle after
    // un-reducing would run backwards before self-correcting. No-op on
    // mount, where `pulse` is already 0.
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, reduced, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const filled = status === 'completed' || status === 'current';

  return (
    <Animated.View style={status === 'current' ? { transform: [{ scale }], opacity } : undefined}>
      <Svg width={CELL_SIZE * 2} height={CELL_SIZE * 2}>
        <Polygon
          points={HEX_POINTS}
          fill={filled ? theme.colors.accent : 'transparent'}
          stroke={filled ? 'transparent' : theme.colors.inkSoft}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
};

// Replaces the old dash-fill SegmentedProgress (Colin, 2026-08-09 — "the
// onboarding journey map at the top is not very good"). Six honeycomb
// cells read as an actual journey without competing with each screen's h1
// for attention, and give the honey/flowers pillar a home it didn't have
// yet. Nothing here renders as visible type — the fill tells the story;
// accessibilityLabel carries the six stage words for screen readers.
export const HoneycombJourneyMap = ({ stage }) => {
  const currentIndex = Math.max(0, STAGE_ORDER.indexOf(stage));

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={A11Y_LABEL}
      accessibilityValue={{ text: STAGE_LABELS[currentIndex] }}
    >
      {STAGE_ORDER.map((key, index) => (
        <JourneyCell
          key={key}
          status={index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming'}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
