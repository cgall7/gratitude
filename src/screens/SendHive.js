import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { SPRINGS, DURATIONS, useReducedMotion } from '../constants/motion';

// §6 Screen 2 (Review Before Sending) + Screen 3 (Sent Confirmation), per
// Lumen's ruling: §6 Screen 1's friend selector is dead against today's
// schema — the recipient is fixed at hive creation via subject_profile_id
// (confirmed live in HiveStore.js), there is no one to pick — so this
// screen is reached directly from HiveDetail's "Send to [Name]" CTA.
const longDate = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

export const SendHiveScreen = ({ navigation, route }) => {
  const { hiveId, subjectName, coverTheme } = route.params;
  const reduced = useReducedMotion();
  const cover = hiveCoverTheme(coverTheme);

  const [phase, setPhase] = useState('review'); // 'review' | 'sending' | 'sent'
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.6)).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await HiveStore.getHiveEntries(hiveId);
          if (!cancelled) setEntries(list);
        } catch (err) {
          console.warn('SendHiveScreen: failed to load entries', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [hiveId])
  );

  useEffect(() => {
    if (phase !== 'sent') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduced) {
      checkOpacity.setValue(0);
      checkScale.setValue(1);
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
    } else {
      checkOpacity.setValue(0);
      checkScale.setValue(0.6);
      Animated.parallel([
        Animated.spring(checkOpacity, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSend = async () => {
    if (phase === 'sending') return;
    setPhase('sending');
    setError(null);
    try {
      await HiveStore.sendHive(hiveId);
      setPhase('sent');
    } catch (err) {
      console.warn('SendHiveScreen: send_hive failed', err);
      const msg = err?.message ?? '';
      setError(
        /must be sealed/.test(msg)
          ? 'This hive needs to be sealed before it can be sent.'
          : /already been sent/.test(msg)
          ? 'This keepsake has already been sent.'
          : /not a connected friend/.test(msg)
          ? `You and ${subjectName} aren't connected friends right now.`
          : "Couldn't send this keepsake. Check your connection and try again."
      );
      setPhase('review');
    }
  };

  if (phase === 'sent') {
    return (
      <View style={[styles.completeContainer, { backgroundColor: theme.colors.background }]}>
        <Animated.View
          style={[styles.badge, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}
        >
          <Ionicons name="checkmark" size={44} color={theme.colors.ink} />
        </Animated.View>
        <Text style={styles.completeTitle}>Sent to {subjectName} ✨</Text>
        <Text style={styles.completeBody}>They'll see your memories one by one, just as you do.</Text>
        <PrimaryButton onPress={() => navigation.navigate('Main')} containerStyle={styles.doneCta}>
          Done
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { backgroundColor: cover.base }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={cover.textColor} />
        </PressableScale>
        <Text style={[styles.bannerTitle, { color: cover.textColor }]}>Sending to {subjectName}</Text>
        <Text style={[styles.bannerSubtitle, { color: cover.textColor }]}>
          They'll see your memories one by one.
        </Text>
      </View>

      {loading ? (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <Text style={styles.entryDate}>{longDate(entry.date)}</Text>
              <Text style={styles.entryText}>{entry.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <PrimaryButton onPress={handleSend} disabled={loading || phase === 'sending'}>
          {phase === 'sending' ? 'Sending…' : 'Send Keepsake'}
        </PrimaryButton>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backLink} accessibilityLabel="Go back">
          <Text style={styles.backLinkText}>Go Back</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bannerTitle: {
    ...theme.type.h1,
  },
  bannerSubtitle: {
    ...theme.type.bodySm,
    marginTop: 4,
    opacity: 0.85,
  },
  list: {
    padding: 24,
    paddingBottom: 200,
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  entryDate: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  entryText: {
    ...theme.type.body,
    color: theme.colors.ink,
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
  },
  errorText: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  backLinkText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...theme.shadows.floating,
  },
  completeTitle: {
    ...theme.type.h1,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  completeBody: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginBottom: 32,
  },
  doneCta: {
    width: '100%',
  },
});
