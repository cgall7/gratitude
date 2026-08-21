import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { NotesStore } from '../services/NotesStore';
import { PressableScale } from '../components/PressableScale';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';

// 26pt glyph + 12pt slop each side = a 50pt target, over the 44pt floor.
const DISMISS_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const formatTimestamp = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// One row in either list — direction decides whose name/avatar shows,
// since a sent note's "other person" is the recipient and a received
// note's is the sender.
const NoteRow = ({ note, direction, onPress }) => {
  const person = direction === 'received' ? note.sender : note.recipient;
  const unread = direction === 'received' && !note.read_at;
  return (
    <PressableScale onPress={() => onPress(note)} style={styles.row}>
      <Avatar name={person?.display_name} avatarUrl={person?.avatar_url} size={40} />
      <View style={styles.rowText}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName}>{person?.display_name ?? 'Someone'}</Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {note.content}
        </Text>
      </View>
    </PressableScale>
  );
};

// 7.6's full-screen detail, opened inline here rather than as a separate
// route — one screen already holds the list, so a second navigation hop
// just to show four fields would be more chrome than content.
const NoteDetail = ({ note, direction, onClose }) => {
  const person = direction === 'received' ? note.sender : note.recipient;
  return (
    <View style={styles.detailOverlay}>
      <PressableScale onPress={onClose} style={styles.detailClose} haptic={null}>
        <Ionicons name="close" size={24} color={theme.colors.inkSoft} />
      </PressableScale>
      <View style={styles.detailCard}>
        <Avatar name={person?.display_name} avatarUrl={person?.avatar_url} size={56} />
        <Text style={styles.detailName}>
          {direction === 'received' ? `From ${person?.display_name ?? 'Someone'}` : `To ${person?.display_name ?? 'Someone'}`}
        </Text>
        <Text style={styles.detailTimestamp}>{formatTimestamp(note.created_at)}</Text>
        <Text style={styles.detailContent}>"{note.content}"</Text>
      </View>
    </View>
  );
};

// Project 7, no-tip variant: 7.6 (detail view) folded into the same screen
// as the two lists (7.4's send confirmation lands here via refresh, not a
// push — 7.5 needs push infra this repo doesn't have yet).
export const NotesInbox = ({ navigation }) => {
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNote, setOpenNote] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receivedNotes, sentNotes] = await Promise.all([NotesStore.listReceived(), NotesStore.listSent()]);
      setReceived(receivedNotes);
      setSent(sentNotes);
    } catch (err) {
      console.warn('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleOpen = (note) => {
    setOpenNote(note);
    if (tab === 'received' && !note.read_at) {
      NotesStore.markRead(note.id)
        .then(() => setReceived((list) => list.map((n) => (n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n))))
        .catch((err) => console.warn('Failed to mark note read', err));
    }
  };

  const list = tab === 'received' ? received : sent;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="GRATITUDE NOTES"
          title="Notes"
          left={
            // This screen is a modal over the tab bar with headerShown:false
            // global — this chevron is its only exit (check-modal-dismiss).
            // chevron-down because that is the way the card will go; an X
            // would read as cancel, and putting an inbox away discards
            // nothing. Idiom promoted from Account.js.
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={DISMISS_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
            </TouchableOpacity>
          }
          right={
            <PressableScale onPress={() => navigation.navigate('ComposeNote')} haptic={null}>
              <Ionicons name="add-circle" size={28} color={theme.colors.ink} />
            </PressableScale>
          }
        />

        <View style={styles.tabRow}>
          <PressableScale onPress={() => setTab('received')} style={[styles.tab, tab === 'received' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>Received</Text>
          </PressableScale>
          <PressableScale onPress={() => setTab('sent')} style={[styles.tab, tab === 'sent' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Sent</Text>
          </PressableScale>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{tab === 'received' ? 'No notes yet.' : "You haven't sent any notes."}</Text>
            <Text style={styles.emptyBody}>
              {tab === 'received' ? 'Notes people send you will show up here.' : 'Tap + to send someone a gratitude note.'}
            </Text>
          </View>
        ) : (
          list.map((note) => <NoteRow key={note.id} note={note} direction={tab} onPress={handleOpen} />)
        )}
      </ScrollView>

      {openNote && <NoteDetail note={openNote} direction={tab} onClose={() => setOpenNote(null)} />}
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
    paddingTop: 64,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  tabActive: {
    backgroundColor: theme.colors.washYellow,
    borderColor: theme.colors.accent,
  },
  tabText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.bodySemiBold,
  },
  loader: {
    marginTop: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyTitle: {
    ...theme.type.h3,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  emptyBody: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 14,
    marginBottom: 10,
  },
  rowText: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accentDeep,
  },
  rowPreview: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  detailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailClose: {
    position: 'absolute',
    top: 64,
    right: 24,
  },
  detailCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  detailName: {
    ...theme.type.h3,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  detailTimestamp: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  detailContent: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.textPrimary,
    marginTop: 20,
    textAlign: 'center',
  },
});
