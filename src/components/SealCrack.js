import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { SPRINGS, DURATIONS, useReducedMotion } from '../constants/motion';
import { BeeTransition } from './BeeTransition';
import { MascotBee } from './MascotBee';
import { CelebrationRays } from './CelebrationRays';

// ┌─ NOT WIRED YET, AND HERE IS HOW TO TELL THAT FROM ORPHANED ─────────┐
// │ Zero importers in `src/` + `App.js` (every other hit is prose in a  │
// │ comment). Early, not abandoned:                                     │
// │   consumer   Seeds, per R83 — this takes ONE prop (`onCracked`) and │
// │              has zero Wrapped coupling, so §14.2 gives it a HOME,   │
// │              not a dependency, and Seeds should be its first real   │
// │              consumer. §14.2 Beat 0 is the second.                  │
// │   owner      Pixel (this component) / Bumble (Seeds spine)          │
// │   FALSIFIER  if Seeds ships without a seal gesture AND §14.2's      │
// │              Wrapped build is closed or re-spec'd without Beat 0,   │
// │              this is dead — delete it, don't maintain it.           │
// └─────────────────────────────────────────────────────────────────────┘
//
// §14.2 Beat 0 — The Seal. Full gold field, spiral mark static, the bee
// glides in (BeeTransition already uses the ratified 9/60 glide spring) and
// lands on the mark. Tap cracks the seal — medium haptic + accentBurst
// flash — then hands off to Beat 1 via `onCracked`.
//
const MARK_W = 519;
const MARK_H = 614;
const DISPLAY_W = 160;
const DISPLAY_H = (DISPLAY_W * MARK_H) / MARK_W;

// R22 (Pixel): optical center of the spiral's eye, measured on
// assets/spiral-mark.png — the largest inscribed clearance is at source
// pixel (247, 263) of 519x614. Not 50%/50%: the tail hook and the three
// dots weight the composition lower-left, so the bounding-box center
// lands 3.9pt right / 13.6pt below the actual eye at DISPLAY_W=160.
const EYE_LEFT = '47.6%';
const EYE_TOP = '42.8%';

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

  useEffect(() => {
    // R21 (Pixel): a cleanup-only effect has no setup body, so Fast
    // Refresh — which preserves the ref across the edit — runs the
    // cleanup on the old instance and never restores `true` on the new
    // one. Not reachable in production (no StrictMode double-invoke in
    // this tree), but it bites mid-development on exactly this file.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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
    ]).start(() => {
      // R22 (Pixel): guarded on mountedRef only, deliberately not on
      // `finished` — R20's finished check existed because a latch made an
      // early fire permanent; nothing here latches, so refusing to fire on
      // finished:false would just dead-end Beat 0 on an interruption
      // instead of preventing one. Same reasoning as R20, opposite call.
      if (mountedRef.current) onCracked?.();
    });
  };

  return (
    <Pressable style={styles.fill} onPress={handleCrack}>
      {
        // R21 (Pixel): beeAnchor/raysStage used to center on the
        // Pressable itself, but the Pressable centers a group of *two*
        // in-flow children (mark + copy below) — so the mark's own center
        // sat 27pt above the group's center, and the bee/burst landed off
        // the spiral. Anchors for a mark-centered moment attach to the
        // mark, never to the screen: this wrapper is sized to the mark
        // only, so EYE_TOP/EYE_LEFT (R22) inside it lands exactly on the
        // spiral's optical center regardless of what copy sits below.
      }
      <View style={styles.markStage}>
        <BeeTransition triggerKey={beeKey} path={BEE_PATH} anchorStyle={styles.beeAnchor} size={22} />
        {landed && (
          // BEE_PATH's terminal translate is (0,0) at 0deg — exactly
          // styles.beeAnchor with no transform, so the crossfade lands in
          // the same spot BeeTransition's flight was already ending at.
          //
          // §17.3 correction: this bee is not a standing/keepsake bee — it
          // is the last frame of a BeeTransition flight, crossfading from the
          // bee that BeeTransition renders internally. Register follows
          // provenance: a bee that flew in stays in flight register even
          // standing on gold, so this must stay prop-identical to
          // BeeTransition's internal render or the crossfade pops.
          //
          // R83: that render is now `MascotBee`, so this is too. The contract
          // this comment states is exactly what a swap on one side of it would
          // have broken — dormantly, since SealCrack has no importers yet.
          <Animated.View pointerEvents="none" style={[styles.beeAnchor, { opacity: staticBeeOpacity }]}>
            <MascotBee size={22} />
          </Animated.View>
        )}
        <Image
          source={require('../../assets/spiral-mark.png')}
          style={{ width: DISPLAY_W, height: DISPLAY_H }}
          resizeMode="contain"
        />
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
      </View>
      <Text style={styles.copy}>Your year, poured.</Text>
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // §13.1's locked adaptive-icon gold — the same field SplashSpiral opens
  // the app on, deliberately not theme.colors.accent (a brighter, different
  // yellow). Was a local literal because SplashSpiral sits on an unmerged
  // branch; §17.5 promoted it to `goldField` instead, so Beat 0 and Beat 6
  // now read the same token rather than two copies of the same string.
  fill: {
    flex: 1,
    backgroundColor: theme.colors.goldField,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markStage: {
    position: 'relative',
    width: DISPLAY_W,
    height: DISPLAY_H,
  },
  beeAnchor: {
    position: 'absolute',
    top: EYE_TOP,
    left: EYE_LEFT,
    marginTop: -11,
    marginLeft: -11,
    // R22 (Pixel): the landed static bee is an earlier sibling than
    // <Image> with no zIndex of its own — RN paints in tree order
    // regardless of position:absolute. It was invisible only because its
    // footprint fell entirely inside the mark's transparent eye; matches
    // BeeTransition's own `wrap` zIndex so the handoff doesn't depend on
    // the asset's alpha, which matters more now the anchor has moved.
    zIndex: 10,
  },
  raysStage: {
    position: 'absolute',
    top: EYE_TOP,
    left: EYE_LEFT,
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
