import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

// One header treatment for every tab. Before this, Today used a 12pt
// uppercase caption pinned at `top: 70`, Honeycomb used an h1, and Recap had
// no header at all — three screens, three answers to the same question.
//
// Eyebrow (small caps) sits above an h1 title, with an optional right slot
// for a live stat like the streak badge.
export const ScreenHeader = ({ eyebrow, title, right, style }) => (
  <View style={[styles.row, style]}>
    <View style={styles.titles}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
    {right ? <View style={styles.right}>{right}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  titles: {
    flexShrink: 1,
  },
  eyebrow: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 6,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
  },
  right: {
    marginLeft: 16,
  },
});
