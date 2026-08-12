import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Animated, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { AnimatedStat } from '../components/AnimatedStat';
import { GlowOrb } from '../components/GlowOrb';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import { startOfYear, endOfYear, longestStreak } from '../utils/dateRanges';
import { DURATIONS, SPRINGS, useReducedMotion } from '../constants/motion';

// Each beat gets its own wash behind the card instead of a flat 12% tint
// over the whole screen, which just muddied the cream.
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

export const GratitudeWrapped = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState(null);
  const reduced = useReducedMotion();
  // Slides used to hard-cut. This drives a fade + rise on every beat change
  // so Wrapped reads as a sequence rather than a stack of static cards.
  const beat = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = new Date();
        const yearEntries = await EntryStore.getEntriesBetween(startOfYear(now), endOfYear(now));
        if (cancelled) return;
        setSlides(buildSlidesFromEntries(yearEntries, now.getFullYear()) || DEMO_SLIDES);
        setCurrentSlide(0);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
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

  const backgroundColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(34,27,3,0.15)', theme.colors.ink],
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
