import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../constants/theme';

// Reduce Transparency is non-negotiable (spec §10): when it's on, glass
// falls back to a solid surface instead of blurring.
export const useReduceTransparency = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(setEnabled).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setEnabled);
    return () => sub?.remove?.();
  }, []);

  return enabled;
};

// The glass look, in its own clipped layer: blur + cream veil + one 1pt
// specular rim on iOS, an opacity wash on Android, a solid surface under
// Reduce Transparency. Lives apart from whatever casts the shadow on
// purpose — `overflow: hidden` on the same view as the rounded corners
// clips that view's own shadow, so the rounding+clipping has to be a child.
//
// Split out of MainTabs when the bar became a capsule with a detached
// account door beside it (Option C): two separately-shadowed surfaces that
// have to read as the same material.
export const GlassBackground = ({ radius }) => {
  const reduceTransparency = useReduceTransparency();
  const clip = { borderRadius: radius, overflow: 'hidden' };

  if (reduceTransparency) {
    return <View style={[StyleSheet.absoluteFill, clip, styles.solidFallback]} />;
  }

  if (Platform.OS === 'android') {
    // Sanctioned Android fallback (spec §10): no BlurView, just a lighter
    // opacity wash — cheaper and avoids readability issues on Android's blur.
    return <View style={[StyleSheet.absoluteFill, clip, styles.androidFallback]} />;
  }

  return (
    <BlurView intensity={60} tint="systemUltraThinMaterialLight" style={[StyleSheet.absoluteFill, clip]}>
      <View style={[StyleSheet.absoluteFill, styles.creamVeil]} />
      {/* ONE 1pt specular edge — the detail that reads as glass, not chrome.
          This used to spread `StyleSheet.absoluteFillObject`, which does not
          exist in react-native 0.86.2 (StyleSheetExports.js exports
          `absoluteFill` only). Spreading `undefined` is legal and silent, so
          the rim lost its positioning and painted as a 2pt stub at the top
          of the bar instead of tracing its edge. */}
      <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }]} pointerEvents="none" />
    </BlurView>
  );
};

const styles = StyleSheet.create({
  // Reduce Transparency fallback — the old solid look, no blur.
  solidFallback: {
    backgroundColor: theme.colors.surface,
  },
  androidFallback: {
    backgroundColor: theme.colors.glassVeil,
  },
  // Blur alone reads cold iOS-grey; this keeps the surface inside the
  // Sunbeam palette regardless of what's scrolling underneath.
  creamVeil: {
    backgroundColor: theme.colors.glassSheer,
  },
  rim: {
    borderWidth: 1,
    borderColor: theme.colors.glassRim,
  },
});
