import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { EntryStore } from '../services/EntryStore';
import { FlyingBee } from '../components/FlyingBee';

export const TodayTab = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      EntryStore.getEntry(new Date()).then((result) => {
        if (!cancelled) {
          setEntry(result);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.container}>
        {/* §12.2/§14.1: ambient cruise, default-on for Today idle. Never
            sits over the CTA — it's absolutely positioned behind the
            content flow and never intercepts touches (pointerEvents="none"
            throughout FlyingBee). */}
        <FlyingBee active />
        <Text style={styles.header}>Today</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            You haven't completed today's ritual yet. Lock in, reflect, and unlock your day.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.getParent()?.navigate('Lock')}
          >
            <Text style={styles.ctaButtonText}>Start Today's Ritual</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlyingBee active />
      <Text style={styles.header}>Today</Text>
      <View style={styles.quoteCard}>
        <Text style={styles.themeBadge}>{entry.theme}</Text>
        <Text style={styles.gratitudeText}>"{entry.text}"</Text>
      </View>
      <Text style={styles.footerText}>Your apps unlocked when you saved this. See you tomorrow.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  header: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    position: 'absolute',
    top: 70,
  },
  emptyCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyText: {
    ...theme.type.bodyLg,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.tinted(theme.colors.accent),
  },
  ctaButtonText: {
    ...theme.type.button,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  quoteCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  themeBadge: {
    ...theme.type.label,
    color: theme.colors.accentDeep,
    backgroundColor: theme.colors.accentDeep + '1A',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gratitudeText: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
  },
  footerText: {
    ...theme.type.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
});
