import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { EntryStore } from '../services/EntryStore';
import { FlyingBee } from '../components/FlyingBee';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakBadge } from '../components/StreakBadge';
import { StaggeredItem } from '../components/StaggeredItem';
import { TargetPicker } from '../components/TargetPicker';
import { currentStreak, nextMilestone, startOfYear, endOfYear } from '../utils/dateRanges';
import { TAB_CLEARANCE } from '../navigation/tabBarLayout';

const greeting = (date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const longDate = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

// The line under the streak — a goal, not just a number. Turns "7" into
// "3 days to 10," which is the whole point of showing a streak at all.
const streakCaption = (streak) => {
  if (streak === 0) return 'Write today to start your streak.';
  const next = nextMilestone(streak);
  if (!next) return "You've caught every milestone. Keep going.";
  return `${next.remaining} ${next.remaining === 1 ? 'day' : 'days'} to ${next.target}.`;
};

const ME_TARGET = { id: 'me', name: 'Me' };

// Pixel's ruling (2026-08-13, thread e10d0fed §1): the picker cannot be a
// filter — the streak/total stay target-independent by ruling, so nothing
// above them may look like it scopes them. The picker attaches to the
// compose affordance instead, and the CTA states its own scope in words.
const composeLabel = (targets, activeTargetId) => {
  const target = targets.find((t) => t.id === activeTargetId);
  if (!target || target.id === ME_TARGET.id) return "Write today's entry";
  return `Write about ${target.name}`;
};

// §8b.1 target picker. `targets` defaults to Me-only, so a user with zero
// Private Hives sees this screen render byte-identically to before the
// picker existed — TargetPicker itself only mounts once there's something
// to pick between. Wiring `activeTargetId` into per-target entry data is
// P0-2's follow-on slice (blocked on Fizz's hive-scoped entries schema);
// today the picker only tracks selection.
export const TodayTab = ({ navigation, targets = [ME_TARGET] }) => {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeTargetId, setActiveTargetId] = useState(targets[0].id);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = new Date();
        const [today, yearEntries] = await Promise.all([
          EntryStore.getEntry(now),
          EntryStore.getEntriesBetween(startOfYear(now), endOfYear(now)),
        ]);
        if (cancelled) return;
        setEntry(today);
        setStreak(currentStreak(yearEntries, now));
        setTotal(yearEntries.length);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  const now = new Date();

  return (
    <View style={styles.container}>
      {/* §12.2/§14.1: ambient cruise, default-on for Today idle. Absolutely
          positioned behind the content and never intercepts touches
          (pointerEvents="none" throughout FlyingBee). */}
      <FlyingBee active />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={longDate(now)}
          title={greeting(now)}
          right={<StreakBadge streak={streak} />}
        />

        <StaggeredItem index={0}>
          <View style={styles.streakCard}>
            <Text style={styles.streakCaption}>{streakCaption(streak)}</Text>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>DAYS</Text>
                <Text style={styles.statLabelSub}>IN A ROW</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{total}</Text>
                <Text style={styles.statLabel}>ENTRIES</Text>
                <Text style={styles.statLabelSub}>THIS YEAR</Text>
              </View>
            </View>
          </View>
        </StaggeredItem>

        <StaggeredItem index={1}>
          {entry ? (
            <View style={styles.quoteCard}>
              <Text style={styles.themeBadge}>{entry.theme}</Text>
              <Text style={styles.gratitudeText}>"{entry.text}"</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Today's page is blank.</Text>
              <Text style={styles.emptyBody}>
                One line is enough. Write it, and your apps unlock for the day.
              </Text>
              {targets.length > 1 && (
                <View style={styles.targetPickerRow}>
                  <TargetPicker targets={targets} activeId={activeTargetId} onSelect={setActiveTargetId} />
                </View>
              )}
              <PrimaryButton onPress={() => navigation.getParent()?.navigate('Lock')}>
                {composeLabel(targets, activeTargetId)}
              </PrimaryButton>
            </View>
          )}
        </StaggeredItem>

        {entry && (
          <StaggeredItem index={2}>
            <Text style={styles.footerText}>
              Saved and unlocked. Share it with your hive, or come back tomorrow.
            </Text>
          </StaggeredItem>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: TAB_CLEARANCE,
  },
  targetPickerRow: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  streakCard: {
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    marginBottom: 16,
  },
  streakCaption: {
    ...theme.type.bodyLg,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  statDivider: {
    height: 1,
    backgroundColor: theme.colors.surfaceBorderStrong,
    marginVertical: 20,
  },
  statRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...theme.type.display,
    color: theme.colors.accentDeep,
  },
  statLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  // Pixel's ruling (§2): the label states unit (line 1) + scope (line 2) —
  // `ENTRIES THIS YEAR` on one line overflows the stat column at 375pt
  // before any gutter is allowed between the two stats.
  statLabelSub: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyTitle: {
    ...theme.type.h2,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginBottom: 24,
  },
  quoteCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  themeBadge: {
    ...theme.type.label,
    color: theme.colors.accentDeep,
    backgroundColor: theme.colors.accentDeep + '1A',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gratitudeText: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 24,
    color: theme.colors.ink,
    textAlign: 'center',
    lineHeight: 34,
  },
  footerText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 20,
  },
});
