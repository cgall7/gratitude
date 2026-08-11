import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { Bee } from './Bee';

// §14.4 Beat 6 "The Year Card" — the static shareable keepsake the burst
// resolves into. Deliberately motionless: "motion sells the ceremony;
// stillness sells the share." This is the layout primitive only — the
// share-sheet capture and the wiring into GratitudeWrapped.js come with
// the beat build after the design-pass replay (§12.5 build-order gate).
//
// Golden Honey is the icon's gold (§14.4: the ceremony opens and closes
// on the same field), NOT theme.colors.accent. Beat 0's Seal (Fizz's
// spine) needs the identical value — promote this to a theme.colors token
// in the wiring pass so it lands once, not from two pre-replay branches.
const GOLD_FIELD = '#F0C023';

// Crop-safe zone (§14.4): the card renders at 4:5 portrait. A 1:1 feed
// crop keeps full width × the center 4/5 of the height; a 9:16 story crop
// keeps the center ~70% of the width × full height. The numeral + theme
// word block stays inside the intersection (center 70% wide, vertically
// centered); the spiral mark and bee sit outside the tighter crops by
// design. Pixel gates the final geometry on-device against both crops
// before Beat 6 ships — this layout is the candidate, not the sign-off.
const CARD_ASPECT = 4 / 5;
const SAFE_ZONE_WIDTH = '70%';

export const YearCard = ({
  totalEntries,
  themeWord,
  // Miniaturized completed tapestry, passed in as an element once Beats
  // 4–5 exist — R15 settled the unit as hex month-grids, but the frame
  // stays agnostic and just renders whatever it's handed.
  watermark = null,
  width = 320,
}) => (
  <View style={[styles.card, { width, height: width / CARD_ASPECT }]}>
    {watermark ? (
      <View pointerEvents="none" style={styles.watermark}>
        {watermark}
      </View>
    ) : null}

    <View style={styles.header}>
      <Image
        source={require('../../assets/spiral-mark.png')}
        style={styles.mark}
        resizeMode="contain"
      />
      <View style={styles.bee}>
        <Bee size={22} />
      </View>
    </View>

    <View style={styles.safeZone}>
      <Text style={styles.numeral}>{String(totalEntries)}</Text>
      <Text style={styles.themeWord}>{themeWord}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: GOLD_FIELD,
    borderRadius: theme.borderRadius.medium,
    overflow: 'hidden',
    alignItems: 'center',
  },
  // Low-opacity ink texture behind the numeral — echoes the finale's
  // content without competing with it (§14.4). Opacity lives here, not on
  // the passed element, so the frame controls how quiet the echo is.
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.08,
  },
  header: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  mark: {
    width: 44,
    height: 44,
  },
  // Resting/proud pose next to the mark, not mid-flight — the motion is
  // over, this frame is the keepsake.
  bee: {
    position: 'absolute',
    top: 4,
    right: -30,
    transform: [{ rotate: '-12deg' }],
  },
  safeZone: {
    flex: 1,
    width: SAFE_ZONE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // R15: ink only on the gold field — accentDeep is a warm-amber-on-cream
  // rule and lands at 1.53:1 here; ink is 10.01:1. Not a prop, so the
  // keepsake frame can't be built unreadable.
  numeral: {
    ...theme.type.hero,
    color: theme.colors.ink,
  },
  themeWord: {
    ...theme.type.h2,
    fontFamily: theme.fonts.headerExtraBold,
    color: theme.colors.ink,
    marginTop: theme.spacing.xs,
  },
});
