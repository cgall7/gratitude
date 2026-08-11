import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { hexPoints, HEX_ASPECT } from '../utils/combGeometry';
import { MonthlyRecap } from './MonthlyRecap';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import { recentMonths, currentStreak, longestStreak } from '../utils/dateRanges';
import { DevVersionTag } from '../components/DevVersionTag';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakBadge } from '../components/StreakBadge';
import { StaggeredItem } from '../components/StaggeredItem';

const describeTheme = (insight, periodLabel) => {
  if (!insight) return '';
  const { theme: themeName, count, total } = insight;
  return `You leaned into "${themeName}" ${count} of ${total} ${periodLabel}.`;
};

// One page per month, oldest first — the current month is the last page, so
// "back in time" is the same leftward swipe it is in a photo roll. The window
// itself is `recentMonths`; this only hangs each month's entries off it.
//
// Sliced from one already-loaded list by ISO prefix rather than re-queried
// per month: `EntryStore.getEntriesBetween` reloads and re-sorts the whole
// store on every call, so twelve months would have meant twelve full reads
// of the same blob.
const buildMonths = (allEntries) =>
  recentMonths(new Date(), allEntries[0]?.date ?? null).map((month) => ({
    ...month,
    entries: allEntries.filter((entry) => entry.date.startsWith(month.key)),
  }));

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

// Which month you're on, and that there are others. A paging scroll with no
// indicator is a screen that hides its own second half — the swipe is only
// discoverable by accident.
//
// Hexagons rather than dots, from the comb's own `hexPoints`, so the rail is
// the app's shape at a small size instead of a lookalike (R36's rule applied
// one scale down). Decorative: the months themselves are the content, and a
// twelve-stop rail of unlabelled marks would only clutter VoiceOver.
const RAIL_W = 8;
const RAIL_H = RAIL_W * HEX_ASPECT;

const MonthRail = ({ count, activeIndex }) => (
  <View style={styles.rail} accessible={false} importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, index) => (
      <Svg key={index} width={RAIL_W} height={RAIL_H}>
        <Polygon
          points={hexPoints(RAIL_W, RAIL_H)}
          fill={index === activeIndex ? theme.colors.accentDeep : theme.colors.surfaceBorderStrong}
        />
      </Svg>
    ))}
  </View>
);

export const RecapTab = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState([]);
  // Tracked by month key, not index, so a reload that adds a page (or rolls
  // over into a new month) doesn't silently move you somewhere else.
  const [activeKey, setActiveKey] = useState(null);
  const pagerRef = useRef(null);
  const landedRef = useRef(false);

  // Same derivation the comb itself uses (R33 footnote): screen width less
  // the content padding, read live rather than measured. A page width that
  // arrives from `onLayout` a frame late would race the initial scroll to
  // the current month.
  const { width } = useWindowDimensions();
  const pageWidth = width - 48;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // One read of the store, sliced twelve ways below.
        const all = await EntryStore.getAllEntries();
        if (cancelled) return;
        setAllEntries(all);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const months = useMemo(() => buildMonths(allEntries), [allEntries]);
  const trackedIndex = months.findIndex((month) => month.key === activeKey);
  // Falls back to the current month whenever the tracked key isn't in the
  // list — first render, and any reload that trimmed the window.
  const activeIndex = trackedIndex >= 0 ? trackedIndex : months.length - 1;

  // `currentStreak`/`longestStreak` read every entry, not just this year's:
  // "BEST EVER" was measuring the calendar year, so a record set in December
  // vanished on New Year's Day. "THIS YEAR" stays year-scoped — it says so.
  const currentYear = String(new Date().getFullYear());
  const thisYear = allEntries.filter((entry) => entry.date.startsWith(currentYear));
  const streak = currentStreak(allEntries);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader
        eyebrow="YOUR PROGRESS"
        title="Recap"
        right={<StreakBadge streak={streak} />}
      />

      <StaggeredItem index={0}>
        <StatsCard streak={streak} best={longestStreak(allEntries)} total={thisYear.length} />
      </StaggeredItem>

      {months.length > 1 && <MonthRail count={months.length} activeIndex={activeIndex} />}

      {/* §17.5: one month per page, current month first. The vertical scroll
          owns the screen and this owns the horizontal axis — RN nests the
          two cleanly because they never compete for the same gesture. */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: pageWidth }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          const month = months[index];
          if (month && month.key !== months[activeIndex]?.key) setActiveKey(month.key);
        }}
        onContentSizeChange={(contentWidth) => {
          // Land on the current month once the pages have real width. Guarded
          // on the ref rather than on mount, because content size fires
          // again on rotation and re-landing would yank you off June.
          // The +1 is slack, not superstition: a content width reported a
          // hair under the exact product would latch this guard shut and
          // strand the pager on the oldest month forever.
          if (landedRef.current || contentWidth + 1 < pageWidth * months.length) return;
          landedRef.current = true;
          pagerRef.current?.scrollTo({ x: pageWidth * (months.length - 1), animated: false });
        }}
      >
        {months.map((month, index) => {
          const insight = dominantTheme(month.entries);
          return (
            <View key={month.key} style={{ width: pageWidth }}>
              <MonthlyRecap
                monthName={month.label}
                title={month.title}
                entries={month.entries}
                daysInMonth={month.daysInMonth}
                insightTheme={insight ? insight.theme : null}
                insightDescription={insight ? describeTheme(insight, 'days this month') : null}
                onPreviewWrapped={() => navigation.navigate('Wrapped')}
                active={index === activeIndex}
              />
            </View>
          );
        })}
      </ScrollView>

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
  rail: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 18,
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
});
