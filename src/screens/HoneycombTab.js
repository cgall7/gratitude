import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { HoneycombStore } from '../services/HoneycombStore';
import { EntryStore } from '../services/EntryStore';
import { toISODate } from '../utils/dateRanges';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { FeedCard } from '../components/FeedCard';
import { HoneycombGrid } from '../components/HoneycombGrid';
import { ScreenHeader } from '../components/ScreenHeader';
import { BeeTransition } from '../components/BeeTransition';
import { FlyingBee } from '../components/FlyingBee';
import { DEMO_HIVE_MEMBERS } from '../constants/demoHive';

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
// the actual hive; demo members fill the outer rings behind them so the
// honeycomb always looks alive even with 0-2 real connections. Capped so
// the grid stays a tidy cluster instead of sprawling off-screen.
const MAX_HIVE_CELLS = 12;

const toGridMember = (share) => ({
  id: share.id,
  name: share.isOwn ? 'You' : share.author?.display_name ?? 'Someone',
  gratitude: share.content,
  avatarUrl: share.author?.avatar_url,
  isOwn: share.isOwn,
  isDemo: false,
});

const buildHiveMembers = (feed) => {
  const real = feed.map(toGridMember);
  const combined = real.concat(DEMO_HIVE_MEMBERS);
  return combined.slice(0, MAX_HIVE_CELLS);
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
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
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
    const [feedResult, connectionsResult, requestsResult, entry] = await Promise.all([
      HoneycombStore.listFeed(),
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
      />

      <HoneycombGrid members={buildHiveMembers(feed)} />

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
    paddingBottom: 140,
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
    color: theme.colors.background,
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
