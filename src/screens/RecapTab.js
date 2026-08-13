import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { PressableScale } from '../components/PressableScale';
import { TAB_CLEARANCE } from '../navigation/tabBarLayout';

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
// Exported so check-streaks.mjs (Sage, thread 19e90cf8) can assert against
// it directly — otherwise `allEntries.reduce(...)` below reads exactly like
// a needless complication of `allEntries[0]?.date` to anyone who doesn't
// know EntryStore's ascending sort isn't guaranteed, and nothing stops it
// being "simplified" back.
export const buildMonths = (allEntries) => {
  // Earliest date computed directly rather than read off allEntries[0]:
  // that assumed ascending order, which is EntryStore's contract today but
  // not a guarantee `recentMonths` can enforce on its caller (Sage, thread
  // 19e90cf8: the same assumption flipped `longestStreak` to 1 under a
  // descending query, and would silently collapse this pager to one page
  // the same way). Killing the precondition here means the pager can't
  // regress no matter what order a future Supabase adapter returns.
  const earliestISO = allEntries.reduce(
    (min, entry) => (min === null || entry.date < min ? entry.date : min),
    null
  );
  return recentMonths(new Date(), earliestISO).map((month) => ({
    ...month,
    entries: allEntries.filter((entry) => entry.date.startsWith(month.key)),
  }));
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

// Project 10 moved Wrapped out of the tab bar and into the Garden, per the
// ruling ("@Pixel's Wrapped goes into the Garden tab, not as a top-level
// tab"). This card is now the ONLY entry point to `PollinateWrapped` anywhere
// in the app — nothing else navigates to that route. Removing it doesn't tidy
// the screen, it strands a shipped one.
//
// Below the month pager rather than above it: the months are what you came
// for, and a year-in-review teaser at the top spoils the reveal the same way
// Recap's old always-on insight card did (§17.5).
const WrappedCard = () => {
  const navigation = useNavigation();

  return (
    <PressableScale
      containerStyle={styles.wrappedOuter}
      style={styles.wrappedCard}
      onPress={() => navigation.getParent()?.navigate('Wrapped')}
      accessibilityLabel="Your year, wrapped"
    >
      <View style={styles.wrappedIcon}>
        <Ionicons name="gift" size={22} color={theme.colors.ink} />
      </View>
      <View style={styles.wrappedText}>
        <Text style={styles.wrappedTitle}>Your year, wrapped</Text>
        <Text style={styles.wrappedSubtitle}>Every month, in one sitting</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.inkSoft} />
    </PressableScale>
  );
};

export const RecapTab = () => {
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
      {/* "Garden", not "Recap": Project 10 made this the Garden tab, and a
          tab labelled one thing opening a screen titled another is the kind
          of mismatch nobody files a bug for and everybody trips on. The
          monthly recap is still what the screen opens on — the month pager
          below names each month itself. */}
      <ScreenHeader
        eyebrow="YOUR PROGRESS"
        title="Garden"
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
                active={index === activeIndex}
              />
            </View>
          );
        })}
      </ScrollView>

      <WrappedCard />

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
    paddingBottom: TAB_CLEARANCE,
  },
  rail: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 18,
  },
  // `containerStyle` carries the layout (the outer Pressable is the flex
  // child of the ScrollView), `wrappedCard` carries the paint — that split is
  // PressableScale's contract, and putting the background on `style` is what
  // makes the card scale on press instead of the paint sitting still while an
  // invisible box shrinks inside it.
  wrappedOuter: {
    marginTop: 20,
  },
  wrappedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  // The roundel is accent as a fill behind ink, which is the only thing §2
  // lets accent be. Computed, not recalled: ink `#221B03` on marigold
  // `#FFD200` is 11.80:1, `accentDeep` `#FF7A00` on it is 1.80:1 — under 3:1,
  // so the glyph is ink and stays ink.
  //
  // R15 withdrew `accentDeep` for exactly this reason, but its number is
  // 1.53:1 and that is a different pair — `accentDeep` on the Year Card's
  // gold `#F0C023`. The ruling transfers; the measurement does not, and both
  // fail the same bar anyway.
  wrappedIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrappedText: {
    flex: 1,
  },
  wrappedTitle: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  wrappedSubtitle: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 2,
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
