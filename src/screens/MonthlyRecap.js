import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { theme } from '../constants/theme';

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
          <TouchableOpacity key={index} style={styles.gridItem}>
            <Text style={styles.dateText}>{entry.date.split('-')[2]}</Text>
            <View style={styles.dot} />
          </TouchableOpacity>
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
    fontFamily: theme.fonts.header,
    fontSize: 32,
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
    padding: 24,
    marginBottom: 40,
    alignItems: 'center',
  },
  insightLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.accent,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  insightValue: {
    fontFamily: theme.fonts.header,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  insightDesc: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
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
  emptyItem: {
    opacity: 0.3,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.pop,
    marginTop: 2,
  },
  wrappedTeaser: {
    width: '100%',
    backgroundColor: theme.colors.gold,
    padding: 20,
    borderRadius: theme.borderRadius.large,
    alignItems: 'center',
    marginTop: 20,
  },
  teaserText: {
    fontFamily: theme.fonts.header,
    color: theme.colors.textInverse,
    fontSize: 16,
    textTransform: 'uppercase',
  },
});
