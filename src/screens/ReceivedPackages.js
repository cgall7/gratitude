import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadState, LOAD_STATES, resolveListView } from '../components/LoadState';

// 8b.6's discovery surface — the door into `PackageOpen.js`, same job
// `SeedsInbox.js`'s "Received" tab does for seeds (no push notifications
// exist anywhere in this app; every "you were sent something" surface here
// is an in-app inbox, not a system alert, so this follows that precedent
// rather than inventing a first one). Deliberately one list, not Seeds'
// received/sent toggle: a hive's "sent" side already has a home,
// HiveDetail, and showing it twice would be two places to learn one fact.
//
// Backed by `HiveStore.listReceivedPackages`, which is not callable until
// 8b.5 ships `private_hives.sent_at` — see that method's header. This
// screen renders LOADING correctly against that failure today; it has not
// been exercised against real rows because none can exist until the
// migration lands.
const DISMISS_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const PackageRow = ({ pkg, onPress }) => (
  <PressableScale onPress={() => onPress(pkg)} style={styles.row}>
    <Avatar name={pkg.senderName} size={40} />
    <View style={styles.rowText}>
      <Text style={styles.rowName}>{pkg.senderName}</Text>
      <Text style={styles.rowSubject} numberOfLines={1}>
        A hive for {pkg.subjectName}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.colors.inkSoft} />
  </PressableScale>
);

export const ReceivedPackagesScreen = ({ navigation }) => {
  const [packages, setPackages] = useState([]);
  const [readState, setReadState] = useState(LOAD_STATES.LOADING);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const received = await HiveStore.listReceivedPackages();
    setPackages(received);
    setReadState(LOAD_STATES.READY);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().catch((err) => {
        if (cancelled) return;
        console.warn('Failed to load received packages', err);
        setReadState(LOAD_STATES.UNKNOWN);
      });
      return () => {
        cancelled = true;
      };
    }, [load, reloadKey])
  );

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  const listView = resolveListView(readState, packages.length);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="RECEIVED"
          title="Sent to You"
          left={
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={DISMISS_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
            </TouchableOpacity>
          }
        />

        {listView === LOAD_STATES.STALE && (
          <LoadState
            state={LOAD_STATES.STALE}
            onRetry={refetch}
            staleLabel="This list may be out of date."
            staleActionLabel="Refresh"
            retryAccessibilityLabel="Refresh what's been sent to you"
            style={styles.stale}
          />
        )}

        {listView === LOAD_STATES.LOADING && (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        )}

        {listView === LOAD_STATES.UNKNOWN && (
          <LoadState
            state={LOAD_STATES.UNKNOWN}
            onRetry={refetch}
            title="Couldn't reach what's been sent to you"
            body="Something went wrong on the way to the hive."
            actionLabel="Try again"
            retryAccessibilityLabel="Try loading this list again"
          />
        )}

        {listView === LOAD_STATES.EMPTY && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing sent to you yet.</Text>
            <Text style={styles.emptyBody}>A hive someone seals and sends to you will wait here.</Text>
          </View>
        )}

        {(listView === LOAD_STATES.READY || listView === LOAD_STATES.STALE) &&
          packages.map((pkg) => (
            <PackageRow
              key={pkg.id}
              pkg={pkg}
              onPress={(p) => navigation.navigate('PackageOpen', { hiveId: p.id })}
            />
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  stale: {
    marginBottom: 12,
  },
  loader: {
    marginTop: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...theme.type.bodyLg,
    color: theme.colors.textPrimary,
  },
  rowSubject: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
});
