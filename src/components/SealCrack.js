import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS, useReducedMotion } from '../constants/motion';
import { BeeTransition } from './BeeTransition';
import { Bee } from './Bee';
import { CelebrationRays } from './CelebrationRays';

// §14.2 Beat 0 — The Seal. Full gold field, spiral mark static, the bee
// glides in (BeeTransition already uses the ratified 9/60 glide spring) and
// lands on the mark. Tap cracks the seal — medium haptic + accentBurst
// flash — then hands off to Beat 1 via `onCracked`.
//
// §13.1's locked adaptive-icon gold (`#F0C023`) — the same field
// SplashSpiral opens the app on, deliberately not theme.colors.accent (a
// brighter, different yellow). Duplicated as a local constant rather than
// imported: SplashSpiral lives on the still-unmerged splash-login-bee-arc
// branch, and this is a fixed design value, not shared logic.
const SEAL_GOLD = '#F0C023';

const MARK_W = 519;
const MARK_H = 614;
const DISPLAY_W = 160;
const DISPLAY_H = (DISPLAY_W * MARK_H) / MARK_W;

// Starts off to the upper-left and arcs down onto the mark's center
// (anchor sits at the mark's position, so the path's end value is 0,0).
const BEE_PATH = {
  translateX: [-130, 0],
  translateY: [-60, -90, 0],
  rotate: ['-6deg', '0deg'],
};

export const SealCrack = ({ onCracked }) => {
  const reduced = useReducedMotion();
  const [beeKey, setBeeKey] = useState(0);
  const [cracked, setCracked] = useState(false);
  const [landed, setLanded] = useState(false);
  const flash = useRef(new Animated.Value(0)).current;
  const staticBeeOpacity = useRef(new Animated.Value(0)).current;
  // R16: the seal's tap is user-paced and unbounded, so the bee must rest
  // on the mark rather than vanish on arrival (BeeTransition unmounts at
  // flight-end everywhere else, correctly — that rule isn't touched here).
  // BeeTransition can't take an onSettle callback without changing a
  // component every other flight in the app shares, so instead this runs a
  // shadow spring with the identical SPRINGS.glide config, started on the
  // same triggerKey change — its completion lands within a frame of
  // BeeTransition's own, close enough for a static-bee handoff with no
  // visible jump.
  const settleShadow = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    // Let the field render a beat before the bee flies in, so the landing
    // reads as an arrival rather than something already mid-flight at mount.
    const t = setTimeout(() => setBeeKey(1), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (beeKey === 0) return;
    settleShadow.setValue(0);
    Animated.spring(settleShadow, { toValue: 1, ...SPRINGS.glide, useNativeDriver: true }).start(() => {
      setLanded(true);
      Animated.timing(staticBeeOpacity, { toValue: 1, duration: DURATIONS.quick, useNativeDriver: true }).start();
    });
  }, [beeKey]);

  const handleCrack = () => {
    if (cracked) return;
    setCracked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // R17 (Pixel): the full-viewport accentBurst flash is the largest
    // luminance jump in the app — §14.1 "no exceptions" means reduced
    // motion skips it outright rather than just shortening it.
    // CelebrationRays' own reduced-motion glow (below) still carries the
    // moment.
    if (reduced) {
      // R20 (Pixel): onCracked was firing synchronously, unmounting Beat 0
      // in the same tick CelebrationRays' SoftGlow substitute mounted — the
      // glow got ~0 of its 200ms. Hold for that duration so the substitute
      // is actually seen before the handoff, same length it renders for.
      setTimeout(() => {
        if (mountedRef.current) onCracked?.();
      }, DURATIONS.reducedMotionFade);
      return;
    }
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: DURATIONS.instant, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: DURATIONS.quick, useNativeDriver: true }),
    ]).start(() => onCracked?.());
  };

  return (
    <Pressable style={styles.fill} onPress={handleCrack}>
      <BeeTransition triggerKey={beeKey} path={BEE_PATH} anchorStyle={styles.beeAnchor} size={22} />
      {landed && (
        // BEE_PATH's terminal translate is (0,0) at 0deg — exactly
        // styles.beeAnchor with no transform, so the crossfade lands in the
        // same spot BeeTransition's flight was already ending at.
        <Animated.View pointerEvents="none" style={[styles.beeAnchor, { opacity: staticBeeOpacity }]}>
          <Bee size={22} />
        </Animated.View>
      )}
      <Image
        source={require('../../assets/spiral-mark.png')}
        style={{ width: DISPLAY_W, height: DISPLAY_H }}
        resizeMode="contain"
      />
      <Text style={styles.copy}>Your year, poured.</Text>
      {cracked && (
        // R17 (Pixel): CelebrationRays anchors to the center of a 96x96
        // box (its own doc comment says so) — bare, it was reading the
        // Pressable's top-left instead of the mark. Same wrapper
        // convention Onboarding's CelebrationStep already uses, centered
        // here on the mark rather than a static layout position.
        <View pointerEvents="none" style={styles.raysStage}>
          <CelebrationRays />
        </View>
      )}
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: SEAL_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beeAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -11,
    marginLeft: -11,
  },
  raysStage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -48,
    marginLeft: -48,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    ...theme.type.h2,
    color: theme.colors.ink,
    marginTop: 24,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.accentBurst,
  },
});
