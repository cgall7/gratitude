import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { HONEY, HONEY_EASING, DURATIONS, useReducedMotion } from '../../constants/motion';
import { drip } from '../../constants/haptics';
import { PrimaryButton } from '../../components/PrimaryButton';

// Luxury pass, Lane B — a demo rig for the three primitives Lumen asked
// for (HONEY, shadows.glow(), haptics.js), deliberately NOT wired into any
// navigator or screen. Nobody routes here; open it by swapping it in as
// App.js's root for a device pass, the same way every prior device-gate
// screenshot in this repo has been taken, then revert the swap.
//
// This is the INSTRUMENT, not the SCORE. The geometry below (bead scale,
// neck squeeze, fall distance) is a placeholder good enough to feel each
// phase's timing and easing — Deezine's hex-tap storyboard supplies the
// real shape once it lands, and this rig gets rebuilt against it then, not
// guessed at now (Lumen: "don't guess the choreography, you'll build it
// twice").
//
// Repointed onto Lumen's landed `shadows.glow(color, level='bloom')` —
// zero offset always, throws on an unknown level. The bead sits at 'bloom'
// (responding to you); 'peak' is reserved for the one frame something is
// fully alight, which this instrument never claims to be.
//
// Glow colour is `accentDeep`, not the bead's own `accentBurst` fill —
// Lumen measured it: on this app's one cream ground (#FFF7CC) you cannot
// make the page brighter by throwing more of its own hottest yellow at it
// (near-zero luminance headroom, chroma only), so the glow that's meant to
// radiate ONTO the page has to be the deep stop to read at all. The lit
// crown stays `accentBurst` on the material itself — that's catching
// light, not throwing it.
export const LuxuryPrimitivesHarness = () => {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState('rest');
  const scale = useRef(new Animated.Value(1)).current;
  const squeeze = useRef(new Animated.Value(1)).current;
  const fallY = useRef(new Animated.Value(0)).current;
  const poolOpacity = useRef(new Animated.Value(1)).current;
  const poolSpread = useRef(new Animated.Value(1)).current;

  const reset = () => {
    scale.setValue(1);
    squeeze.setValue(1);
    fallY.setValue(0);
    poolOpacity.setValue(1);
    poolSpread.setValue(1);
  };

  const runDrip = () => {
    reset();
    setPhase('swell');
    drip.swell();

    if (reduced) {
      Animated.timing(scale, {
        toValue: 1.15,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start(() => setPhase('rest'));
      return;
    }

    Animated.timing(scale, {
      toValue: 1.25,
      duration: HONEY.swell,
      easing: HONEY_EASING.swell,
      useNativeDriver: true,
    }).start(() => {
      setPhase('neck');
      Animated.timing(squeeze, {
        toValue: 0.4,
        duration: HONEY.neck,
        easing: Easing.inOut(Easing.quad), // unscored — see HONEY_EASING.neck note
        useNativeDriver: true,
      }).start(() => {
        setPhase('pinch');
        drip.pinch();
        setPhase('fall');
        Animated.parallel([
          Animated.timing(fallY, {
            toValue: 180,
            duration: HONEY.fall,
            easing: HONEY_EASING.fall,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.6,
            duration: HONEY.fall,
            easing: HONEY_EASING.fall,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setPhase('pool');
          Animated.parallel([
            Animated.timing(poolSpread, {
              toValue: 2.2,
              duration: HONEY.pool,
              easing: HONEY_EASING.pool,
              useNativeDriver: true,
            }),
            Animated.timing(poolOpacity, {
              toValue: 0,
              duration: HONEY.pool,
              easing: HONEY_EASING.pool,
              useNativeDriver: true,
            }),
          ]).start(() => setPhase('rest'));
        });
      });
    });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Luxury primitives — instrument, not score</Text>
      <Text style={styles.phase}>phase: {phase}{reduced ? ' (reduced motion)' : ''}</Text>

      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bead,
            theme.shadows.glow(theme.colors.accentDeep, 'bloom'),
            {
              transform: [
                { translateY: fallY },
                { scale },
                { scaleX: squeeze },
              ],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pool,
            {
              opacity: poolOpacity,
              transform: [{ scale: poolSpread }],
            },
          ]}
        />
      </View>

      <PrimaryButton onPress={runDrip}>Trigger drip</PrimaryButton>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  heading: {
    ...theme.type.h3,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  phase: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  stage: {
    width: 220,
    height: 260,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  bead: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accentBurst,
  },
  pool: {
    position: 'absolute',
    bottom: 20,
    width: 48,
    height: 16,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accentBurst,
  },
});
