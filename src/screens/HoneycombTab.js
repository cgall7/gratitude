import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
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
import { HoneycombGrid, HIVE_SLOTS } from '../components/HoneycombGrid';
import { ScreenHeader } from '../components/ScreenHeader';
import { BeeTransition } from '../components/BeeTransition';
import { FlyingBee } from '../components/FlyingBee';
import { demoHiveShares } from '../constants/demoHive';
import { TAB_CLEARANCE } from '../navigation/tabBarLayout';

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
const toGridMember = (share) => ({
  id: share.id,
  name: share.isOwn ? 'You' : share.author?.display_name ?? 'Someone',
  gratitude: share.content,
  avatarUrl: share.author?.avatar_url,
  isOwn: share.isOwn,
  isDemo: share.isDemo ?? false,
});

// §18.1.1: ONE merged share list — real shares first, then the demo set —
// is the source of truth for both views, and the merge happens BEFORE any
// partition. The demo dates derive from the same `now` the today-test
// compares against (demoHiveShares' contract), so the two sides can't
// drift apart across midnight. Partition-then-map is forced: toGridMember
// drops `entryDate`, so mapping first would bucket every share under
// undefined. The list side never maps at all — FeedCard's vocabulary is
// the raw share (one vocabulary per LAYER, not per feature).
const partitionHive = (weekFeed, now = new Date()) => {
  const merged = weekFeed.concat(demoHiveShares(now));
  const todayISO = toISODate(now);
  return {
    todayMembers: merged
      .filter((share) => share.entryDate === todayISO)
      .map(toGridMember)
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

const RequestRow = ({ request, onRespond }) => (
  <View style={styles.requestRow}>
    <Text style={styles.requestName}>{request.requester?.display_name ?? 'Someone'} wants to add you to their hive.</Text>
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

const HoneycombFeed = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  // 'today' | 'week' — the §18 pager's resting position. State lives here
  // (not in the toggle) so Pixel's pager can drive it from swipe progress.
  const [hiveView, setHiveView] = useState('today');
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

  const loadAll = useCallback(async ({ suppressArrival = false } = {}) => {
    const today = toISODate(new Date());
    const [feedResult, weekFeedResult, connectionsResult, requestsResult, entry] = await Promise.all([
      HoneycombStore.listFeed(),
      // Window floor: today minus six days, inclusive — 7 day-buckets total.
      HoneycombStore.listFeedSince(daysAgoISO(HIVE_WEEK_DAYS - 1)),
      HoneycombStore.listConnections(),
      HoneycombStore.listIncomingRequests(),
      EntryStore.getEntry(new Date()),
    ]);

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
    setWeekFeed(weekFeedResult);
    setConnections(connectionsResult);
    setIncomingRequests(requestsResult);
    setTodayEntry(entry);
    setAlreadySharedToday(entry ? await HoneycombStore.hasSharedDate(today) : false);
    setLoading(false);
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
        setAddMessage({ tone: 'error', text: "No Honeycomb account with that email yet." });
        return;
      }
      await HoneycombStore.sendConnectionRequest(profile.id);
      setAddMessage({ tone: 'success', text: `Request sent to ${profile.display_name}.` });
      setAddEmail('');
    } catch (err) {
      if (err?.code === '23505') {
        setAddMessage({ tone: 'error', text: 'Already connected or request pending.' });
      } else {
        setAddMessage({ tone: 'error', text: err.message || 'Could not send request.' });
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

  const handleShareToday = async () => {
    if (!todayEntry || sharing) return;
    setSharing(true);
    try {
      await HoneycombStore.shareEntry({
        date: toISODate(new Date()),
        text: todayEntry.text,
        theme: todayEntry.theme,
      });
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

  return (
    <View style={styles.container}>
      {/* §12.2/§14.1 ambient cruise — anchored to the screen (not the
          scroll content) so it never scrolls off with the feed; parked
          while idle content loads is handled by the `active` gate at the
          top of the tree, not here. */}
      <FlyingBee active />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenHeader
        eyebrow={
          connections.length > 0
            ? `${connections.length} CONNECTION${connections.length === 1 ? '' : 'S'}`
            : 'YOUR HIVE'
        }
        title="Honeycomb"
        right={
          // Project 7 entry point — modal route lives on the root stack,
          // not this tab's own navigator, hence getParent().
          <PressableScale onPress={() => navigation.getParent()?.navigate('Notes')} haptic={null}>
            <Ionicons name="mail-outline" size={22} color={theme.colors.ink} />
          </PressableScale>
        }
      />

      <HiveViewToggle view={hiveView} onChange={setHiveView} />

      {hiveView === 'week' ? (
        <WeekView
          sections={weekSections}
          truncated={weekFeed.length >= WEEK_FEED_LIMIT}
          onLikeToggled={handleLikeToggled}
        />
      ) : (
      <>
      <HoneycombGrid members={todayMembers} />

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
            <RequestRow key={request.id} request={request} onRespond={handleRespond} />
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

      {feed.length === 0 ? (
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
          {feed.map((share) => (
            <FeedCard key={share.id} share={share} onLikeToggled={handleLikeToggled} />
          ))}
        </View>
      )}
      </>
      )}
      </ScrollView>
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
  requestName: {
    ...theme.type.bodySm,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 10,
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
