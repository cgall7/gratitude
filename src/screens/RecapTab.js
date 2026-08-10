import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { MonthlyRecap } from './MonthlyRecap';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, monthName } from '../utils/dateRanges';
import { DevVersionTag } from '../components/DevVersionTag';
import { GradientCard } from '../components/GradientCard';
import { GradientIconBadge } from '../components/GradientIconBadge';

const describeTheme = (insight, periodLabel) => {
  if (!insight) return '';
  const { theme: themeName, count, total } = insight;
  return `You leaned into "${themeName}" ${count} of ${total} ${periodLabel}.`;
};

// --- COMPONENT: WeeklyThemeCard ---
const WeeklyThemeCard = ({ weekInsight }) => {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, []);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
      <GradientCard colors={theme.gradients.weekWash} style={styles.weekCardOuter} contentStyle={styles.weekCard}>
        <GradientIconBadge icon="flame" size={44} style={styles.weekBadge} />
        <Text style={styles.weekLabel}>THIS WEEK'S THEME</Text>
        <Text style={styles.weekValue}>{weekInsight ? weekInsight.theme : 'No entries yet'}</Text>
        <Text style={styles.weekDesc}>
          {weekInsight
            ? describeTheme(weekInsight, 'days this week')
            : 'Complete a ritual this week to see your theme.'}
        </Text>
      </GradientCard>
    </Animated.View>
  );
};

export const RecapTab = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [weekEntries, setWeekEntries] = useState([]);
  const [monthEntries, setMonthEntries] = useState([]);
  const [monthLabel, setMonthLabel] = useState('');
  const [daysInMonth, setDaysInMonth] = useState(31);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = new Date();
        const [week, month] = await Promise.all([
          EntryStore.getEntriesBetween(startOfWeek(now), endOfWeek(now)),
          EntryStore.getEntriesBetween(startOfMonth(now), endOfMonth(now)),
        ]);
        if (cancelled) return;
        setWeekEntries(week);
        setMonthEntries(month);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <WeeklyThemeCard weekInsight={weekInsight} />

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
    paddingTop: 60,
    paddingBottom: 140,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekCardOuter: {
    width: '100%',
    marginBottom: 24,
    borderRadius: theme.borderRadius.large,
    ...theme.shadows.card,
  },
  weekCard: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    alignItems: 'center',
  },
  weekBadge: {
    marginBottom: 12,
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
