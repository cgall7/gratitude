import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS, useReducedMotionState } from '../constants/motion';
import { Bee } from './Bee';

// §14.2 Beat 3 "What You Loved" — one physical card that 3D-flips from a
// gold back to reveal a theme word (Nunito ExtraBold) + one real entry
// snippet. This is the standalone primitive only: the Wrapped beat
// orchestrates three of these with its own stagger (spec: 500ms apart)
// through the `delay` prop, so the component carries no sequencing
// literals of its own.
//
// Built pre-replay on purpose (Pixel's merge-window call, 2026-08-11):
// this file is new and its only deps (theme, motion, Bee) are outside
// design-pass's 14-file diffstat. Wiring into GratitudeWrapped.js waits
// for the settled tree per §12.5's build-order gate.
const FLIP_PERSPECTIVE = 800;

export const ThemeCardFlip = ({ themeWord, snippet, delay = 0, onRevealed }) => {
  const flip = useRef(new Animated.Value(0)).current;
  const revealedRef = useRef(false);
  const { reduced, resolved } = useReducedMotionState();

  const settle = ({ finished } = {}) => {
    // R20: a cleanup-triggered stop invokes this with finished:false —
    // latching the ref on an interruption would fire onRevealed before
    // the card actually reveals and silence the run that does finish.
    // Check finished first, then guard against double-fire the same way
    // FlyingBee's onSettle does.
    if (!finished || revealedRef.current) return;
    revealedRef.current = true;
    onRevealed?.();
  };

  useEffect(() => {
    // R19: hold the first frame until the OS preference is actually
    // known — starting the spring on the assumed-`false` value is the
    // race R18 found. `resolved` flips exactly once per mount.
    if (!resolved) return;
    if (reduced) {
      // §14.2 reduced motion: same content, zero velocity — the front face
      // fades in flat, no rotation, and the beat continues immediately.
      Animated.timing(flip, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start(settle);
      return;
    }
    Animated.spring(flip, {
      toValue: 1,
      delay,
      ...SPRINGS.reveal,
      useNativeDriver: true,
    }).start(settle);
    // R18: a live OS toggle re-runs this effect mid-flip — the cleanup
    // must stop the in-flight spring or the flip keeps rotating
    // underneath the reduced branch's flat fade.
    return () => flip.stopAnimation();
  }, [reduced, resolved]);

  if (reduced) {
    return (
      <Animated.View style={[styles.card, styles.front, { opacity: flip }]}>
        <CardFace themeWord={themeWord} snippet={snippet} />
      </Animated.View>
    );
  }

  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View style={styles.stack}>
      <Animated.View
        style={[
          styles.card,
          styles.back,
          StyleSheet.absoluteFillObject,
          { transform: [{ perspective: FLIP_PERSPECTIVE }, { rotateY: backRotate }] },
        ]}
      >
        <Bee size={28} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          styles.front,
          { transform: [{ perspective: FLIP_PERSPECTIVE }, { rotateY: frontRotate }] },
        ]}
      >
        <CardFace themeWord={themeWord} snippet={snippet} />
      </Animated.View>
    </View>
  );
};

const CardFace = ({ themeWord, snippet }) => (
  <View style={styles.faceContent}>
    <Text style={styles.themeWord}>{themeWord}</Text>
    {snippet ? (
      <Text style={styles.snippet} numberOfLines={3}>
        “{snippet}”
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  stack: {
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: theme.borderRadius.medium,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backfaceVisibility: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
  },
  // Gold back: accent as decorative fill behind the ink bee — the §2 rule
  // (accent never carries text) holds because the back has no text at all.
  back: {
    backgroundColor: theme.colors.accent,
  },
  front: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  faceContent: {
    alignItems: 'center',
  },
  themeWord: {
    ...theme.type.h2,
    fontFamily: theme.fonts.headerExtraBold,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  snippet: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodyItalic,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
