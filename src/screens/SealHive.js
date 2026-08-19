import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator, Animated, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { KeepsakeBee } from '../components/KeepsakeBee';
import { CelebrationRays } from '../components/CelebrationRays';
import { SPRINGS, DURATIONS, useReducedMotion } from '../constants/motion';

// §5 Screen 3 (Preview Package) + Screen 4 (Seal Complete), condensed per
// Lumen's ruling (thread b57ad406, 2026-08-19): §5 Screen 1's entry
// curation is cut for Slice 1 (seal packages every entry, no checkbox UI —
// a named MVP cut, not a smuggled shortcut) and §5 Screen 2's personal
// note is folded into this preview rather than its own screen. CTA calls
// the seal_hive() RPC (20260819000003) — the atomic sealed_at-set +
// private->packaged flip that closes the gap Fizz found: without it, a
// bare confirm dialog on the old client-settable sealed_at column would
// have sealed a hive and delivered zero visible entries downstream.
const longDate = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

export const SealHiveScreen = ({ navigation, route }) => {
  const { hiveId, subjectName, coverTheme } = route.params;
  const reduced = useReducedMotion();
  const cover = hiveCoverTheme(coverTheme);

  const [phase, setPhase] = useState('preview'); // 'preview' | 'sealing' | 'complete'
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.6)).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await HiveStore.getHiveEntries(hiveId);
          if (!cancelled) setEntries(list);
        } catch (err) {
          console.warn('SealHiveScreen: failed to load entries', err);
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
    if (phase !== 'complete') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduced) {
      badgeOpacity.setValue(0);
      badgeScale.setValue(1);
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
    } else {
      badgeOpacity.setValue(0);
      badgeScale.setValue(0.6);
      Animated.parallel([
        Animated.spring(badgeOpacity, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true }),
      ]).start();
    }
    const t = setTimeout(() => navigation.navigate('Main'), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // §5 Screen 4: "auto-dismiss or wait for tap" — this is the tap half.
  const handleDismissComplete = () => navigation.navigate('Main');

  const handleSeal = async () => {
    if (phase === 'sealing') return;
    setPhase('sealing');
    setError(null);
    try {
      await HiveStore.sealHive(hiveId);
      setPhase('complete');
    } catch (err) {
      console.warn('SealHiveScreen: seal_hive failed', err);
      setError(
        /already been sealed/.test(err?.message ?? '')
          ? 'This hive is already sealed.'
          : "Couldn't seal this hive. Check your connection and try again."
      );
      setPhase('preview');
    }
  };

  if (phase === 'complete') {
    return (
      <Pressable
        style={[styles.completeContainer, { backgroundColor: cover.base }]}
        onPress={handleDismissComplete}
        accessibilityLabel="Sealed. Tap to continue."
      >
        <View style={styles.badgeStage}>
          <View pointerEvents="none" style={styles.raysStage}>
            <CelebrationRays />
          </View>
          <Animated.View
            style={[styles.badge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}
          >
            <KeepsakeBee size={52} />
          </Animated.View>
        </View>
        <Text style={[styles.completeTitle, { color: cover.textColor }]}>{subjectName}, your memories are sealed.</Text>
        <Text style={[styles.completeBody, { color: cover.textColor }]}>
          This keepsake is yours to keep and give whenever you're ready.
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { backgroundColor: cover.base }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={cover.textColor} />
        </PressableScale>
        <Text style={[styles.bannerTitle, { color: cover.textColor }]}>Here's what you're sealing.</Text>
      </View>

      {loading ? (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.noteLabel}>Add a personal message (optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder={`Leave yourself or ${subjectName} a note about these memories.`}
            placeholderTextColor={theme.colors.inkSoft}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={2000}
          />
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
        <PrimaryButton onPress={handleSeal} disabled={loading || phase === 'sealing' || entries.length === 0}>
          {phase === 'sealing' ? 'Sealing…' : 'Seal This Keepsake'}
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
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bannerTitle: {
    ...theme.type.h1,
  },
  list: {
    padding: 24,
    paddingBottom: 220,
  },
  noteLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  noteInput: {
    ...theme.type.body,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    textAlignVertical: 'top',
    marginBottom: 20,
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
  badgeStage: {
    position: 'relative',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  raysStage: {
    position: 'absolute',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.goldField,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.floating,
  },
  completeTitle: {
    ...theme.type.h1,
    textAlign: 'center',
    marginBottom: 12,
  },
  completeBody: {
    ...theme.type.body,
    textAlign: 'center',
    opacity: 0.85,
  },
});
