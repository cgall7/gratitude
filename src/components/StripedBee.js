import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Path } from 'react-native-svg';
import { theme } from '../constants/theme';

// §17.3 — the one bee. Ratified app-wide: the unstriped `Bee` glyph retires
// and every bee in the app is this one, because the "quick black bee" Colin
// disliked turned out to be nearly all of them, including the one standing
// on the keepsake card.
//
// **Stripes are knockouts, not paint.** The mascot's band used to be `accent`
// `#FFD200`, which disappears on the gold keepsake field — the two are
// 1.179:1 apart. Here the band and the eye are cut out to `fieldColor`, so
// the bee is one ink silhouette with whatever it stands on showing through,
// and a single asset reads on cream AND on gold. Pass the colour the bee is
// actually sitting on; the default is the app background.
//
// **Wings are their own sibling `<Svg>`** under `wingStyle`, so a caller can
// drive the wing flick while something else drives the body — that is the
// hinge the flight engine and the mascot's own flutter both need, and it is
// why this is one component with two layers rather than one flat drawing.
//
// **No bob.** Every rhythm this bee has belongs to its caller. Two bobs
// composed on one bee is the failure mode §17.3 called out by name.
//
// Scope note: this is deliberately NOT yet wired into `WelcomeBee`, whose
// drawn body it is extracted from. Collapsing the two is part of the flight
// swap on Pixel's flows branch — `CoreRitual` is open there, and changing
// the hero mascot's stripe from paint to knockout underneath that branch is
// how one ruling becomes two conflicting bees. The duplication is one branch
// long and on purpose. `Bee.js` deletes only once the last site is gone.
export const StripedBee = ({ size = 44, fieldColor = theme.colors.background, wingStyle }) => (
  <Animated.View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse cx={11} cy={13.4} rx={5.8} ry={4.2} fill={theme.colors.ink} />
      {/* The band, cut through the abdomen along its own curve so the two
          ink caps still read as one body rather than two beads. */}
      <Path
        d="M6.1 12 A5.8 4.2 0 0 0 6.6 15.6 L15.4 15.6 A5.8 4.2 0 0 0 15.9 12 Z"
        fill={fieldColor}
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
    <Animated.View style={[StyleSheet.absoluteFillObject, wingStyle]}>
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
