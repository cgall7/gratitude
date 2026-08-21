import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { HoneycombStore } from '../services/HoneycombStore';
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

// 8b.3 — entry list for one hive (Design Language §3), plus the seal/send
// entry points (§5-6, thread b57ad406 2026-08-19 — the gap found after
// 8b.2-8b.7 shipped with no way to trigger any of it). No edit-in-place
// (not in 8b.3's literal scope — "Author can add entries ... Entry list
// view with chronological ordering").
export const HiveDetailScreen = ({ navigation, route }) => {
  const { hiveId } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hive, setHive] = useState(null);
  const [entries, setEntries] = useState([]);
  // §11 "Send only works for connected friends" — the subject may be a
  // registered profile who has since unfriended, or was never one to begin
  // with. Only fetched when it could matter (sealed, has a subject, not
  // sent yet) so an unsealed hive's screen never pays for a connections
  // round trip it can't use.
  const [subjectIsFriend, setSubjectIsFriend] = useState(false);

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

          if (hiveData?.sealedAt && hiveData?.subjectProfileId && !hiveData?.sentAt) {
            const connections = await HoneycombStore.listConnections();
            if (cancelled) return;
            setSubjectIsFriend(connections.some((c) => c.id === hiveData.subjectProfileId));
          } else {
            setSubjectIsFriend(false);
          }
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

      {entries.length > 0 && (
        <PressableScale
          onPress={() =>
            navigation.navigate('MemoryLane', {
              hiveId,
              subjectName: hive.subjectName,
              coverTheme: hive.coverTheme,
            })
          }
          style={styles.memoryLaneRow}
          containerStyle={styles.memoryLaneContainer}
          accessibilityLabel="Take a trip down memory lane"
        >
          <View style={styles.memoryLaneContent}>
            <Ionicons name="sparkles" size={18} color={theme.colors.accentDeep} />
            <Text style={styles.memoryLaneText}>Trip Down Memory Lane</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.inkSoft} />
        </PressableScale>
      )}

      {!hive.sealedAt && entries.length > 0 && (
        <PressableScale
          onPress={() =>
            navigation.navigate('SealHive', {
              hiveId,
              subjectName: hive.subjectName,
              coverTheme: hive.coverTheme,
            })
          }
          style={styles.memoryLaneRow}
          containerStyle={styles.memoryLaneContainer}
          accessibilityLabel="Seal this keepsake"
        >
          <View style={styles.memoryLaneContent}>
            <Ionicons name="lock-closed" size={18} color={theme.colors.accentDeep} />
            <Text style={styles.memoryLaneText}>Seal This Keepsake</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.inkSoft} />
        </PressableScale>
      )}

      {hive.sealedAt && subjectIsFriend && (
        <PressableScale
          onPress={() =>
            navigation.navigate('SendHive', {
              hiveId,
              subjectName: hive.subjectName,
              coverTheme: hive.coverTheme,
            })
          }
          style={styles.memoryLaneRow}
          containerStyle={styles.memoryLaneContainer}
          accessibilityLabel={`Send to ${hive.subjectName}`}
        >
          <View style={styles.memoryLaneContent}>
            <Ionicons name="paper-plane" size={18} color={theme.colors.accentDeep} />
            <Text style={styles.memoryLaneText}>Send to {hive.subjectName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.inkSoft} />
        </PressableScale>
      )}

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
          <Text style={styles.sealedNote}>
            {hive.sentAt ? `Sent to ${hive.subjectName}.` : 'This hive is sealed — entries are read-only.'}
          </Text>
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
    backgroundColor: theme.colors.glassFill,
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
  memoryLaneContainer: {
    marginHorizontal: 24,
    marginTop: 16,
  },
  memoryLaneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  memoryLaneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memoryLaneText: {
    ...theme.type.bodySm,
    color: theme.colors.ink,
    fontFamily: theme.fonts.bodySemiBold,
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
