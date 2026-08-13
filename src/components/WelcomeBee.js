import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../constants/motion';

// The hero mascot — §19.5, the character Colin ratified on 2026-08-12.
//
// This is the ratified 3D render, not a drawing of it. The bee that used to
// live here was `StripedBee`'s geometry a second time (21 attributes, zero
// differences) at `size * 0.68`, which put 42.5pt of ink on a 132pt stage:
// the app's first screen opened on a mark you had to look for.
//
// **Why a raster here and nowhere else yet.** §19.5 Amendment 1 drew the tier
// line at "is the field known and constant," reasoning from `fieldColor`'s
// knockout. That was the wrong line and it named the wrong sites (R70). The
// line that survives measurement is **held vs flying**:
//
//   - A raster has no parts. The wings do not separate from this render —
//     alpha is 89% opaque with a smooth edge ramp and no second population,
//     and every saturation band spans the whole subject box. So any motion
//     *inside* the character is gone the moment it becomes a PNG.
//   - `flutter` is exactly that motion, and every flight site wants it.
//
// This site is the one that can pay: the hero is held, looked at, and alone
// on its screen — no `FlyingBee` or `BeeTransition` renders on `CoreRitual`,
// so swapping it cannot put two different bees in front of one person. The
// seven flight renders stay `StripedBee` until Deezine's flat redraw lands,
// and then they all move at once, because they are two components.
//
// **Named cost:** the double wing-flick is gone. The held pose keeps its bob
// and its ±3° rotation, which are the caller-side rhythms a flat image can
// still carry; a 3D render standing still reads alive in a way the ink glyph
// did not, which is why the flick existed. If it's missed, the replacement is
// caller-side too (a slower hover drift), not a second bee.
//
// It draws no glow of its own. `GlowOrb` is the ratified light primitive and
// `CoreRitual` already puts one behind this bee — a second light source
// inside the first is two suns for one subject, and the smaller one loses.
export const WelcomeBee = ({ size = 148 }) => {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return undefined;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    return () => bobLoop.stop();
  }, [reduced, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        {/* The asset is trimmed to the subject, so `contain` fits the drawing
            to the stage rather than to whitespace inside it. */}
        <Image
          source={require('../../assets/mascot-bee.png')}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
