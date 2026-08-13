import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { HoneycombStore } from '../services/HoneycombStore';
import { NotesStore, NOTE_CONTENT_MAX } from '../services/NotesStore';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';

// No UI on this screen can make a note sendable in the same session — a
// connection only reaches 'accepted' when the other person taps accept
// (HoneycombStore.respondToRequest) — so the zero-connections state hands
// off to the one action that IS available today (sending the request,
// reusing Honeycomb's own add-card via a route param) rather than offering
// a body with nowhere for the note to go. Pixel's #14 ruling: when there
// are zero connections this replaces TO/NOTE/counter/Send entirely, not
// just the TO slot — and it branches on outgoing requests so a user who's
// already asked isn't shown the same prompt to ask again.
const EmptyConnectionsState = ({ outgoingRequests, onAddPress }) => {
  if (outgoingRequests.length > 0) {
    const title =
      outgoingRequests.length === 1
        ? `Waiting on ${outgoingRequests[0].addressee?.display_name ?? 'them'}.`
        : `Waiting on ${outgoingRequests.length} people.`;
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>Your request is with them. The moment they accept, they'll show up here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No one in your hive yet.</Text>
      <Text style={styles.emptyBody}>
        A note goes to one person, so this needs someone on the other end. Add them by email — they get a request,
        and once they accept you can write to them.
      </Text>
      <PressableScale onPress={onAddPress} style={styles.emptyCardButton} haptic={null}>
        <Ionicons name="person-add-outline" size={16} color={theme.colors.inkSoft} />
        <Text style={styles.emptyCardButtonText}>Add someone to your hive</Text>
      </PressableScale>
    </View>
  );
};

// 7.1/7.4 (no-tip variant): text-only note to one connection. Tip (7.3) and
// image attachment (7.7) aren't built — see the notes migration's header
// comment for why. Recipients come from the same `listConnections` the
// Honeycomb tab uses, so "who can I note?" never drifts from "who's in my
// hive?".
export const ComposeNote = ({ navigation }) => {
  const [connections, setConnections] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [recipientId, setRecipientId] = useState(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoadingConnections(true);
      Promise.all([HoneycombStore.listConnections(), HoneycombStore.listOutgoingRequests()])
        .then(([connectionsList, outgoingList]) => {
          if (!cancelled) {
            setConnections(connectionsList);
            setOutgoingRequests(outgoingList);
          }
        })
        .catch((err) => console.warn('Failed to load connections', err))
        .finally(() => {
          if (!cancelled) setLoadingConnections(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSend = async () => {
    if (!recipientId || !content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await NotesStore.sendNote(recipientId, content);
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to send note', err);
      setError(err.message ?? 'Could not send that note — try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="GRATITUDE NOTE"
          title="Send a note"
          right={
            <PressableScale onPress={() => navigation.goBack()} haptic={null}>
              <Ionicons name="close" size={24} color={theme.colors.inkSoft} />
            </PressableScale>
          }
        />

        {loadingConnections ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : connections.length === 0 ? (
          <EmptyConnectionsState
            outgoingRequests={outgoingRequests}
            onAddPress={() =>
              navigation.navigate('Main', { screen: 'Honeycomb', params: { openAddConnection: true } })
            }
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>TO</Text>
            <View style={styles.recipientRow}>
              {connections.map((person) => (
                <PressableScale
                  key={person.id}
                  onPress={() => setRecipientId(person.id)}
                  style={[styles.recipientChip, recipientId === person.id && styles.recipientChipSelected]}
                >
                  <Avatar name={person.display_name} avatarUrl={person.avatar_url} size={40} />
                  <Text style={styles.recipientName} numberOfLines={1}>
                    {person.display_name}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <Text style={styles.sectionLabel}>NOTE</Text>
            <TextInput
              style={styles.textInput}
              placeholder="I am grateful for..."
              placeholderTextColor={theme.colors.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={NOTE_CONTENT_MAX}
              editable={!sending}
            />
            <Text style={styles.charCount}>
              {content.length}/{NOTE_CONTENT_MAX}
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton onPress={handleSend} disabled={!recipientId || !content.trim() || sending}>
              {sending ? 'Sending…' : 'Send'}
            </PrimaryButton>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWriting,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 64,
  },
  sectionLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 12,
    marginTop: 8,
  },
  loader: {
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    ...theme.type.h3,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  emptyCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyCardButtonText: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.inkSoft,
  },
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  recipientChip: {
    alignItems: 'center',
    width: 68,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recipientChipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.washYellow,
  },
  recipientName: {
    ...theme.type.bodySm,
    color: theme.colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  textInput: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 24,
  },
  error: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginBottom: 16,
  },
});
