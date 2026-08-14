import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MascotBee } from './MascotBee';
import { useReducedMotion } from '../constants/motion';

// The hero pose: the mascot held still, at the largest size it is drawn
// anywhere in the app (132pt, `CoreRitual.js:55` — the write gate).
//
// R83: this file used to draw its own bee. Not `StripedBee` — *a copy of it*,
// 21 geometry attributes reproduced inline, which the 2026-08-13 bee audit
// found identical to the original down to the last decimal. That copy is why
// both reviewers of the flight PR, grepping for `StripedBee`, reported one
// remaining non-mascot bee when there were two: **a duplicated drawing does
// not carry the name of the thing it duplicates.** The biggest bee in the app
// was invisible to a search for the component it was a copy of. So the rule
// this file now sits under is enforced on rendered `<*Bee>` elements rather
// than on one identifier — see section E of `scripts/check-bee-attitude.mjs`,
// which is the row that caught it.
//
// What this component still owns is the *rhythm*, and that is the reason it
// exists rather than being replaced by a bare `<MascotBee>`:
//
//   - the **bob**, 1600ms each way on `inOut(sin)` with a ±3° roll
//   - the **double-flick**, two fast beats then a 620ms rest
//
// Both are §17.3 rulings about a held pose. A pose that twitches reads alive;
// one that buzzes continuously reads like a loading spinner, and at 132pt that
// difference is the whole hero moment. `MascotBee`'s built-in `flutter` is the
// continuous loop for a bee in transit, so this drives the wing itself through
// the `beat` prop — the component owns where the hinge is and how far the wing
// swings, the caller owns when.
//
// It draws no glow of its own. GlowOrb is the ratified light primitive and the
// screens that host this bee already put one behind it — a second radial disc
// inside that light is two light sources for one subject, and the smaller one
// always loses. The bee is just the bee.
export const WelcomeBee = ({ size = 148 }) => {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const wing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return undefined;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const wingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wing, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(wing, { toValue: 0, duration: 620, useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    wingLoop.start();
    return () => {
      bobLoop.stop();
      wingLoop.stop();
    };
  }, [reduced, bob, wing]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  // 0.68 of the stage, unchanged: the old drawing sat in a box that fraction
  // of `size`, and `MascotBee` draws the character at the same fraction of
  // whatever box it is given, so the hero's footprint on the gate is the one
  // that was laid out against GlowOrb and the wordmark below it.
  const bodySize = size * 0.68;

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <MascotBee size={bodySize} beat={reduced ? undefined : wing} />
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
