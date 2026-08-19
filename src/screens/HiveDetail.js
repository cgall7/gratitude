import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { hiveCoverTheme } from '../constants/hiveThemes';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';

const longDate = (isoDate) => {
  // entry_date is a plain 'YYYY-MM-DD' — parsing it as local midnight
  // (matching dateRanges.js's own convention) avoids the off-by-one a bare
  // `new Date(isoDate)` gets from parsing it as UTC midnight instead.
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

// 8b.3 — entry list for one hive (Design Language §3). Read/write-only for
// this PR: no seal button here yet (8b.5 is merge-gated on migrations
// …000003–000006 landing on prod) and no edit-in-place (not in 8b.3's
// literal scope — "Author can add entries ... Entry list view with
// chronological ordering").
export const HiveDetailScreen = ({ navigation, route }) => {
  const { hiveId } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hive, setHive] = useState(null);
  const [entries, setEntries] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [hiveData, entryList] = await Promise.all([
            HiveStore.getHive(hiveId),
            HiveStore.getHiveEntries(hiveId),
          ]);
          if (cancelled) return;
          setError(false);
          setHive(hiveData);
          setEntries(entryList);
        } catch (err) {
          if (cancelled) return;
          console.warn('HiveDetailScreen: failed to load hive', err);
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (error || !hive) {
    return (
      <View style={[styles.container, styles.centered]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButtonFloating}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
        </PressableScale>
        <Text style={styles.emptyTitle}>We couldn't reach this hive.</Text>
        <Text style={styles.emptyBody}>Check your connection and try again.</Text>
      </View>
    );
  }

  const cover = hiveCoverTheme(hive.coverTheme);
  const memoryLabel = entries.length === 1 ? '1 memory' : `${entries.length} memories`;

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { backgroundColor: cover.base }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={cover.textColor} />
        </PressableScale>
        <Text style={[styles.bannerName, { color: cover.textColor }]}>{hive.subjectName}</Text>
        <Text style={[styles.bannerCount, { color: cover.textColor }]}>{memoryLabel}</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyTitle}>No memories yet.</Text>
            <Text style={styles.emptyBody}>Add the first one whenever you're ready.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <Text style={styles.entryDate}>{longDate(item.date)}</Text>
            <Text style={styles.entryText} numberOfLines={4}>
              {item.text}
            </Text>
          </View>
        )}
      />

      {hive.sealedAt ? (
        <View style={styles.footer}>
          <Text style={styles.sealedNote}>This hive is sealed — entries are read-only.</Text>
        </View>
      ) : (
        <View style={styles.footer}>
          <PrimaryButton
            onPress={() => navigation.navigate('ComposeHiveEntry', { hiveId, subjectName: hive.subjectName })}
          >
            + Add Entry
          </PrimaryButton>
        </View>
      )}
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
    padding: 24,
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
  backButtonFloating: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  bannerName: {
    ...theme.type.h1,
  },
  bannerCount: {
    ...theme.type.bodySm,
    marginTop: 4,
  },
  list: {
    padding: 24,
    paddingBottom: 120,
  },
  emptyList: {
    alignItems: 'center',
    paddingTop: 48,
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
  sealedNote: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
