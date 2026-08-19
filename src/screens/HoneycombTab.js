import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { HoneycombStore, WEEK_FEED_LIMIT } from '../services/HoneycombStore';
import { EntryStore } from '../services/EntryStore';
import { toISODate, daysAgoISO, groupSharesByDay, HIVE_WEEK_DAYS } from '../utils/dateRanges';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { FeedCard } from '../components/FeedCard';
import { SendEventCard } from '../components/SendEventCard';
import { HoneycombGrid, HIVE_SLOTS, personKey } from '../components/HoneycombGrid';
import { ScreenHeader } from '../components/ScreenHeader';
import { BeeTransition } from '../components/BeeTransition';
import { FlyingBee } from '../components/FlyingBee';
import { PerchAnchor, PerchField, usePerchSet } from '../components/PerchAnchor';
import { demoHiveShares } from '../constants/demoHive';
import { DEMO_CONTENT } from '../constants/demoMode';
import { TAB_CLEARANCE } from '../navigation/tabBarLayout';
import { isBlooming } from '../utils/hiveState';

// Share carry (Sunbeam §11.2): the bee lifts the just-shared entry off the
// button and carries it up toward the grid it just joined.
const SHARE_CARRY_PATH = {
  translateX: [10, -30],
  translateY: [10, -60, -130],
  rotate: ['6deg', '-14deg'],
};

// Feed arrival: a short touchdown at the top of the feed when a new share
// lands there on refresh — the bee delivering it into the hive's view.
const FEED_ARRIVAL_PATH = {
  translateX: [-50, 30],
  translateY: [-24, -4, 6],
  rotate: ['-10deg', '4deg'],
};

// Real shares go first (center of the spiral, full opacity) so they read as
// the actual hive; demo members fill the ring behind them so the honeycomb
// always looks alive even with 0-2 real connections. The seat count lives in
// HoneycombGrid — a hex ring only closes at 7, so the cap is the geometry's
// to state, not this screen's.

// ONE mapper, for every member the grid draws (§18.1). Demo members are
// authored in share shape, so they come through here too rather than being
// handed to the grid raw — that is what `isDemo` has to be read rather than
// assumed false.
//
// `blooming`/`seeded` (§21/6.4, R59): no real share carries either field yet
// — the endpoint that would compute them (`fizz/hive-state-endpoint`) is
// still unmerged — so every non-demo share defaults both to false here.
// Demo shares author them directly (demoHive.js), which is the only
// producer that exists today; wiring a real one is a follow-up, not this
// mapper's job to fake.
//
// `authorId` (§28.9 correction 2): `id` is the SHARE. The comb draws faces,
// so everything that asks "is this still the one you tapped" — the selection
// ring, the reveal card, the pollination abort — has to key on the person.
// Real shares carry `authorId` from `toFeedShare` (HoneycombStore:19) and it
// died here; demo shares have no author key at all, so `personKey` falls back
// to `id`, which demoHive generates one-per-person. Not a degraded path: one
// meaning across both populations.
const toGridMember = (share) => ({
  id: share.id,
  authorId: share.authorId,
  name: share.isOwn ? 'You' : share.author?.display_name ?? 'Someone',
  gratitude: share.content,
  avatarUrl: share.author?.avatar_url,
  isOwn: share.isOwn,
  isDemo: share.isDemo ?? false,
  blooming: share.blooming ?? false,
  seeded: share.seeded ?? false,
});

// §18.1.1: ONE merged share list — real shares first, then the demo set —
// is the source of truth for both views, and the merge happens BEFORE any
// partition. The demo dates derive from the same `now` the today-test
// compares against (demoHiveShares' contract), so the two sides can't
// drift apart across midnight. Partition-then-map is forced: toGridMember
// drops `entryDate`, so mapping first would bucket every share under
// undefined. The list side never maps at all — FeedCard's vocabulary is
// the raw share (one vocabulary per LAYER, not per feature).
//
// ONE SEAT PER PERSON, and it belongs INSIDE the `todayMembers` chain — never
// on `merged`, which is the tempting spot one line higher and produces no
// error. `merged` feeds both returns, and a person with two entries in a week
// SHOULD produce two cards in the week list; deduping there would silently
// delete them. Comb dedupes, list must not — another instance of the split
// this header already states (one vocabulary per LAYER).
//
// Today the filter is provably a no-op: a person cannot hold two shares today
// (`entries_one_journal_per_day` unique on (user_id, entry_date),
// `shares.entry_id` unique, and nothing in `src/` deletes an entry or a
// share). But that index is PARTIAL — `where hive_id is null` — so Private
// Hives entries sit outside it. Installing the rule while it is a no-op is
// the point: the fixture that proves it changes nothing today is the same
// fixture that proves it works then. It also protects `HoneycombGrid`, which
// now resolves its selection by looking the person up in this list and would
// answer a duplicate with the wrong seat. Feed order is newest-first, so
// keeping the first occurrence keeps the person's most recent share.
const partitionHive = (weekFeed, now = new Date()) => {
  // DEMO_CONTENT-gated per Lumen's design assessment (thread 37fb8ef6,
  // WP-10a): a real tester's honeycomb should show their own quiet-hive
  // door (WP-4's EmptyCell), not fabricated strangers. check:demo-hive
  // still exercises demoHiveShares directly, unaffected by this call site.
  // DEMO_CONTENT, not raw __DEV__ (Sage's LATENT finding, thread 37fb8ef6):
  // a pitch build has __DEV__ false but still wants the demo comb.
  const merged = DEMO_CONTENT ? weekFeed.concat(demoHiveShares(now)) : weekFeed;
  const todayISO = toISODate(now);
  const seen = new Set();
  return {
    todayMembers: merged
      .filter((share) => share.entryDate === todayISO)
      .map(toGridMember)
      .filter((member) => {
        const key = personKey(member);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, HIVE_SLOTS),
    weekSections: groupSharesByDay(merged, now),
  };
};

// The §18 knob's structural half: two labeled seats and one selected state,
// driven by taps for now. Pixel's motion layer replaces the interaction with
// the pager position (§18.2) — the accessibility contract here is the part
// that stays (§18.5: role tab, selected state announced).
const HiveViewToggle = ({ view, onChange }) => (
  <View style={styles.viewToggle} accessibilityRole="tablist">
    {[
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'Last 7 days' },
    ].map((option) => {
      const selected = view === option.key;
      return (
        <PressableScale
          key={option.key}
          onPress={() => onChange(option.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          // R43: flex sizing must ride the outer Pressable (the row's real
          // flex child); the visual seat rides the inner scaling view.
          containerStyle={styles.viewToggleSeatContainer}
          style={[styles.viewToggleSeat, selected && styles.viewToggleSeatActive]}
        >
          <Text style={[styles.viewToggleLabel, selected && styles.viewToggleLabelActive]}>
            {option.label}
          </Text>
        </PressableScale>
      );
    })}
  </View>
);

// The Venmo-style last-7-days body (§18.1): day sections newest-first, each
// day's shares under one header. Demo rows arrive pre-merged (paler +
// read-only via FeedCard's own §18.1.1 guard, so this stays a dumb list).
const WeekView = ({ sections, truncated, onLikeToggled }) => {
  if (sections.length === 0) {
    return (
      <View style={[styles.emptyState, styles.emptyStateSky]}>
        <Text style={styles.emptyTitle}>A quiet week in the hive.</Text>
        <Text style={styles.emptyBody}>Shares from the last 7 days will gather here.</Text>
      </View>
    );
  }

  return (
    <View>
      {sections.map((section) => (
        <View key={section.date} style={styles.weekSection}>
          <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
          {section.shares.map((share) => (
            <FeedCard key={share.id} share={share} onLikeToggled={onLikeToggled} />
          ))}
        </View>
      ))}
      {/* The 200-row cap is cut on created_at, not the entry_date the window
          filters on — a full page means the week's older end may be missing
          (Sage's truncation flag, §18.1.1 engineering notes). Say so rather
          than render a silently incomplete week. */}
      {truncated && (
        <Text style={styles.weekTruncationNote}>
          Your hive was busy — showing the most recent {WEEK_FEED_LIMIT} shares from this week.
        </Text>
      )}
    </View>
  );
};

const RequestRow = ({ request, onRespond, onBlock }) => {
  const name = request.requester?.display_name ?? 'Someone';
  const confirmBlock = () => {
    Alert.alert(`Block ${name}?`, "They won't be able to send you another request.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => onBlock(request.id) },
    ]);
  };

  return (
    <View style={styles.requestRow}>
      <View style={styles.requestTextCol}>
        <Text style={styles.requestName}>{name} wants to add you to their hive.</Text>
        <PressableScale onPress={confirmBlock} haptic={null}>
          <Text style={styles.blockText}>Block</Text>
        </PressableScale>
      </View>
      <View style={styles.requestActions}>
        <PressableScale onPress={() => onRespond(request.id, false)} style={styles.declineButton}>
          <Text style={styles.declineText}>Not now</Text>
        </PressableScale>
        <PressableScale onPress={() => onRespond(request.id, true)} style={styles.acceptButton}>
          <Text style={styles.acceptText}>Accept</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const HoneycombFeed = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  // 8b.7 — a separate list from `feed`: hive_send_events is its own table
  // (see HoneycombStore.listSendEvents), so it's a separate query. Merged
  // with `feed` only at render time (mergedFeed below), never into `feed`
  // itself — knownFeedIdsRef/feedArrivalKey below key off `feed` alone, and
  // a send event has no entry to have arrived.
  const [sendEvents, setSendEvents] = useState([]);
  // 'today' | 'week' — the §18 pager's resting position. State lives here
  // (not in the toggle) so Pixel's pager can drive it from swipe progress.
  const [hiveView, setHiveView] = useState('today');
  // §32.2 — the comb view's three anchors. Declared unconditionally; the
  // week view's suppression is at the `<FlyingBee perches>` prop, because
  // two of these three (header actions, view toggle) render in BOTH views
  // and a count taken off the render tree alone would keep the bee flying.
  const perches = usePerchSet();
  const [weekFeed, setWeekFeed] = useState([]);
  const [connections, setConnections] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [todayEntry, setTodayEntry] = useState(null);
  const [alreadySharedToday, setAlreadySharedToday] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [addEmail, setAddEmail] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState(null);
  // The add-a-connection form used to sit permanently under the hive — a raw
  // email field in the best real estate on the screen. It's a once-in-a-while
  // action, so it collapses behind its own row until you want it.
  const [addOpen, setAddOpen] = useState(false);

  const [shareCarryKey, setShareCarryKey] = useState(0);
  const [feedArrivalKey, setFeedArrivalKey] = useState(0);
  const knownFeedIdsRef = useRef(null);

  // §28 — the pollination target currently handed to the cruiser, in WINDOW
  // coordinates. The comb produces it, the bee consumes it, and this screen is
  // only the wire between two boxes that never learn each other's units.
  const [pollination, setPollination] = useState(null);
  const pollinationRef = useRef(null);
  pollinationRef.current = pollination;
  // The live scroll offset (read by value by the abort predicate) and a tick
  // that carries no information and exists only to re-run it. §28.9: put
  // completeness in the trigger and correctness in the predicate.
  const scrollYRef = useRef(0);
  const [scrollTick, setScrollTick] = useState(0);
  const handleScroll = useCallback((e) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    // Only publish while a flight is airborne. The predicate is the tick's
    // only consumer, and a per-frame setState on a screen with fourteen
    // `useState` hooks is a real cost to pay when there is no bee to abort.
    if (pollinationRef.current) setScrollTick((n) => n + 1);
  }, []);

  const loadAll = useCallback(async ({ suppressArrival = false } = {}) => {
    // finally, not a trailing call: any of the seven Promise.all members below
    // rejecting — or hasSharedDate() further down — must still clear the
    // spinner. Before this, only the happy path reached setLoading(false),
    // so a rejection left the tab spinning forever with no exit (Sage,
    // thread e10d0fed). This doesn't add an error state — that's unowned,
    // filed to Pixel's queue in the same post — it only guarantees the
    // loading indicator itself can't get stuck.
    try {
      const today = toISODate(new Date());
      const [feedResult, sendEventsResult, weekFeedRaw, connectionsResult, requestsResult, entry, hiveState] = await Promise.all([
        HoneycombStore.listFeed(),
        // 8b.7 — its own query against hive_send_events, merged with
        // feedResult only at render time (mergedFeed below).
        HoneycombStore.listSendEvents(),
        // Window floor: today minus six days, inclusive — 7 day-buckets total.
        HoneycombStore.listFeedSince(daysAgoISO(HIVE_WEEK_DAYS - 1)),
        HoneycombStore.listConnections(),
        HoneycombStore.listIncomingRequests(),
        EntryStore.getEntry(new Date()),
        // A blooming decoration failing must not take down the membership
        // list, the feed, or friend requests — five things that exist in
        // prod today riding on one that doesn't yet (Sage, thread e10d0fed:
        // list_hive_state 404s until its migration is applied). Holds after
        // the migration lands too, for the RPC that times out or errors.
        HoneycombStore.listHiveState().catch(() => []),
      ]);

      // Join hive-state facts onto real shares only, before the demo set gets
      // concatenated in (HoneycombTab.js `partitionHive`) — demo shares carry
      // no `authorId` a fact row could match against, so joining after that
      // point silently overwrites Maya/Theo/Jonah's authored states with
      // `false` (R61, thread e10d0fed, Pixel). `!share.isDemo` is belt-and-
      // braces: real shares never carry the flag, so this is always true here.
      const bloomingByMember = new Map(hiveState.map((row) => [row.member_id, row.last_note_received_at]));
      const weekFeedResult = weekFeedRaw.map((share) =>
        share.isDemo ? share : { ...share, blooming: isBlooming(bloomingByMember.get(share.authorId)) }
      );

      // Feed arrival: fire only when a share we haven't seen yet lands at the
      // top on a refresh — not on first load (so the bee never greets an
      // empty hive filling in for the first time), and not right after our
      // own share, which already got its own carry flight off the button.
      if (knownFeedIdsRef.current && !suppressArrival) {
        const hasNewArrival = feedResult.some((share) => !knownFeedIdsRef.current.has(share.id));
        if (hasNewArrival) setFeedArrivalKey((key) => key + 1);
      }
      knownFeedIdsRef.current = new Set(feedResult.map((share) => share.id));

      setFeed(feedResult);
      setSendEvents(sendEventsResult);
      setWeekFeed(weekFeedResult);
      setConnections(connectionsResult);
      setIncomingRequests(requestsResult);
      setTodayEntry(entry);
      setAlreadySharedToday(entry ? await HoneycombStore.hasSharedDate(today) : false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAll().catch((err) => {
        if (!cancelled) console.warn('Failed to load Honeycomb data', err);
      });
      return () => {
        cancelled = true;
      };
    }, [loadAll])
  );

  const handleAddConnection = async () => {
    const email = addEmail.trim();
    if (!email || addBusy) return;
    setAddBusy(true);
    setAddMessage(null);
    try {
      const profile = await HoneycombStore.findProfileByEmail(email);
      if (!profile) {
        // No brand name at all (Deezine's ruling, 2026-08-13). This was "No
        // Honeycomb account"; an account isn't scoped to a tab, so "No Hive
        // account" was never the repair — but naming the product wasn't
        // either. Its two siblings at `:296`/`:298` are terse and brand-free,
        // and this is a functional error line, not the wordmark. Saying
        // nothing is the fix that doesn't start a pattern.
        setAddMessage({ tone: 'error', text: 'No account with that email yet.' });
        return;
      }
      await HoneycombStore.sendConnectionRequest(profile.id);
      setAddMessage({ tone: 'success', text: `Request sent to ${profile.display_name}.` });
      setAddEmail('');
    } catch (err) {
      if (err?.code === '23505') {
        setAddMessage({ tone: 'error', text: 'Already connected or request pending.' });
      } else {
        // Authored copy, not the raw rail message (Sage, thread 14492cf2 §4).
        console.warn('Failed to send connection request', err);
        setAddMessage({ tone: 'error', text: 'Could not send request.' });
      }
    } finally {
      setAddBusy(false);
    }
  };

  const handleRespond = async (id, accept) => {
    try {
      await HoneycombStore.respondToRequest(id, accept);
      await loadAll();
    } catch (err) {
      console.warn('Failed to respond to request', err);
    }
  };

  const handleBlock = async (id) => {
    try {
      await HoneycombStore.blockRequest(id);
      await loadAll();
    } catch (err) {
      console.warn('Failed to block request', err);
    }
  };

  const handleShareToday = async () => {
    if (!todayEntry || sharing) return;
    setSharing(true);
    try {
      await HoneycombStore.shareEntry({ entryId: todayEntry.id });
      setShareCarryKey((key) => key + 1);
      await loadAll({ suppressArrival: true });
    } catch (err) {
      console.warn('Failed to share entry', err);
    } finally {
      setSharing(false);
    }
  };

  const handleLikeToggled = () => {
    loadAll().catch((err) => console.warn('Failed to refresh feed', err));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  // Cheap enough to run per render (≤ WEEK_FEED_LIMIT + 19 items), and
  // running it here means the comb's "today" moves with every refresh
  // rather than freezing at mount.
  const { todayMembers, weekSections } = partitionHive(weekFeed);

  // 8b.7 — shares and send events are two separate queries against two
  // separate tables (HoneycombStore.listFeed / listSendEvents); this is the
  // one place they become one list, newest-first by the same clock
  // (created_at on both sides). Today-only, like `feed` itself — WeekView
  // stays share-only because it windows on entries.entry_date, which a
  // send event doesn't have.
  const mergedFeed = [...feed, ...sendEvents].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <View style={styles.container}>
      {/* §12.2/§14.1 ambient presence — anchored to the screen (not the
          scroll content) so it never scrolls off with the feed; parked
          while idle content loads is handled by the `active` gate at the
          top of the tree, not here.

          §32.2 — WEEK VIEW HAS NO BEE, and this line is a BEHAVIOUR REMOVAL,
          not a side effect of the mount. Until now the bee flew its 7s loop
          over the week feed too (it mounts here, above the `hiveView` ternary
          below, so the toggle never touched it). Lumen ratified suppression as
          an explicit interim on 2026-08-17: a feed is for reading, and a
          mascot doing laps over a list of other people's gratitude competes
          with it. The end state is perch-only presence — one declared anchor
          on the toggle, PERCH state, zero sorties — as an immediate
          fast-follow, deliberately not folded in here.

          It leaves over `PRESENCE_FADE_MS` rather than disappearing; that is
          FlyingBee's, and it is the same 160ms as the descent. */}
      <FlyingBee
        active
        perches={hiveView === 'week' ? null : perches}
        pollinate={pollination}
        onPollinateEnd={() => setPollination(null)}
      />
      <PerchField perches={perches}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        // §28.9 — new wiring, not a prop flip: this ScrollView had no
        // `onScroll` and no `scrollEventThrottle` at all. A flight's aim point
        // is fixed in window space while the comb is not, and the longest
        // approaches are the most interruptible ones.
        //
        // `onScroll` is the load-bearing half. The 16 is INERT on RN 0.86.2 —
        // both architectures collapse any value ≤ 1/60s to an internal 0, and
        // 0 already dispatches every frame; on Android nothing reads the prop
        // at all. Do not take the two native comments that say otherwise as
        // corroboration: they are the same false sentence in two
        // architectures, and the JS docs are correct and silent on the
        // default. It stays because "values ≤ 16 disable throttling" is a
        // documented guarantee this beat depends on and does not own.
        // Measurements are in section G of check-bee-attitude, which asserts
        // the bound rather than the prop.
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
      <ScreenHeader
        eyebrow={
          connections.length > 0
            ? `${connections.length} CONNECTION${connections.length === 1 ? '' : 'S'}`
            : 'YOUR HIVE'
        }
        // "Hive", not "Honeycomb": Project 10 renamed the tab per the ruling,
        // and one of two places the old word was still on screen. Grepping
        // `src/` + `App.js` for the old name turned up the other: live error
        // copy at `:288`, now brand-free per Deezine. Everything else is an
        // identifier or a comment, except `supabase.js:16`, which is a
        // `console.warn` — developer-visible, rebrand debt, not mine to sweep
        // from inside a navigation change.
        //
        // The files keep their names. `check-demo-hive.mjs:74` reads
        // `src/components/HoneycombGrid.js` by path and unwraps its regex
        // match with no null guard, so a file rename fails that gate as a
        // TypeError rather than a diagnosis — and a rename with no
        // user-facing half is not worth buying that with.
        title="Hive"
        right={
          // Project 7 and Project 8 entry points — both modal routes live on
          // the root stack, not this tab's own navigator, hence getParent().
          //
          // PLACEMENT IS A DESIGN CALL I MADE, NOT AN ENGINEERING ONE. A
          // compose screen nothing opens is a well-tested absence, so Seeds
          // needed *a* door; the header beside Notes is the only surface that
          // already has this shape. @Pixel/@Deezine — moving it is this block
          // and nothing else, and the tab bar rebuild (Project 10) may well
          // take both icons anyway.
          //
          // The leaf now opens the LIST, not the compose screen. When 8.2 was
          // the only Seeds surface, a door straight to compose was the only
          // door there was. Now it matches Notes exactly — icon opens the
          // inbox, `+` inside it composes — and the two entry points beside
          // each other behaving differently would have been a thing to learn
          // for no reason.
          // §32.2 anchor. `on="right"` and it is the only anchor on this
          // screen that starts life at the right edge, so it carries the
          // set's x-extent the same way TodayTab's badge does.
          <PerchAnchor id="header-actions" on="right" at={0.5} style={styles.headerActions}>
            <PressableScale
              onPress={() => navigation.getParent()?.navigate('Seeds')}
              haptic={null}
              accessibilityLabel="Seeds"
            >
              <Ionicons name="leaf-outline" size={22} color={theme.colors.ink} />
            </PressableScale>
            <PressableScale
              onPress={() => navigation.getParent()?.navigate('Notes')}
              haptic={null}
              accessibilityLabel="Notes"
            >
              <Ionicons name="mail-outline" size={22} color={theme.colors.ink} />
            </PressableScale>
            {/* 8b.6's discovery door — same placement reasoning as Seeds/Notes
                above (a compose/open screen nothing points at is untested
                dead code): the header beside them is the only surface that
                already has this shape. Moving it is Project 10's call, same
                note the two icons above already carry. */}
            <PressableScale
              onPress={() => navigation.getParent()?.navigate('ReceivedPackages')}
              haptic={null}
              accessibilityLabel="Sent to you"
            >
              <Ionicons name="gift-outline" size={22} color={theme.colors.ink} />
            </PressableScale>
          </PerchAnchor>
        }
      />

      <PerchAnchor id="view-toggle" on="left" at={0.5}>
        <HiveViewToggle view={hiveView} onChange={setHiveView} />
      </PerchAnchor>

      {/* §18/§23.2/Sage(thread e10d0fed, §4 follow-up): three invariants at
          once — the feed can't render alongside the week list (it's a
          same-table subset: HoneycombStore.listFeed vs .listFeedSince,
          double-draws the last 7 days), the controls must render in both
          arms (§4 — a pending request can't be hidden by toggle position),
          and the feed must stay below the controls ("share today's
          gratitude" is the primary action and can't be buried under up to
          50 cards). The today arm can't be one contiguous region, because
          chrome that belongs to neither arm sits between the comb and the
          feed. So: comb/week-list swap here, chrome at screen level below,
          feed gated on the same condition at its original position after
          the chrome — reunited with the comb by condition, not by nesting. */}
      {hiveView === 'week' ? (
        <WeekView
          sections={weekSections}
          truncated={weekFeed.length >= WEEK_FEED_LIMIT}
          onLikeToggled={handleLikeToggled}
        />
      ) : (
        // §32.2 anchor — the comb as a whole, wrapped rather than per-cell.
        // A cell is absolutely positioned inside the grid's own box, and an
        // absolute style carries the container it was written against, so
        // wrapping one would move it. The comb is also the thing the eye reads
        // as a place on this screen; its cells are seats, not destinations.
        <PerchAnchor id="comb" on="right" at={0.4}>
        <HoneycombGrid
          members={todayMembers}
          onInvitePress={() => setAddOpen(true)}
          scrollYRef={scrollYRef}
          scrollTick={scrollTick}
          activePollinationKey={pollination?.key ?? null}
          onPollinate={setPollination}
          onPollinateCancel={() => setPollination(null)}
        />
        </PerchAnchor>
      )}

      <View style={styles.addCard}>
        <PressableScale onPress={() => setAddOpen((open) => !open)} style={styles.addToggle} haptic={null}>
          <Ionicons
            name={addOpen ? 'close' : 'person-add-outline'}
            size={18}
            color={theme.colors.inkSoft}
          />
          <Text style={styles.addToggleText}>{addOpen ? 'Cancel' : 'Add someone to your hive'}</Text>
        </PressableScale>

        {addOpen && (
          <View style={styles.addBody}>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder="Their email"
                placeholderTextColor={theme.colors.textSecondary}
                value={addEmail}
                onChangeText={setAddEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!addBusy}
                autoFocus
              />
              <PressableScale onPress={handleAddConnection} disabled={!addEmail.trim() || addBusy} style={styles.addButton}>
                <Text style={styles.addButtonText}>{addBusy ? '…' : 'Add'}</Text>
              </PressableScale>
            </View>
            {addMessage && (
              <Text style={[styles.addMessage, addMessage.tone === 'error' && styles.addMessageError]}>
                {addMessage.text}
              </Text>
            )}
          </View>
        )}
      </View>

      {incomingRequests.length > 0 && (
        <View style={styles.requestsCard}>
          <Text style={styles.sectionLabel}>REQUESTS</Text>
          {incomingRequests.map((request) => (
            <RequestRow key={request.id} request={request} onRespond={handleRespond} onBlock={handleBlock} />
          ))}
        </View>
      )}

      {todayEntry && !alreadySharedToday && (
        <View style={styles.shareButtonAnchor}>
          <PrimaryButton onPress={handleShareToday} disabled={sharing} style={styles.shareButton}>
            {sharing ? 'Sharing…' : "Share today's gratitude"}
          </PrimaryButton>
          <BeeTransition triggerKey={shareCarryKey} path={SHARE_CARRY_PATH} anchorStyle={styles.shareCarryBeeAnchor} size={16} />
        </View>
      )}
      {todayEntry && alreadySharedToday && (
        <Text style={styles.sharedConfirmation}>Shared to your hive.</Text>
      )}

      {hiveView !== 'week' && (
        mergedFeed.length === 0 ? (
          connections.length === 0 ? (
            <View style={[styles.emptyState, styles.emptyStateYellow]}>
              <Text style={styles.emptyTitle}>Your hive is quiet.</Text>
              <Text style={styles.emptyBody}>Add a connection by email to get started.</Text>
            </View>
          ) : (
            <View style={[styles.emptyState, styles.emptyStateSky]}>
              <Text style={styles.emptyTitle}>Nothing in the hive yet.</Text>
              <Text style={styles.emptyBody}>Be the first — share today's entry…</Text>
            </View>
          )
        ) : (
          <View style={styles.feedTopAnchor}>
            <BeeTransition triggerKey={feedArrivalKey} path={FEED_ARRIVAL_PATH} anchorStyle={styles.feedArrivalBeeAnchor} size={16} />
            {mergedFeed.map((item) =>
              item.kind === 'send' ? (
                <SendEventCard key={`send-${item.id}`} event={item} />
              ) : (
                <FeedCard key={item.id} share={item} onLikeToggled={handleLikeToggled} />
              )
            )}
          </View>
        )
      )}
      </ScrollView>
      </PerchField>
    </View>
  );
};

// Shown instead of the feed when there's no session — demo-skip, or a
// backgrounded/foregrounded resume that landed here before signup. Points
// back to onboarding's SignUpStep rather than putting a second full
// create-account form behind the honeycomb tab (Colin + Sage ruling,
// 2026-08-09: account creation lives in onboarding only).
const HoneycombEmptyState = () => {
  const navigation = useNavigation();

  return (
    <View style={[styles.container, styles.gateContainer]}>
      <Text style={styles.gateDisplay}>Your hive is waiting.</Text>
      <Text style={styles.gateBody}>Finish setting up your account to open it — takes less than a minute.</Text>
      <PrimaryButton onPress={() => navigation.getParent()?.navigate('Onboarding', { startAt: 'signup' })}>
        Finish signup
      </PrimaryButton>
      <PressableScale
        onPress={() => navigation.getParent()?.navigate('Onboarding', { startAt: 'signin' })}
        haptic={null}
        style={styles.gateSignInLink}
      >
        <Text style={styles.gateSignInText}>Already have an account? Sign in</Text>
      </PressableScale>
    </View>
  );
};

export const HoneycombTab = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return session ? <HoneycombFeed /> : <HoneycombEmptyState />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: TAB_CLEARANCE,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateContainer: {
    backgroundColor: theme.colors.washYellow,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  gateDisplay: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  gateBody: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    marginBottom: 28,
  },
  gateSignInLink: {
    alignSelf: 'center',
    marginTop: 18,
  },
  gateSignInText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 12,
  },
  // §18 knob, structural register only: a surface pill whose active seat is
  // the same tonal-field-plus-ink treatment as the tab bar's active marker.
  // Pixel's motion pass replaces the seat swap with the pour (§18.2-18.3).
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    padding: 4,
    marginBottom: 20,
  },
  viewToggleSeatContainer: {
    flex: 1,
  },
  viewToggleSeat: {
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  viewToggleSeatActive: {
    backgroundColor: theme.colors.washYellow,
  },
  viewToggleLabel: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textSecondary,
  },
  viewToggleLabelActive: {
    color: theme.colors.ink,
  },
  weekSection: {
    marginBottom: 8,
  },
  weekTruncationNote: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
  addCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addToggleText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.inkSoft,
  },
  addBody: {
    marginTop: 14,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  addButton: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.backgroundWriting,
  },
  addMessage: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 10,
  },
  addMessageError: {
    color: theme.colors.danger,
  },
  requestsCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  requestTextCol: {
    flex: 1,
    marginRight: 10,
    gap: 4,
  },
  requestName: {
    ...theme.type.bodySm,
    color: theme.colors.textPrimary,
  },
  blockText: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceBorder,
  },
  declineText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  acceptButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
  },
  acceptText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  shareButtonAnchor: {
    marginBottom: 20,
  },
  shareButton: {
    marginBottom: 0,
  },
  shareCarryBeeAnchor: {
    bottom: 12,
    left: '50%',
    top: undefined,
  },
  sharedConfirmation: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginBottom: 20,
  },
  feedTopAnchor: {
    position: 'relative',
  },
  feedArrivalBeeAnchor: {
    top: -8,
    left: '50%',
  },
  emptyState: {
    borderRadius: theme.borderRadius.large,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
  },
  emptyStateYellow: {
    backgroundColor: theme.colors.washYellow,
  },
  emptyStateSky: {
    backgroundColor: theme.colors.washSky,
  },
  emptyTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
