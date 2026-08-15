import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { SeedsStore, resolveSeedView, nextWakeDelay, SEED_VIEWS } from '../services/SeedsStore';
import { bloomDateLabel } from '../utils/seedDraft';
import { PressableScale } from '../components/PressableScale';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadState, LOAD_STATES, resolveListView } from '../components/LoadState';

// 8.4 — the surface that makes a planted seed exist.
//
// Until this screen, `plantSeed` succeeded and the modal closed over nothing:
// there was no view anywhere in the app that showed a seed back. Chrome is
// NotesInbox's, deliberately — two lists, one toggle, detail folded in rather
// than a second route — because a seed is a note that arrives late, and two
// inboxes that behave differently would be two things to learn.
//
// WHAT THIS SCREEN IS CAREFUL ABOUT, AND WHY IT IS THE WHOLE JOB
//
// §22.1: the seal renders off `bloom_at`, never off `content == null`. Both
// facts arrive on every row, and they are independent — a seed you SENT hands
// back its text while still sealed, because the select policy names
// `sender_id` with no bloom condition. So `resolveSeedView` decides whether
// the seal has opened and `direction` decides whether there is text you are
// entitled to read. Collapsing those two is the error I published and
// retracted this morning.
//
// §22.2: the reveal is a refetch, not a timer. `listReceived()` at time T
// returns `content: null` for everything with `bloom_at > T`, because the
// policy is evaluated at query time. A countdown reaching zero on a cached row
// produces no text — we never had the text. So the wake does not open a seal;
// it asks again, and the seal opens on what comes back. If the server still
// seals it, the device clock was fast: stay sealed, retry.
//
// NOT BUILT HERE, ON PURPOSE: 8.8's reveal choreography. The transition
// sealed -> bloomed is live and observable on this screen — that is the
// mechanism §22.2 requires and it is the part that had to be right. The beat
// itself is @Pixel's, and inventing durations for it here is exactly the R61
// failure mode. The seam is `SeedRow`, which re-renders with a new `view` the
// moment the refetch lands.

const DIRECTIONS = { RECEIVED: 'received', SENT: 'sent' };

// 26pt glyph + 12pt slop each side = a 50pt target, over the 44pt floor.
const DISMISS_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// One row in either list. `direction` picks whose name shows — a sent seed's
// "other person" is the recipient — and, separately, whether text in hand is
// text this reader may see.
const SeedRow = ({ seed, direction, onPress }) => {
  const person = direction === DIRECTIONS.RECEIVED ? seed.sender : seed.recipient;
  const { view } = resolveSeedView(seed);
  const sealed = view === SEED_VIEWS.SEALED;

  // A sent seed shows its own text while sealed: the sender wrote it, the
  // server hands it back, and hiding a person's own sentence from them would
  // be a seal pointed the wrong way. A received sealed seed has no text to
  // show and no text was ever sent — that is the shape of what arrived, not a
  // treatment applied to hide something (§22.2's argument for a seal over a
  // blur).
  const showsText = !sealed || direction === DIRECTIONS.SENT;
  const unopened = direction === DIRECTIONS.RECEIVED && !sealed && !seed.opened_at;

  return (
    <PressableScale onPress={() => onPress(seed)} style={styles.row}>
      <Avatar name={person?.display_name} avatarUrl={person?.avatar_url} size={40} />
      <View style={styles.rowText}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName}>{person?.display_name ?? 'Someone'}</Text>
          {unopened && <View style={styles.unopenedDot} />}
        </View>
        {showsText && seed.content != null ? (
          <Text style={styles.rowPreview} numberOfLines={1}>
            {seed.content}
          </Text>
        ) : (
          <Text style={styles.rowSealed} numberOfLines={1}>
            Sealed until {bloomDateLabel(new Date(seed.bloom_at))}
          </Text>
        )}
      </View>
      {sealed && <Ionicons name="lock-closed-outline" size={16} color={theme.colors.inkSoft} />}
    </PressableScale>
  );
};

const SeedDetail = ({ seed, direction, onClose }) => {
  const person = direction === DIRECTIONS.RECEIVED ? seed.sender : seed.recipient;
  const { view } = resolveSeedView(seed);
  const sealed = view === SEED_VIEWS.SEALED;
  const showsText = !sealed || direction === DIRECTIONS.SENT;

  return (
    <View style={styles.detailOverlay}>
      <PressableScale onPress={onClose} style={styles.detailClose} haptic={null}>
        <Ionicons name="close" size={24} color={theme.colors.inkSoft} />
      </PressableScale>
      <View style={styles.detailCard}>
        <Avatar name={person?.display_name} avatarUrl={person?.avatar_url} size={56} />
        <Text style={styles.detailName}>
          {direction === DIRECTIONS.RECEIVED
            ? `From ${person?.display_name ?? 'Someone'}`
            : `To ${person?.display_name ?? 'Someone'}`}
        </Text>
        <Text style={styles.detailTimestamp}>
          {sealed
            ? `Blooms ${bloomDateLabel(new Date(seed.bloom_at))}`
            : `Bloomed ${bloomDateLabel(new Date(seed.bloom_at))}`}
        </Text>
        {showsText && seed.content != null ? (
          <Text style={styles.detailContent}>"{seed.content}"</Text>
        ) : (
          // The sealed detail says what is true and promises nothing about a
          // notification the app does not send. It is not an error state and
          // must not read as one — nothing has gone wrong, the date is simply
          // ahead of us.
          <Text style={styles.detailSealed}>
            This one is still sealed. Come back on {bloomDateLabel(new Date(seed.bloom_at))}.
          </Text>
        )}
      </View>
    </View>
  );
};

export const SeedsInbox = ({ navigation }) => {
  const [direction, setDirection] = useState(DIRECTIONS.RECEIVED);
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  // Only the read OUTCOME is tracked. Which of the five states renders is
  // `resolveListView`'s call, made from this plus the rows actually in hand —
  // §23.1, and the reason `empty` can never be the default rendering of "I am
  // holding no rows."
  const [readState, setReadState] = useState(LOAD_STATES.LOADING);
  const [openSeedId, setOpenSeedId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    // No `setReadState(LOADING)` on a re-read that has rows behind it: with
    // content in hand `resolveListView` maps LOADING to `ready`, so the list
    // stays put and a refresh never blanks a screen that was fine (§23.1a).
    const [receivedSeeds, sentSeeds] = await Promise.all([
      SeedsStore.listReceived(),
      SeedsStore.listSent(),
    ]);
    setReceived(receivedSeeds);
    setSent(sentSeeds);
    setReadState(LOAD_STATES.READY);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().catch((err) => {
        if (cancelled) return;
        // Recorded as "the read did not return", not as a view. Whether that
        // shows as `stale` or `unknown` depends on what is still on screen,
        // which is render-time knowledge this closure does not have.
        console.warn('Failed to load seeds', err);
        setReadState(LOAD_STATES.UNKNOWN);
      });
      return () => {
        cancelled = true;
      };
    }, [load, reloadKey])
  );

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // §22.2's wake. Not a countdown that opens a seal — a timer whose only job
  // is to ask the server again, because the text was never on this device.
  //
  // Scheduled over BOTH lists rather than the visible one: a seed blooming in
  // the tab you are not looking at should be open when you get there, and the
  // toggle is not a reload.
  const timer = useRef(null);
  useEffect(() => {
    const delay = nextWakeDelay([...received, ...sent]);
    if (delay == null) return undefined;
    timer.current = setTimeout(refetch, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [received, sent, refetch]);

  const seeds = direction === DIRECTIONS.RECEIVED ? received : sent;
  const listView = resolveListView(readState, seeds.length);

  // The open detail is DERIVED from the list, never a snapshot taken at tap
  // time — and that distinction is this screen's whole thesis, not a style
  // preference. §22.2's reveal IS the refetch, and the refetch replaces these
  // row objects. A captured `seed` would keep showing a seal the server has
  // already opened underneath it, on the one surface whose job is to notice,
  // and it would fail exactly for the user who opened a seed to wait on it.
  // By id, the open card transitions sealed -> bloomed with the row behind
  // it. That transition is the seam 8.8 animates.
  //
  // Resolving to null (a seed unplanted from another device between reads)
  // simply closes the overlay. Nothing to announce: it is gone.
  const openSeed = openSeedId == null ? null : seeds.find((s) => s.id === openSeedId) ?? null;

  const handleOpen = (seed) => {
    setOpenSeedId(seed.id);
    const { view } = resolveSeedView(seed);
    // 8.11 hangs off `opened_at`, and Postgres refuses the write before bloom
    // (`seeds_recipient_open_only`) — so the guard here is not belt-and-braces,
    // it is the difference between a no-op and a rejected request on every tap
    // of a sealed seed.
    if (direction !== DIRECTIONS.RECEIVED || view !== SEED_VIEWS.BLOOMED || seed.opened_at) return;
    SeedsStore.markOpened(seed.id)
      .then(() =>
        setReceived((list) =>
          list.map((s) => (s.id === seed.id ? { ...s, opened_at: new Date().toISOString() } : s))
        )
      )
      .catch((err) => console.warn('Failed to mark seed opened', err));
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="SEEDS"
          title="Seeds"
          left={
            // This screen is a modal over the tab bar with headerShown:false
            // global — this chevron is its only exit (check-modal-dismiss).
            // chevron-down because that is the way the card will go; an X
            // would read as cancel, and putting an inbox away discards
            // nothing. Idiom promoted from Account.js.
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={DISMISS_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
            </TouchableOpacity>
          }
          right={
            <PressableScale
              onPress={() => navigation.navigate('PlantSeed')}
              haptic={null}
              accessibilityLabel="Plant a seed"
            >
              <Ionicons name="add-circle" size={28} color={theme.colors.ink} />
            </PressableScale>
          }
        />

        <View style={styles.tabRow}>
          <PressableScale
            onPress={() => setDirection(DIRECTIONS.RECEIVED)}
            style={[styles.tab, direction === DIRECTIONS.RECEIVED && styles.tabActive]}
          >
            <Text style={[styles.tabText, direction === DIRECTIONS.RECEIVED && styles.tabTextActive]}>
              Received
            </Text>
          </PressableScale>
          <PressableScale
            onPress={() => setDirection(DIRECTIONS.SENT)}
            style={[styles.tab, direction === DIRECTIONS.SENT && styles.tabActive]}
          >
            <Text style={[styles.tabText, direction === DIRECTIONS.SENT && styles.tabTextActive]}>
              Sent
            </Text>
          </PressableScale>
        </View>

        {/* §23.7 — the stale line comes BEFORE the content it is about, so a
            screen reader reaches the caveat before the rows it qualifies. */}
        {listView === LOAD_STATES.STALE && (
          <LoadState
            state={LOAD_STATES.STALE}
            onRetry={refetch}
            staleLabel="This list may be out of date."
            staleActionLabel="Refresh"
            retryAccessibilityLabel="Refresh your seeds"
            style={styles.stale}
          />
        )}

        {listView === LOAD_STATES.LOADING && (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        )}

        {listView === LOAD_STATES.UNKNOWN && (
          <LoadState
            state={LOAD_STATES.UNKNOWN}
            onRetry={refetch}
            title="Couldn't reach your seeds"
            body="Something went wrong on the way to the hive."
            actionLabel="Try again"
            retryAccessibilityLabel="Try loading your seeds again"
          />
        )}

        {/* Reachable only through `resolveListView`, and that returns EMPTY
            only from a read that returned. §23.1: emptiness is a positive
            claim about the user's data, so it needs a read to stand on. */}
        {listView === LOAD_STATES.EMPTY && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {direction === DIRECTIONS.RECEIVED ? 'No seeds waiting.' : "You haven't planted any seeds."}
            </Text>
            <Text style={styles.emptyBody}>
              {direction === DIRECTIONS.RECEIVED
                ? 'Seeds people plant for you will wait here until they bloom.'
                : 'Plant one for someone and it stays sealed until the date you pick.'}
            </Text>
          </View>
        )}

        {(listView === LOAD_STATES.READY || listView === LOAD_STATES.STALE) &&
          seeds.map((seed) => (
            <SeedRow key={seed.id} seed={seed} direction={direction} onPress={handleOpen} />
          ))}
      </ScrollView>

      {openSeed && (
        <SeedDetail seed={openSeed} direction={direction} onClose={() => setOpenSeedId(null)} />
      )}
    </View>
  );
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
    paddingBottom: 48,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  tabActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  tabText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  tabTextActive: {
    color: theme.colors.surface,
  },
  stale: {
    marginBottom: 12,
  },
  loader: {
    marginTop: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  rowText: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    ...theme.type.bodyLg,
    color: theme.colors.textPrimary,
  },
  // `accentDeep` at 7pt, identical to NotesInbox's unread dot — not a
  // preference, a correction. I had this as `accent` at 8pt, and `accent`
  // (#FFD200) on `surface` (#FFFFFF) is **1.4512:1**: a status dot you cannot
  // see, carrying the only signal that a seed is unopened. `accentDeep`
  // (#FF7A00) on the same ground is **2.6133:1**.
  //
  // Which is still under 3:1, and I am NOT inventing a local hex to clear it
  // — that is the R61 failure mode, and it would have to be un-invented when
  // the token retune lands. @Pixel: this is the same inheritance as `danger`
  // on PlantSeed. The dot is the sole indicator of unopened state, so it is a
  // graphical object under 1.4.11 on the same reading you gave the progress
  // track, and NotesInbox's shipped dot fails identically — one class, two
  // sites, both waiting on the retune rather than on me.
  unopenedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accentDeep,
  },
  rowPreview: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  // Same register as the preview it stands in for — the seal is a state, not a
  // quieter kind of content, so it does not get a quieter colour. §23.9.2:
  // `inkSoft` is already a dim and dimming it again puts it under 4.5:1.
  rowSealed: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  // §23.3's tell only works if `empty` wears a wash on this screen, since
  // `unknown` deliberately wears none — the difference has to be visible
  // side by side, not just against some other screen's empty state.
  // `washYellow` is the token; `emptyStateYellow` is HoneycombTab's local
  // style name for it, not something `theme.colors` has.
  // inkSoft on #FFF3C4 = 5.67:1, ink = 15.39:1. Both measured, not assumed.
  emptyState: {
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.large,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  // `absoluteFill`, NOT `absoluteFillObject` — the latter does not exist in RN
  // 0.86.2 (`StyleSheet.absoluteFill` is the plain object at
  // StyleSheetExports.js:21; there is no `absoluteFillObject` export). Spreading
  // the missing name yields an overlay with no positioning at all, which is the
  // bug that made FlyingBee invisible and was fixed in d0def1c. Matching
  // NotesInbox's scrim exactly, because a seed detail and a note detail should
  // be siblings.
  detailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 21, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailClose: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
  detailCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: 32,
    alignItems: 'center',
  },
  detailName: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  detailTimestamp: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  detailContent: {
    ...theme.type.bodyLg,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
  },
  detailSealed: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 20,
  },
});
