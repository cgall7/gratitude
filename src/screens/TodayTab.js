import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { EntryStore } from '../services/EntryStore';

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
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
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
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 17,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: theme.borderRadius.full,
  },
  ctaButtonText: {
    fontFamily: theme.fonts.header,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quoteCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
  },
  themeBadge: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.pop,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  gratitudeText: {
    fontFamily: theme.fonts.body,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    fontStyle: 'italic',
    fontWeight: '300',
  },
  footerText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
});
