import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { theme } from '../constants/theme';
import { StaggeredItem } from '../components/StaggeredItem';

const { width } = Dimensions.get('window');

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

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{monthName}</Text>

      {/* Theme Insight Card */}
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>PRIMARY THEME</Text>
        <Text style={styles.insightValue}>
          {hasEntries ? insightTheme : 'No entries yet'}
        </Text>
        <Text style={styles.insightDesc}>
          {hasEntries
            ? insightDescription
            : 'Complete your morning ritual to start building this month\'s theme.'}
        </Text>
      </View>

      {/* Gratitude Grid */}
      <View style={styles.grid}>
        {entries.map((entry, index) => (
          <StaggeredItem key={index} index={index}>
            <TouchableOpacity style={[styles.gridItem, styles.gridItemFilled]}>
              <Text style={[styles.dateText, styles.dateTextFilled]}>{entry.date.split('-')[2]}</Text>
            </TouchableOpacity>
          </StaggeredItem>
        ))}
        {/* Fill empty days for a full month grid */}
        {Array.from({ length: Math.max(0, daysInMonth - entries.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.gridItem, styles.emptyItem]} />
        ))}
      </View>

      <TouchableOpacity style={styles.wrappedTeaser} onPress={onPreviewWrapped}>
        <Text style={styles.teaserText}>Preview Your Annual Wrapped</Text>
      </TouchableOpacity>
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
  insightCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    marginBottom: 40,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  insightLabel: {
    ...theme.type.label,
    color: theme.colors.accent,
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
    width: (width - 80) / 7,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemFilled: {
    backgroundColor: theme.colors.pop + '1F',
    borderColor: theme.colors.pop + '40',
  },
  emptyItem: {
    opacity: 0.3,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.bodyMedium,
  },
  dateTextFilled: {
    color: theme.colors.pop,
    fontFamily: theme.fonts.bodySemiBold,
  },
  wrappedTeaser: {
    width: '100%',
    backgroundColor: theme.colors.gold,
    padding: 20,
    borderRadius: theme.borderRadius.large,
    alignItems: 'center',
    marginTop: 20,
    ...theme.shadows.tinted(theme.colors.gold),
  },
  teaserText: {
    ...theme.type.button,
    color: theme.colors.textInverse,
    fontSize: 16,
  },
});
