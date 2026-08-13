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
import { LoadState, LOAD_STATES, resolveListView } from '../components/LoadState';
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
//
// This line put Garden in the do-not-nest set. `getParent()` is the root
// stack only while Garden is a direct <Tab.Screen>; put a navigator between
// them and this becomes a dead button — no crash, no red screen, correct in
// a screenshot. Sage cleared Garden to nest at 9771f9d and I repeated it in
// the commit that added this call, which is the moment it stopped being
// true. `npm run check:nav-depth` is the reader that sentence needed.
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
  // §23.1 — the screen tracks how the last read ENDED, and never picks the view
  // at the call site. `resolveListView` turns (readState x rows-in-hand) into
  // the state to render, which is what keeps a failed read from being able to
  // draw a zero. Before this it was a `loading` boolean seeded `true`, cleared
  // only on the happy path — so a rejection left the takeover spinner up
  // forever (Bumble, thread 3b8744e8; Pixel confirmed at 3f412ec). Pre-P0-2
  // this read AsyncStorage and could not fail; it now needs a session and the
  // network, so a cold open on a blip is enough.
  const [readState, setReadState] = useState(LOAD_STATES.LOADING);
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

  // A ref rather than the closure's `let`, because the retry button calls this
  // outside any focus cycle and there is no cleanup to pair with it there.
  const cancelledRef = useRef(false);
  const load = useCallback(async () => {
    setReadState(LOAD_STATES.LOADING);
    try {
      // One read of the store, sliced twelve ways below.
      const all = await EntryStore.getAllEntries();
      if (cancelledRef.current) return;
      setAllEntries(all);
      setReadState(LOAD_STATES.READY);
    } catch (err) {
      if (cancelledRef.current) return;
      // §23.1a — `allEntries` is deliberately NOT cleared. Rows already in hand
      // are real, and blanking them is the exact defect `resolveListView`
      // returns STALE for: a failure over kept content is a line above it, not
      // a takeover of it. Recap stays mounted across tab switches, so this is
      // the ordinary case, not the exotic one.
      setReadState(LOAD_STATES.UNKNOWN);
      console.warn('Failed to load entries for Recap', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cancelledRef.current = false;
      // Never rejects — the catch above is inside `load`, so there is no
      // discarded promise here for a rejection to escape through.
      load();
      return () => {
        cancelledRef.current = true;
      };
    }, [load])
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

  const listView = resolveListView(readState, allEntries.length);
  // EMPTY is not branched on, and that is a decision rather than an omission:
  // Recap's zero-entry rendering IS its content — an unfilled comb and a
  // truthful `0`, reachable only from a read that returned, which is the whole
  // guarantee `resolveListView` provides. Nothing to substitute.
  const unknown = listView === LOAD_STATES.UNKNOWN;

  // Only the load that has nothing behind it takes the screen over; a re-read
  // over kept rows resolves to READY/STALE and never reaches here (§23.1a).
  if (listView === LOAD_STATES.LOADING) {
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
        // §23.1 — the badge is an assertion about the user's practice, and on a
        // read that did not return there is nothing to make it from. Omit the
        // slot rather than draw `StreakBadge streak={0}`, which is not absence:
        // it is a hollow hexagon with a `0` in it, telling a forty-day user
        // they have no streak. Pixel caught the identical line surviving the
        // identical fix on TodayTab an hour ago (`TodayTab.js:115`) — the
        // header sits four lines above the block everything else lives in, and
        // proximity beat the list. STALE keeps the badge: those rows are real,
        // and the stale line says they may be old.
        right={unknown ? null : <StreakBadge streak={streak} />}
      />

      {/* §23.7 — the stale line comes BEFORE the content it qualifies, so a
          screen reader reaches the caveat on the way to the numbers rather
          than after believing them. */}
      {listView === LOAD_STATES.STALE && (
        <LoadState
          state={LOAD_STATES.STALE}
          onRetry={load}
          staleLabel="This may be out of date."
          staleActionLabel="Refresh"
          retryAccessibilityLabel="Refresh your journal"
          style={styles.stale}
        />
      )}

      {unknown ? (
        // Copy is placeholder in the same sense SeedsInbox's is — the register
        // is borrowed from its shipped sibling, and the words are Deezine's to
        // overrule. Deliberately names the journal rather than the surface:
        // this screen is "Recap" on main and "Garden" under the tab shell, and
        // a failure message should not be the thing that has to know which.
        <LoadState
          state={LOAD_STATES.UNKNOWN}
          onRetry={load}
          title="Couldn't reach your journal"
          body="Something went wrong on the way to the hive."
          actionLabel="Try again"
          retryAccessibilityLabel="Try loading your journal again"
        />
      ) : (
        <>
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
        </>
      )}

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
  stale: {
    marginBottom: 12,
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
