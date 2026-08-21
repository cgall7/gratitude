import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { SPRINGS, useReducedMotion } from '../constants/motion';
import {
  STUB_GRAMMAR,
  buildRevealSequence,
  startReveal,
  tapReveal,
  dwellProgress,
  arrivalMs,
} from '../components/revealSequencer';

// 8b.6 Recipient opens package — `docs/strategy/Pollinate_Delivery_Slices.md`
// §8b.6, the reveal engine's SECOND mount point (`revealSequencer.js`'s own
// header names both by number). Same engine, same rulings 1-4 and 6 as
// MemoryLane.js (8b.4) — ruling 5 says the two differ only in what feeds the
// sequence and what the ending is, never in a `mode` the engine would carry.
//
// What feeds the sequence here: `HiveStore.getReceivedPackage`, the
// subject-scoped read Sage's 8b.5 spec ships (`private_hives.sent_at` +
// `private_hives_select_as_subject` + `entries_select_as_hive_subject`).
// NOT YET CALLABLE — see that method's header. This screen was built and
// hand-tested in the simulator against a local fixture array shaped like
// `getReceivedPackage`'s return value (same trick 8b.4 used); the fixture
// wiring is not in this diff, only the real call is, so this screen goes
// live automatically the moment 8b.5 merges and needs no rewrite here.
//
// What the ending is: NOT "return to hive" (there is no hive to return to —
// the recipient never owned one) and NOT react/reply. The Delivery Slices
// row for 8b.6 asks for both, but neither has an addressing surface today —
// `likes`/`comments` (20260808000001) key off `shares.id`, and a private
// hive entry is deliberately never a share (the mirror guard 8b.5 adds is
// the other direction of that same rule). Building react/reply now would
// mean inventing a schema decision this PR was not asked to make, so the
// ending is a plain close for this pass — flagged to Sage/Colin as an open
// item rather than shipped as UI with nothing behind it.
export const PackageOpenScreen = ({ navigation, route }) => {
  const { hiveId } = route.params;
  const reduced = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pkg, setPkg] = useState(null);
  const [sequence, setSequence] = useState(null);
  const [revealState, setRevealState] = useState(null);
  const [railFill, setRailFill] = useState(0);

  const bloomOpacity = useRef(new Animated.Value(0)).current;
  const bloomScale = useRef(new Animated.Value(0.85)).current;
  const dateOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const received = await HiveStore.getReceivedPackage(hiveId);
          if (cancelled) return;
          if (!received) {
            setError(true);
            return;
          }
          const seq = buildRevealSequence(received.entries);
          const now = Date.now();
          setPkg(received);
          setSequence(seq);
          setRevealState(seq.length > 0 ? startReveal(now) : { index: 0, arrivedAtMs: now, done: true });
          setError(false);
        } catch (err) {
          if (cancelled) return;
          console.warn('PackageOpenScreen: failed to load package', err);
          setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [hiveId])
  );

  // Same rail as MemoryLane — R118's floor is per-step and per-tap, not
  // per-screen, so this call site owns the tick for the same reason that
  // one does (see revealSequencer.js's own comment on why the tick is not
  // in the engine).
  useEffect(() => {
    if (!sequence || !revealState || revealState.done) return;
    const id = setInterval(() => {
      setRailFill(dwellProgress(revealState, Date.now(), sequence, STUB_GRAMMAR));
    }, 50);
    return () => clearInterval(id);
  }, [sequence, revealState]);

  useEffect(() => {
    if (!sequence || !revealState || revealState.done) return;
    dateOpacity.setValue(0);
    if (reduced) {
      bloomOpacity.setValue(0);
      bloomScale.setValue(1);
      Animated.timing(bloomOpacity, {
        toValue: 1,
        duration: arrivalMs(STUB_GRAMMAR, true),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    } else {
      bloomOpacity.setValue(0);
      bloomScale.setValue(0.85);
      Animated.parallel([
        Animated.spring(bloomOpacity, { toValue: 1, ...SPRINGS.reveal, useNativeDriver: true }),
        Animated.spring(bloomScale, { toValue: 1, ...SPRINGS.reveal, useNativeDriver: true }),
      ]).start();
    }
    Animated.timing(dateOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, revealState?.index, revealState?.done, reduced]);

  const handleTap = () => {
    if (!sequence || !revealState) return;
    const next = tapReveal(revealState, Date.now(), sequence, STUB_GRAMMAR);
    if (next === revealState) return;
    Haptics.selectionAsync();
    setRailFill(0);
    setRevealState(next);
  };

  const cover = hiveCoverTheme(pkg?.coverTheme);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: cover.base }]}>
        <ActivityIndicator color={theme.colors.ink} size="large" />
      </View>
    );
  }

  if (error || !pkg) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: cover.base }]}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={cover.textColor} />
        </PressableScale>
        <Text style={styles.emptyTitle}>We couldn't reach this package.</Text>
        <Text style={styles.emptyBody}>Check your connection and try again.</Text>
      </View>
    );
  }

  const step = sequence && revealState && !revealState.done ? sequence[revealState.index] : null;

  return (
    <View style={[styles.container, { backgroundColor: cover.base }]}>
      <PressableScale
        onPress={() => navigation.goBack()}
        style={styles.closeButton}
        accessibilityLabel="Close package"
      >
        <Ionicons name="close" size={22} color={cover.textColor} />
      </PressableScale>

      {step ? (
        <>
          <Text style={[styles.senderLabel, { color: cover.textColor }]}>From {pkg.senderName}</Text>
          <Pressable
            style={styles.tapArea}
            onPress={handleTap}
            accessibilityRole="button"
            accessibilityLabel="Tap to continue to the next memory"
          >
            <View style={styles.entryFrame} pointerEvents="box-none">
              <Animated.Text style={[styles.date, { color: cover.textColor, opacity: dateOpacity }]}>
                {formatRevealDate(step.at)}
              </Animated.Text>
              <Animated.View
                style={[styles.entryCard, { opacity: bloomOpacity, transform: [{ scale: bloomScale }] }]}
              >
                <ScrollView contentContainerStyle={styles.entryScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.entryText}>{step.text}</Text>
                </ScrollView>
              </Animated.View>
              <View style={styles.railTrack}>
                <View style={[styles.railFill, { width: `${Math.round(railFill * 100)}%` }]} />
              </View>
            </View>
          </Pressable>
        </>
      ) : (
        <View style={styles.ending}>
          <Text style={[styles.endingTitle, { color: cover.textColor }]}>
            {sequence && sequence.length > 0
              ? `That's everything ${pkg.senderName} sent.`
              : 'This package has nothing in it yet.'}
          </Text>
          <PrimaryButton onPress={() => navigation.goBack()}>Close</PrimaryButton>
        </View>
      )}
    </View>
  );
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatRevealDate = (atMs) => {
  const d = new Date(atMs);
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  return year === thisYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderLabel: {
    ...theme.type.label,
    textAlign: 'center',
    marginTop: 60,
    opacity: 0.8,
  },
  tapArea: {
    flex: 1,
  },
  entryFrame: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  date: {
    ...theme.type.h3,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    maxHeight: '62%',
    ...theme.shadows.floating,
  },
  entryScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  entryText: {
    ...theme.type.bodyLg,
    color: theme.colors.ink,
  },
  railTrack: {
    height: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.trackDim,
    marginTop: theme.spacing.lg,
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.ink,
  },
  ending: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  endingTitle: {
    ...theme.type.h2,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
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
  },
});
