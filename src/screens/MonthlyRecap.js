import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions
} from 'react-native';
import { theme } from '../constants/theme';
import { StaggeredItem } from '../components/StaggeredItem';
import { GradientCard } from '../components/GradientCard';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { StripeTexture } from '../components/StripeTexture';

const { width } = Dimensions.get('window');
const CELL_WIDTH = (width - 80) / 7;
const CELL_HEIGHT = CELL_WIDTH * 1.4;

// Loops a soft scale/opacity pulse behind the Wrapped teaser — the same
// "breathing" motif LockScreen uses to invite a tap, reused here so the one
// screen-to-screen CTA in the app shares a single motion signature.
const useBreathingGlow = () => {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }),
    transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
  };
};

export const MonthlyRecap = ({
  monthName,
  entries,
  daysInMonth = 31,
  insightTheme,
  insightDescription,
  onPreviewWrapped,
}) => {
  // entries = [{ date: '2026-07-01', text: '...', theme: 'Family' }, ...]
  const hasEntries = entries.length > 0;
  const glowStyle = useBreathingGlow();

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{monthName}</Text>

      {/* Theme Insight Card */}
      <GradientCard colors={theme.gradients.monthWash} style={styles.insightCardOuter} contentStyle={styles.insightCard}>
        <GradientIconBadge icon="sparkles" size={44} style={styles.insightBadge} />
        <Text style={styles.insightLabel}>PRIMARY THEME</Text>
        <Text style={styles.insightValue}>
          {hasEntries ? insightTheme : 'No entries yet'}
        </Text>
        <Text style={styles.insightDesc}>
          {hasEntries
            ? insightDescription
            : 'Complete your morning ritual to start building this month\'s theme.'}
        </Text>
      </GradientCard>

      {/* Gratitude Grid */}
      <View style={styles.grid}>
        {entries.map((entry, index) => (
          <StaggeredItem key={index} index={index} pop>
            <TouchableOpacity style={[styles.gridItem, styles.gridItemFilled]}>
              <Text style={[styles.dateText, styles.dateTextFilled]}>{entry.date.split('-')[2]}</Text>
            </TouchableOpacity>
          </StaggeredItem>
        ))}
        {/* Fill empty days for a full month grid */}
        {Array.from({ length: Math.max(0, daysInMonth - entries.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.gridItem}>
            <StripeTexture />
          </View>
        ))}
      </View>

      <View style={styles.teaserWrap}>
        <Animated.View style={[styles.teaserGlow, glowStyle]} />
        <TouchableOpacity style={styles.wrappedTeaser} onPress={onPreviewWrapped} activeOpacity={0.9}>
          <Text style={styles.teaserText}>Preview Your Annual Wrapped</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    marginBottom: 30,
    textAlign: 'center',
  },
  insightCardOuter: {
    width: '100%',
    marginBottom: 40,
    borderRadius: theme.borderRadius.large,
    ...theme.shadows.card,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
  },
  insightBadge: {
    marginBottom: 12,
  },
  insightLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  insightValue: {
    ...theme.type.h1,
    fontSize: 36,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  insightDesc: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
  },
  gridItem: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gridItemFilled: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accentDeep,
    ...theme.shadows.tinted(theme.colors.accent),
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyMedium,
  },
  dateTextFilled: {
    color: theme.colors.textInverse,
    fontFamily: theme.fonts.bodySemiBold,
  },
  teaserWrap: {
    width: '100%',
    marginTop: 20,
  },
  teaserGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: theme.borderRadius.large + 10,
    backgroundColor: theme.colors.accentDeep,
  },
  wrappedTeaser: {
    width: '100%',
    backgroundColor: theme.colors.accentDeep,
    padding: 20,
    borderRadius: theme.borderRadius.large,
    alignItems: 'center',
    ...theme.shadows.tinted(theme.colors.accentDeep),
  },
  teaserText: {
    ...theme.type.button,
    color: theme.colors.textInverse,
    fontSize: 16,
  },
});
