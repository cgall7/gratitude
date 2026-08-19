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

// 8b.4 Trip Down Memory Lane — the author's own bloom moment
// (`docs/strategy/Pollinate_Delivery_Slices.md` §8b.4, Colin's Slice 1
// ruling 2026-08-17: "build write-and-review first"). This is the FIRST of
// the reveal engine's two mount points; `src/components/revealSequencer.js`
// stays the single engine per the ruling in its own header — this file only
// supplies what that engine deliberately has no opinion about (ruling 5):
// what feeds the sequence (the hive's own entries, not a curated package)
// and what an ending is (return to the hive, never a reply prompt — that is
// package-open's shape, 8b.6, not this one).
//
// The tick that drives `dwellProgress` intentionally lives in this call
// site, not the engine — `check-reveal-pacing.mjs` samples the engine as a
// pure function of (state, time, tap) precisely so nothing here has to be
// imported for that gate to run.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// `step.at` is a UTC midnight epoch (`revealSequencer.parseCalendarDate`) —
// reading it back with UTC getters is what keeps this on the same calendar
// day the engine validated, matching that module's own local-midnight
// convention rather than letting a bare `Date` shift it across a timezone.
const formatRevealDate = (atMs) => {
  const d = new Date(atMs);
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  return year === thisYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
};

const RAIL_TICK_MS = 50;

export const MemoryLaneScreen = ({ navigation, route }) => {
  const { hiveId, subjectName, coverTheme } = route.params;
  const cover = hiveCoverTheme(coverTheme);
  const reduced = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
          const entries = await HiveStore.getHiveEntries(hiveId);
          if (cancelled) return;
          const seq = buildRevealSequence(entries);
          const now = Date.now();
          setSequence(seq);
          setRevealState(seq.length > 0 ? startReveal(now) : { index: 0, arrivedAtMs: now, done: true });
          setError(false);
        } catch (err) {
          if (cancelled) return;
          console.warn('MemoryLaneScreen: failed to load hive entries', err);
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

  // Rail progress — the mandatory instrument (R118): while a step is
  // blooming this is the only thing on screen saying "not yet," so it has
  // to keep moving even though the tap it is guarding is idle. Resets on
  // every index change because the effect re-runs against the new
  // `revealState` identity `tapReveal` hands back.
  useEffect(() => {
    if (!sequence || !revealState || revealState.done) return;
    const id = setInterval(() => {
      setRailFill(dwellProgress(revealState, Date.now(), sequence, STUB_GRAMMAR));
    }, RAIL_TICK_MS);
    return () => clearInterval(id);
  }, [sequence, revealState]);

  // Bloom entrance. Ruling 3: Reduce Motion substitutes the arrival with a
  // crossfade and leaves the floor (the rail effect above) untouched — the
  // arrival is the only thing that shortens.
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
    // Ruling 2: an early tap comes back referentially identical — nothing
    // to do, and nothing queued for when the floor does pass.
    if (next === revealState) return;
    Haptics.selectionAsync();
    setRailFill(0);
    setRevealState(next);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: cover.base }]}>
        <ActivityIndicator color={theme.colors.ink} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: cover.base }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.closeButton} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={cover.textColor} />
        </PressableScale>
        <Text style={styles.emptyTitle}>We couldn't reach this hive.</Text>
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
        accessibilityLabel="Close memory lane"
      >
        <Ionicons name="close" size={22} color={cover.textColor} />
      </PressableScale>

      {step ? (
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
      ) : (
        <View style={styles.ending}>
          <Text style={[styles.endingTitle, { color: cover.textColor }]}>
            {sequence && sequence.length > 0
              ? `That's every memory of ${subjectName || 'this hive'}, so far.`
              : 'No memories yet.'}
          </Text>
          <PrimaryButton onPress={() => navigation.goBack()}>Return to hive</PrimaryButton>
        </View>
      )}
    </View>
  );
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
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapArea: {
    flex: 1,
  },
  entryFrame: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
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
    backgroundColor: 'rgba(34, 27, 3, 0.5)',
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
