import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { PressableScale } from './PressableScale';
import { StaggeredItem } from './StaggeredItem';
import { SparkChips } from './SparkChips';
import { IDEA_CATEGORIES } from '../constants/ideasAccordion';

// Gratitude ideas, curated (Sunbeam §6): five browsable category cards,
// only one open at a time (R1 refinement). Expanding a card reveals its
// sparks as the existing SparkChips row, feeding straight into the entry.
export const IdeasAccordion = ({ onPick }) => {
  const [openId, setOpenId] = useState(null);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Need a nudge?</Text>
      {IDEA_CATEGORIES.map((category, index) => {
        const open = category.id === openId;
        return (
          <StaggeredItem key={category.id} index={index}>
            <View style={styles.card}>
              <PressableScale
                style={styles.cardHeader}
                onPress={() => setOpenId(open ? null : category.id)}
                haptic={Haptics.ImpactFeedbackStyle.Light}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={category.icon} size={22} color={theme.colors.ink} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{category.title}</Text>
                  <Text style={styles.cardTeaser} numberOfLines={2}>{category.teaser}</Text>
                </View>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.inkSoft}
                />
              </PressableScale>
              {open && (
                <View style={styles.cardBody}>
                  <SparkChips sparks={category.sparks} visible onPick={onPick} label={null} />
                </View>
              )}
            </View>
          </StaggeredItem>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.medium,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.washYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  cardTeaser: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
