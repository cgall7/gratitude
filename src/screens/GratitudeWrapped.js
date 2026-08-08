import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { AnimatedStat } from '../components/AnimatedStat';
import { EntryStore } from '../services/EntryStore';
import { dominantTheme } from '../utils/themeTagger';
import { startOfYear, endOfYear, longestStreak } from '../utils/dateRanges';

const { width, height } = Dimensions.get('window');

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

  if (!slides) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else if (onComplete) {
      onComplete();
    } else {
      setCurrentSlide(0);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.container}
      onPress={nextSlide}
    >
      <View style={styles.progressContainer}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.progressBar, { backgroundColor: i <= currentSlide ? theme.colors.textPrimary : 'rgba(34,27,3,0.15)' }]}
          />
        ))}
      </View>

      <View style={[styles.slideContent, { backgroundColor: slides[currentSlide].color + '20' }]}>
        <Text style={styles.subtitle}>{slides[currentSlide].subtitle}</Text>
        <Text style={styles.title}>{slides[currentSlide].title}</Text>

        <View style={[styles.valueContainer, { borderColor: slides[currentSlide].color + '40' }]}>
          <AnimatedStat
            key={currentSlide}
            value={slides[currentSlide].value}
            style={[styles.value, { color: slides[currentSlide].color }]}
          />
          <Text style={styles.label}>{slides[currentSlide].label}</Text>
        </View>

        <Text style={styles.tapHint}>Tap to continue →</Text>
      </View>
    </TouchableOpacity>
  );
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
    textAlign: 'center',
  },
  subtitle: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    fontSize: 15,
    letterSpacing: 4,
    marginBottom: 10,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 60,
  },
  valueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
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
