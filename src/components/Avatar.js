import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

// No avatar upload yet (tracked separately) — every hive member gets an
// initials circle instead, tinted from a small warm rotation so the hive
// reads as varied people rather than one repeated color. Real avatar_url
// wins the moment a profile has one.
const AVATAR_WASHES = [
  theme.colors.washYellow,
  theme.colors.washPeach,
  theme.colors.washSky,
  theme.colors.accent,
  theme.colors.accentDeep,
];

const hashName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 2147483647;
  }
  return hash;
};

const initialsFor = (name) => {
  const trimmed = (name || '?').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + second).toUpperCase();
};

export const avatarColorFor = (name) => AVATAR_WASHES[hashName(name || '') % AVATAR_WASHES.length];

// The comb's own rotation (§18.1.2/R55, restated R59). A hive cell is an
// 88pt surface, not a sub-40pt swatch, so it can't use AVATAR_WASHES: that
// rotation contains `accent` and `accentDeep`, and at 88pt those read as
// emphasis/selection (§11), not identity — a member who happens to hash to
// marigold would look selected when nobody selected them. (R59 retired the
// cap's other reason, "gold is reserved for the shared-today cell" — that
// state doesn't exist in the comb — so this is the one the cap has always
// actually rested on.) `washPeach` is out by its own token text ("no new
// uses at any size"). These two are the only tokens whose own comments
// permit a hive surface.
//
// Same `hashName`, so a name always yields the same circle/hex pair. That is
// DETERMINISM, not correlation — mod 5 and mod 2 of one hash have no visible
// relationship (Sam's circle is `accentDeep`, his hex `washSky`; Maya's are
// `washSky` and `washYellow`). Determinism is the property worth having; the
// word "correlated" promises a color match that was never there.
//
// Two tints and nothing distributing them: see the monochrome invariant in
// demoHive.js before adding names to the demo set.
const HEX_TINTS = [theme.colors.washYellow, theme.colors.washSky];

export const hexTintFor = (name) => HEX_TINTS[hashName(name || '') % HEX_TINTS.length];

export const Avatar = ({ name, avatarUrl, size = 48 }) => {
  const dimStyle = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, dimStyle]} />;
  }

  const backgroundColor = avatarColorFor(name);
  return (
    <View style={[styles.circle, dimStyle, { backgroundColor }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsFor(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.glassRim,
  },
  image: {
    backgroundColor: theme.colors.surfaceBorder,
  },
  initials: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
});
