import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { AnimatedStat } from '../components/AnimatedStat';
import { GlowOrb } from '../components/GlowOrb';
import { LoadState, LOAD_STATES } from '../components/LoadState';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import { startOfYear, endOfYear, longestStreak } from '../utils/dateRanges';
import { DURATIONS, SPRINGS, useReducedMotion } from '../constants/motion';

const DISMISS_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Beats are grounded on the warm wash, with the closer on sky — washes
// behind the card instead of a flat 12% tint over the whole screen,
// which just muddied the cream.
const SLIDE_WASHES = [
  theme.colors.washYellow,
  theme.colors.washYellow,
  theme.colors.washYellow,
  theme.colors.washSky,
];

// Shown the first time someone opens Wrapped before they have a year of
// real entries, so the screen still demonstrates what it becomes.
const DEMO_SLIDES = [
  {
    title: "Your Year in Gratitude",
    subtitle: "Preview",
    value: "312",
    label: "Moments of reflection",
    color: theme.colors.accent
  },
  {
    title: "Your North Star",
    subtitle: "Top Theme",
    value: "Family",
    label: "The heart of your year",
    color: theme.colors.accentDeep
  },
  {
    title: "Pure Consistency",
    subtitle: "Longest Streak",
    value: "42 Days",
    label: "Unstoppable positivity",
    color: theme.colors.accentDeep
  },
  {
    title: "A Random Memory",
    subtitle: "October 12th",
    value: '"The way the sunlight hit the trees during my morning walk."',
    label: "A spark of joy",
    color: theme.colors.accent
  }
];

const buildSlidesFromEntries = (entries, year) => {
  if (entries.length === 0) return null;
  const insight = dominantTheme(entries);
  const streak = longestStreak(entries);
  const memory = entries[Math.floor(Math.random() * entries.length)];

  return [
    {
      title: "Your Year in Gratitude",
      subtitle: String(year),
      value: String(entries.length),
      label: "Moments of reflection",
      color: theme.colors.accent
    },
    {
      title: "Your North Star",
      subtitle: "Top Theme",
      value: insight.theme,
      label: "The heart of your year",
      color: theme.colors.accentDeep
    },
    {
      title: "Pure Consistency",
      subtitle: "Longest Streak",
      value: `${streak} Day${streak === 1 ? '' : 's'}`,
      label: "Unstoppable positivity",
      color: theme.colors.accentDeep
    },
    {
      title: "A Random Memory",
      subtitle: new Date(memory.date).toLocaleDateString('default', { month: 'long', day: 'numeric' }),
      value: `"${memory.text}"`,
      label: "A spark of joy",
      color: theme.colors.accent
    }
  ];
};

export const PollinateWrapped = ({ onComplete }) => {
  // The read is a Supabase call behind an auth check (P0-2), so it can throw
  // — signed out, offline, a hiccup. `readState` tracks how it ended;
  // `slides` only ever holds a real or demo deck, never a stand-in for
  // failure. Conflating the two was the bug: a rejection left `slides` null
  // forever and the loading spinner never resolved.
  const [readState, setReadState] = useState(LOAD_STATES.LOADING);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState(null);
  const reduced = useReducedMotion();
  // Slides used to hard-cut. This drives a fade + rise on every beat change
  // so Wrapped reads as a sequence rather than a stack of static cards.
  const beat = useRef(new Animated.Value(1)).current;

  // A ref, not the effect's closure `let` — the retry button below calls
  // `load` outside any focus cycle (RecapTab.js:171 is the same shape).
  const cancelledRef = useRef(false);
  const load = useCallback(async () => {
    setReadState(LOAD_STATES.LOADING);
    try {
      const now = new Date();
      const yearEntries = await EntryStore.getEntriesBetween(startOfYear(now), endOfYear(now));
      if (cancelledRef.current) return;
      setSlides(buildSlidesFromEntries(yearEntries, now.getFullYear()) || DEMO_SLIDES);
      setCurrentSlide(0);
      setReadState(LOAD_STATES.READY);
    } catch (err) {
      if (cancelledRef.current) return;
      // Not DEMO_SLIDES: a tester with a real year would be shown a fabricated
      // one in their own voice (§26.5). A failed Wrapped has to say it failed.
      setReadState(LOAD_STATES.UNKNOWN);
      console.warn('Failed to load entries for Wrapped', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cancelledRef.current = false;
      load();
      return () => {
        cancelledRef.current = true;
      };
    }, [load])
  );

  useEffect(() => {
    if (!slides) return;
    beat.setValue(0);
    if (reduced) {
      Animated.timing(beat, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(beat, { toValue: 1, ...SPRINGS.reveal, useNativeDriver: true }).start();
  }, [currentSlide, slides, reduced]);

  if (readState === LOAD_STATES.UNKNOWN) {
    return (
      <View style={styles.loadingContainer}>
        {/* Sage's finding on the first pass: the happy path's only exit is
            advancing past the last slide, which this branch has none of —
            iOS swipe-down / Android back still dismiss, but neither is
            visible. Seeds/Notes' idiom (chevron-down, promoted from
            Account.js) is the ratified visible exit for a modal under the
            global headerShown:false; no ScreenHeader here, so placed
            directly rather than through its left slot. */}
        <TouchableOpacity
          onPress={onComplete}
          hitSlop={DISMISS_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.unknownDismiss}
        >
          <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
        </TouchableOpacity>
        <LoadState
          state={LOAD_STATES.UNKNOWN}
          onRetry={load}
          title="Couldn't reach your year"
          body="Something went wrong on the way to the hive."
          actionLabel="Try again"
          retryAccessibilityLabel="Try loading your Wrapped again"
        />
      </View>
    );
  }

  if (!slides) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  const nextSlide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else if (onComplete) {
      onComplete();
    } else {
      setCurrentSlide(0);
    }
  };

  const slide = slides[currentSlide];
  const rise = beat.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Pressable style={styles.container} onPress={nextSlide}>
      <View style={styles.progressContainer}>
        {slides.map((_, i) => (
          <ProgressSegment key={i} filled={i <= currentSlide} />
        ))}
      </View>

      <View style={styles.slideContent}>
        {/* The beat's own light, keyed to its accent — replaces the flat
            whole-screen tint that used to sit over the cream. */}
        <GlowOrb size={340} color={slide.color} intensity={0.5} style={styles.slideGlow} />

        <Animated.View style={{ opacity: beat, transform: [{ translateY: rise }] }}>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          <Text style={styles.title}>{slide.title}</Text>

          <View style={[styles.valueContainer, { backgroundColor: SLIDE_WASHES[currentSlide % SLIDE_WASHES.length] }]}>
            <AnimatedStat
              key={currentSlide}
              value={slide.value}
              style={[styles.value, { color: slide.color }]}
            />
            <Text style={styles.label}>{slide.label}</Text>
          </View>
        </Animated.View>

        <Text style={styles.tapHint}>
          {currentSlide === slides.length - 1 ? 'Tap to replay' : 'Tap to continue →'}
        </Text>
      </View>
    </Pressable>
  );
};

// Progress segments fill rather than snap, so the story-format bar actually
// tracks the beat you're on.
const ProgressSegment = ({ filled }) => {
  const reduced = useReducedMotion();
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: filled ? 1 : 0,
      duration: reduced ? DURATIONS.reducedMotionFade : DURATIONS.quick,
      useNativeDriver: false,
    }).start();
  }, [filled, reduced]);

  // The unfilled track is `trackDim`, not the 0.15 this shipped with. §23.11
  // ruled this exact component — a progress track on `background` — and ruled
  // 0.15 a DEFECT: it measures 1.36:1 against its own ground where the floor is
  // 3:1, i.e. very nearly invisible. `trackDim` is the ratified 0.5 (3.25:1).
  // A progress indicator is a fraction; without a visible denominator it is a
  // different component.
  const backgroundColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.trackDim, theme.colors.ink],
  });

  return <Animated.View style={[styles.progressBar, { backgroundColor }]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Same top/left the beat progress bar uses (progressContainer, below) —
  // this screen has no ScreenHeader to hang a left slot on.
  unknownDismiss: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    height: 4,
    gap: 8,
    zIndex: 10,
  },
  progressBar: {
    flex: 1,
    borderRadius: 2,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  slideGlow: {
    alignSelf: 'center',
  },
  subtitle: {
    ...theme.type.label,
    textAlign: 'center',
    color: theme.colors.inkSoft,
    fontSize: 15,
    letterSpacing: 4,
    marginBottom: 10,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 48,
  },
  valueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: theme.borderRadius.large,
    width: '100%',
    ...theme.shadows.card,
  },
  value: {
    ...theme.type.display,
    textAlign: 'center',
    marginBottom: 10,
  },
  label: {
    ...theme.type.bodyLg,
    color: theme.colors.textSecondary,
    fontSize: 18,
    textAlign: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 120,
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    opacity: 0.6,
  },
});
