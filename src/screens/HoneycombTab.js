import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { HoneycombStore } from '../services/HoneycombStore';
import { EntryStore } from '../services/EntryStore';
import { toISODate } from '../utils/dateRanges';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { FeedCard } from '../components/FeedCard';
import { HoneycombAuth } from './HoneycombAuth';

const RequestRow = ({ request, onRespond }) => (
  <View style={styles.requestRow}>
    <Text style={styles.requestName}>{request.requester?.display_name ?? 'Someone'} wants to connect</Text>
    <View style={styles.requestActions}>
      <PressableScale onPress={() => onRespond(request.id, false)} style={styles.declineButton}>
        <Text style={styles.declineText}>Decline</Text>
      </PressableScale>
      <PressableScale onPress={() => onRespond(request.id, true)} style={styles.acceptButton}>
        <Text style={styles.acceptText}>Accept</Text>
      </PressableScale>
    </View>
  </View>
);

const HoneycombFeed = () => {
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [connections, setConnections] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [todayEntry, setTodayEntry] = useState(null);
  const [alreadySharedToday, setAlreadySharedToday] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [addEmail, setAddEmail] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState(null);

  const loadAll = useCallback(async () => {
    const today = toISODate(new Date());
    const [feedResult, connectionsResult, requestsResult, entry] = await Promise.all([
      HoneycombStore.listFeed(),
      HoneycombStore.listConnections(),
      HoneycombStore.listIncomingRequests(),
      EntryStore.getEntry(new Date()),
    ]);
    setFeed(feedResult);
    setConnections(connectionsResult);
    setIncomingRequests(requestsResult);
    setTodayEntry(entry);
    setAlreadySharedToday(entry ? await HoneycombStore.hasSharedDate(today) : false);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAll().catch((err) => {
        if (!cancelled) console.warn('Failed to load Honeycomb data', err);
      });
      return () => {
        cancelled = true;
      };
    }, [loadAll])
  );

  const handleAddConnection = async () => {
    const email = addEmail.trim();
    if (!email || addBusy) return;
    setAddBusy(true);
    setAddMessage(null);
    try {
      const profile = await HoneycombStore.findProfileByEmail(email);
      if (!profile) {
        setAddMessage({ tone: 'error', text: "No Honeycomb account with that email yet." });
        return;
      }
      await HoneycombStore.sendConnectionRequest(profile.id);
      setAddMessage({ tone: 'success', text: `Request sent to ${profile.display_name}.` });
      setAddEmail('');
    } catch (err) {
      if (err?.code === '23505') {
        setAddMessage({ tone: 'error', text: 'Already connected or request pending.' });
      } else {
        setAddMessage({ tone: 'error', text: err.message || 'Could not send request.' });
      }
    } finally {
      setAddBusy(false);
    }
  };

  const handleRespond = async (id, accept) => {
    try {
      await HoneycombStore.respondToRequest(id, accept);
      await loadAll();
    } catch (err) {
      console.warn('Failed to respond to request', err);
    }
  };

  const handleShareToday = async () => {
    if (!todayEntry || sharing) return;
    setSharing(true);
    try {
      await HoneycombStore.shareEntry({
        date: toISODate(new Date()),
        text: todayEntry.text,
        theme: todayEntry.theme,
      });
      await loadAll();
    } catch (err) {
      console.warn('Failed to share entry', err);
    } finally {
      setSharing(false);
    }
  };

  const handleLikeToggled = () => {
    loadAll().catch((err) => console.warn('Failed to refresh feed', err));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Honeycomb</Text>

      <View style={styles.addCard}>
        <Text style={styles.sectionLabel}>ADD A CONNECTION</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Their email"
            placeholderTextColor={theme.colors.textSecondary}
            value={addEmail}
            onChangeText={setAddEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!addBusy}
          />
          <PressableScale onPress={handleAddConnection} disabled={!addEmail.trim() || addBusy} style={styles.addButton}>
            <Text style={styles.addButtonText}>{addBusy ? '…' : 'Add'}</Text>
          </PressableScale>
        </View>
        {addMessage && (
          <Text style={[styles.addMessage, addMessage.tone === 'error' && styles.addMessageError]}>
            {addMessage.text}
          </Text>
        )}
        <Text style={styles.connectionsCount}>
          {connections.length} connection{connections.length === 1 ? '' : 's'}
        </Text>
      </View>

      {incomingRequests.length > 0 && (
        <View style={styles.requestsCard}>
          <Text style={styles.sectionLabel}>REQUESTS</Text>
          {incomingRequests.map((request) => (
            <RequestRow key={request.id} request={request} onRespond={handleRespond} />
          ))}
        </View>
      )}

      {todayEntry && !alreadySharedToday && (
        <PrimaryButton onPress={handleShareToday} disabled={sharing} style={styles.shareButton}>
          {sharing ? 'Sharing…' : "Share today's gratitude"}
        </PrimaryButton>
      )}

      {feed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No shared entries yet. Add a connection and share today's gratitude to start your feed.
          </Text>
        </View>
      ) : (
        feed.map((share) => <FeedCard key={share.id} share={share} onLikeToggled={handleLikeToggled} />)
      )}
    </ScrollView>
  );
};

export const HoneycombTab = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return session ? <HoneycombFeed /> : <HoneycombAuth />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 140,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  sectionLabel: {
    ...theme.type.label,
    color: theme.colors.accentDeep,
    marginBottom: 12,
  },
  addCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  addButton: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.background,
  },
  addMessage: {
    ...theme.type.bodySm,
    color: theme.colors.accentDeep,
    marginTop: 10,
  },
  addMessageError: {
    color: theme.colors.danger,
  },
  connectionsCount: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  requestsCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  requestName: {
    ...theme.type.bodySm,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceBorder,
  },
  declineText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  acceptButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
  },
  acceptText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  shareButton: {
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
