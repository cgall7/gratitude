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
    borderColor: 'rgba(255,255,255,0.6)',
  },
  image: {
    backgroundColor: theme.colors.surfaceBorder,
  },
  initials: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
});
