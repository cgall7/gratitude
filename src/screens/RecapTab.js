import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { MonthlyRecap } from './MonthlyRecap';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  monthName,
  currentStreak,
  longestStreak,
} from '../utils/dateRanges';
import { DevVersionTag } from '../components/DevVersionTag';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakBadge } from '../components/StreakBadge';
import { StaggeredItem } from '../components/StaggeredItem';

const describeTheme = (insight, periodLabel) => {
  if (!insight) return '';
  const { theme: themeName, count, total } = insight;
  return `You leaned into "${themeName}" ${count} of ${total} ${periodLabel}.`;
};

// The three numbers worth chasing, up top where they're the first thing you
// see — Recap used to open on a theme card with no score of any kind.
const StatsCard = ({ streak, best, total }) => (
  <View style={styles.statsCard}>
    {[
      { value: streak, label: 'CURRENT' },
      { value: best, label: 'BEST EVER' },
      { value: total, label: 'THIS YEAR' },
    ].map((stat, index) => (
      <React.Fragment key={stat.label}>
        {index > 0 && <View style={styles.statSeparator} />}
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      </React.Fragment>
    ))}
  </View>
);

// --- COMPONENT: WeeklyThemeCard ---
const WeeklyThemeCard = ({ weekInsight }) => (
  <View style={styles.weekCard}>
    <Text style={styles.weekLabel}>THIS WEEK'S THEME</Text>
    <Text style={styles.weekValue}>{weekInsight ? weekInsight.theme : 'No entries yet'}</Text>
    <Text style={styles.weekDesc}>
      {weekInsight
        ? describeTheme(weekInsight, 'days this week')
        : 'Write an entry this week to see your theme.'}
    </Text>
  </View>
);

export const RecapTab = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [weekEntries, setWeekEntries] = useState([]);
  const [monthEntries, setMonthEntries] = useState([]);
  const [monthLabel, setMonthLabel] = useState('');
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [yearEntries, setYearEntries] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = new Date();
        const [week, month, year] = await Promise.all([
          EntryStore.getEntriesBetween(startOfWeek(now), endOfWeek(now)),
          EntryStore.getEntriesBetween(startOfMonth(now), endOfMonth(now)),
          EntryStore.getEntriesBetween(startOfYear(now), endOfYear(now)),
        ]);
        if (cancelled) return;
        setWeekEntries(week);
        setMonthEntries(month);
        setYearEntries(year);
        setMonthLabel(monthName(now));
        setDaysInMonth(endOfMonth(now).getDate());
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  const weekInsight = dominantTheme(weekEntries);
  const monthInsight = dominantTheme(monthEntries);
  const streak = currentStreak(yearEntries);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader
        eyebrow="YOUR PROGRESS"
        title="Recap"
        right={<StreakBadge streak={streak} />}
      />

      <StaggeredItem index={0}>
        <StatsCard streak={streak} best={longestStreak(yearEntries)} total={yearEntries.length} />
      </StaggeredItem>

      <StaggeredItem index={1}>
        <WeeklyThemeCard weekInsight={weekInsight} />
      </StaggeredItem>

      <MonthlyRecap
        monthName={monthLabel}
        entries={monthEntries}
        daysInMonth={daysInMonth}
        insightTheme={monthInsight ? monthInsight.theme : null}
        insightDescription={monthInsight ? describeTheme(monthInsight, 'days this month') : null}
        onPreviewWrapped={() => navigation.navigate('Wrapped')}
      />

      <DevVersionTag />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 140,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 22,
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statSeparator: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceBorderStrong,
    marginVertical: 4,
  },
  statValue: {
    ...theme.type.h1,
    fontSize: 34,
    color: theme.colors.accentDeep,
  },
  statLabel: {
    ...theme.type.label,
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  weekLabel: {
    ...theme.type.label,
    color: theme.colors.accentDeep,
    marginBottom: 8,
  },
  weekValue: {
    ...theme.type.h1,
    fontSize: 30,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  weekDesc: {
    ...theme.type.body,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
