import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Path } from 'react-native-svg';
import { theme } from '../constants/theme';

// §17.3 — the one bee. Ratified app-wide: the unstriped `Bee` glyph retires
// and every bee in the app is this one, because the "quick black bee" Colin
// disliked turned out to be nearly all of them, including the one standing
// on the keepsake card.
//
// **The abdomen band is painted, not knocked out — flight ruling, §17.3
// amendment.** A `fieldColor` knockout is only honest when the field is
// known and constant (the keepsake card, the gold field). A cruising bee
// crosses arbitrary content, so a fixed knockout there just paints an
// opaque cream band over whatever it's passing — the fake-transparency bug
// §17.3 already killed once, reborn in motion. `bandColor` (default:
// `fieldColor`, so every merged keepsake site is byte-identical) lets
// flight sites pass `theme.colors.accent` instead — the band sits between
// ink caps on both sides, so its contrast is internal and field-independent
// everywhere. The eye glint stays a true `fieldColor` knockout: 1-2px,
// ink-framed, fine either way.
//
// **Wings are their own sibling `<Svg>`.** `wingStyle` lets an external
// caller (the mascot's own held-pose bob) drive the wing layer; `flutter`
// opts into an internal wing-buzz loop for flight moments big enough to
// read it (44pt cruise, 32pt claim arc) — pass it only while airborne, and
// never under Reduce Motion. Both compose onto the same layer; nothing
// stops a caller from combining them, though today nothing does.
//
// **No bob on the body.** Every positional rhythm still belongs to the
// caller. Two bobs composed on one bee is the failure mode §17.3 called
// out by name — `flutter`'s wing flick is additive to that, not an
// exception to it.
//
// Scope note: this is deliberately NOT yet wired into `WelcomeBee`, whose
// drawn body it is extracted from. Collapsing the two is part of the flows
// branch's mascot pass — `CoreRitual` is open there, and changing the hero
// mascot's stripe from paint to knockout underneath that branch is how one
// ruling becomes two conflicting bees. The duplication is one branch long
// and on purpose.
const WING_FLICK_MS = 80;

export const StripedBee = ({
  size = 44,
  fieldColor = theme.colors.background,
  bandColor = fieldColor,
  wingStyle,
  flutter = false,
}) => {
  const wing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!flutter) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wing, { toValue: 1, duration: WING_FLICK_MS, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: WING_FLICK_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flutter, wing]);

  const flutterStyle = flutter
    ? { transform: [{ scaleY: wing.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }] }
    : null;

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Ellipse cx={11} cy={13.4} rx={5.8} ry={4.2} fill={theme.colors.ink} />
        {/* The band, painted through the abdomen along its own curve so the
            two ink caps still read as one body rather than two beads. */}
        <Path
          d="M6.1 12 A5.8 4.2 0 0 0 6.6 15.6 L15.4 15.6 A5.8 4.2 0 0 0 15.9 12 Z"
          fill={bandColor}
          fillOpacity={bandColor === fieldColor ? 1 : 0.9}
        />
        <Circle cx={17.4} cy={12.2} r={2.5} fill={theme.colors.ink} />
        <Circle cx={18.1} cy={11.5} r={0.55} fill={fieldColor} />
        <Path
          d="M18 10.1 C18.4 8.9 19.3 8.1 20.3 7.8"
          stroke={theme.colors.ink}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        <Path
          d="M18.8 10.8 C19.6 9.9 20.7 9.6 21.6 9.8"
          stroke={theme.colors.ink}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, flutterStyle, wingStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Ellipse
            cx={8.5}
            cy={8.6}
            rx={3.4}
            ry={2.1}
            fill={theme.colors.ink}
            fillOpacity={0.22}
            transform="rotate(-24 8.5 8.6)"
          />
          <Ellipse
            cx={13.2}
            cy={8.4}
            rx={3.4}
            ry={2.1}
            fill={theme.colors.ink}
            fillOpacity={0.22}
            transform="rotate(22 13.2 8.4)"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};
