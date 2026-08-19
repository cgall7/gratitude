import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from '../constants/theme';
import { Avatar } from './Avatar';

const formatTimestamp = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// 8b.7 — the announcement half of a send, deliberately the only feed card
// with no `content`. hive_send_events (20260819000002) is content-free by
// construction, so there is nothing here to reveal even by accident: no
// like, no comment, no entry text, just who and when. `event.senderName` /
// `event.recipientName` are pre-resolved by HoneycombStore (display_name of
// a deleted profile is never null — profiles has no delete path today, but
// resolving here rather than trusting an embed keeps this component honest
// about what it actually received).
export const SendEventCard = ({ event }) => {
  const who = event.isSender ? 'You' : event.senderName;
  const whom = event.isRecipient ? 'you' : event.recipientName;
  return (
    <View style={styles.card}>
      <Avatar name={event.senderName} avatarUrl={event.senderAvatarUrl} size={36} />
      <View style={styles.body}>
        <Text style={styles.line}>
          <Text style={styles.name}>{who}</Text>
          <Text style={styles.verb}> sent gratitude to </Text>
          <Text style={styles.name}>{whom}</Text>
          <Text style={styles.verb}>.</Text>
        </Text>
        <Text style={styles.date}>{formatTimestamp(event.createdAt)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  body: {
    flex: 1,
  },
  line: {
    ...theme.type.bodySm,
  },
  name: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  verb: {
    color: theme.colors.textSecondary,
  },
  date: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
