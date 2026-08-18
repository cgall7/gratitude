import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { EntryStore } from '../services/EntryStore';
import { FlyingBee } from '../components/FlyingBee';
import { PerchAnchor, PerchField, usePerchSet } from '../components/PerchAnchor';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakBadge } from '../components/StreakBadge';
import { StaggeredItem } from '../components/StaggeredItem';
import { currentStreak, nextMilestone } from '../utils/dateRanges';
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

export const TodayTab = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entry, setEntry] = useState(null);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  // §32.2 — where the bee may land, held by the screen and read by the flight.
  // Membership only: the coordinates are measured at the moment of choosing,
  // so scrolling this list does not touch this value and does not re-render.
  const perches = usePerchSet();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = new Date();
        try {
          const [today, allEntries] = await Promise.all([
            EntryStore.getEntry(now),
            EntryStore.getAllEntries(),
          ]);
          if (cancelled) return;
          setError(false);
          setEntry(today);
          // Streak reads every entry, not just this year's — Recap already
          // fixed this (RecapTab.js: "'BEST EVER' was measuring the calendar
          // year, so a record set in December vanished on New Year's Day").
          // Today had the same bug one tab over: a year-scoped streak resets
          // to 1 on January 1st mid-run, while the header's StreakBadge and
          // Recap's badge disagree on the same day (Pixel, thread 19e90cf8,
          // 2026-08-13). "THIS YEAR" stays year-scoped — it says so.
          setStreak(currentStreak(allEntries, now));
          const currentYear = String(now.getFullYear());
          setTotal(allEntries.filter((e) => e.date.startsWith(currentYear)).length);
        } catch (err) {
          // requireUserId (EntryStore.js) throws 'Not signed in' with no
          // session — reachable via DEMO_MODE's Welcome skip link, which
          // lands on Main with no auth. Without this catch, `loading` never
          // flips and the tab spins forever instead of showing empty state
          // (Sage/Pixel, thread 19e90cf8, 2026-08-13).
          //
          // `error` is what actually distinguishes this from a genuinely
          // empty day (Pixel, thread 19e90cf8: setting entry/streak/total
          // to their empty values here was asserting four specific false
          // things — 0-day streak, 0 this year, "Write today to start your
          // streak.", "Today's page is blank." — about a user we simply
          // failed to read, not one who wrote nothing). §23 unknown state
          // is Deezine's when it lands; this is the placeholder that keeps
          // the read/write path honest until then.
          if (cancelled) return;
          console.warn('TodayTab: failed to load entries', err);
          setError(true);
          setEntry(null);
          setStreak(0);
          setTotal(0);
        } finally {
          if (!cancelled) setLoading(false);
        }
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
      {/* §12.2/§14.1: ambient presence, default-on for Today idle. Absolutely
          positioned behind the content and never intercepts touches
          (pointerEvents="none" throughout FlyingBee).

          §32.2 — `perches` is the whole of what the bee knows about this
          screen. Passing null is how a state says "no bee": the error arm
          withholds the badge and the CTA by design, and a mascot doing laps
          over failure copy performs cheerfulness at failure (Lumen, ratified
          2026-08-17). Note this is a DIFFERENT decision from the week feed's,
          which suppresses itself structurally by declaring nothing to land on
          — same outcome, and the two must not be collapsed into one rule,
          because one is about tone and the other is about geometry. */}
      <FlyingBee active perches={error ? null : perches} />

      <PerchField perches={perches}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={longDate(now)}
          title={greeting(now)}
          right={
            error ? null : (
              // Right side, and the only anchor on this screen that is not a
              // full-width block: the badge sits in the header's own right
              // slot, so it carries most of the set's x-extent by itself.
              <PerchAnchor id="badge" on="right" at={0.5}>
                <StreakBadge streak={streak} />
              </PerchAnchor>
            )
          }
        />

        {/* Anchors alternate sides down the screen — R122, and on this screen
            it is not a preference. Every `StaggeredItem` is a full-width card
            in one 24pt column, so anchoring them all on the same side gives
            the set ZERO x-extent, `facingFor` never crosses its one-body-width
            threshold, and the bee flies every sortie facing the same way. The
            ≥44pt span is asserted by `check-bee-attitude` row K4 ("the set is
            not a column") against these declarations, so a later edit that
            quietly puts them back in a column fails rather than ships. K4
            checks the unconditional subset too: an extent that rests on the
            conditional badge is an extent some render state does not have. */}
        <StaggeredItem index={0}>
          <PerchAnchor id="streak-card" on="left" at={0.5}>
          <View style={[styles.streakCard, error && { backgroundColor: theme.colors.surface }]}>
            {error ? (
              // No numeral, no caption — both are assertions about a user
              // we failed to read, not one who wrote nothing (Pixel, thread
              // 19e90cf8). Placeholder copy; Deezine's when §23 lands.
              <Text style={styles.streakCaption}>We couldn't reach your journal.</Text>
            ) : (
              <>
                <Text style={styles.streakCaption}>{streakCaption(streak)}</Text>
                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{streak}</Text>
                    <Text style={styles.statLabel}>DAY STREAK</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{total}</Text>
                    <Text style={styles.statLabel}>THIS YEAR</Text>
                  </View>
                </View>
              </>
            )}
          </View>
          </PerchAnchor>
        </StaggeredItem>

        <StaggeredItem index={1}>
          <PerchAnchor id="entry-card" on="right" at={0.5}>
          {entry ? (
            <View style={styles.quoteCard}>
              <Text style={styles.themeBadge}>{entry.theme}</Text>
              <Text style={styles.gratitudeText}>"{entry.text}"</Text>
            </View>
          ) : error ? (
            // No CTA: a failed read can't rule out today already having an
            // entry, and the write button routes into saveEntry's update
            // branch on a day that turns out to be shared — reopening the
            // edit-after-share hazard Pixel's own enumeration had ruled
            // latent (thread 19e90cf8). Placeholder copy; Deezine's when
            // §23 lands.
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>We couldn't reach your journal.</Text>
              <Text style={styles.emptyBody}>Check your connection and try again.</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Today's page is blank.</Text>
              <Text style={styles.emptyBody}>
                One line is enough. Write it, and your day opens.
              </Text>
              <PrimaryButton onPress={() => navigation.getParent()?.navigate('Lock')}>
                Write today's entry
              </PrimaryButton>
            </View>
          )}
          </PerchAnchor>
        </StaggeredItem>

        {/* The written state's fourth anchor, and the reason the written state
            is the RICHER one rather than the poorer one — Sage's §1 retraction
            (2026-08-17). Counting affordances stops at the Write button and
            gets 2 here; counting structural units, which is the declared rule,
            finds this footer and gets 4. It is declared by being wrapped, so
            the count is a consequence of this JSX and cannot drift from a
            table that says what the JSX does. */}
        {entry && (
          <StaggeredItem index={2}>
            <PerchAnchor id="footer" on="left" at={0.5}>
              <Text style={styles.footerText}>
                Saved. Your day is open. Share it with your hive, or come back tomorrow.
              </Text>
            </PerchAnchor>
          </StaggeredItem>
        )}
      </ScrollView>
      </PerchField>
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
