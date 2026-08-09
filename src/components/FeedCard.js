import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HoneycombStore } from '../services/HoneycombStore';
import { PressableScale } from './PressableScale';

const formatDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// One shared gratitude entry in the Honeycomb feed: author, date, the text
// itself, then like + comment underneath — same shape as the Venmo-style
// public-transaction feel Colin described.
export const FeedCard = ({ share, onLikeToggled }) => {
  const [liking, setLiking] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentCount, setCommentCount] = useState(share.commentCount);
  const [postingComment, setPostingComment] = useState(false);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      await HoneycombStore.toggleLike(share.id, share.likedByMe);
      onLikeToggled(share.id);
    } catch (err) {
      console.warn('Failed to toggle like', err);
    } finally {
      setLiking(false);
    }
  };

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      try {
        setComments(await HoneycombStore.listComments(share.id));
      } catch (err) {
        console.warn('Failed to load comments', err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handlePostComment = async () => {
    const content = commentText.trim();
    if (!content || postingComment) return;
    setPostingComment(true);
    try {
      await HoneycombStore.addComment(share.id, content);
      setComments(await HoneycombStore.listComments(share.id));
      setCommentCount((count) => count + 1);
      setCommentText('');
    } catch (err) {
      console.warn('Failed to post comment', err);
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>{share.isOwn ? 'You' : share.author?.display_name ?? 'Someone'}</Text>
        <Text style={styles.date}>{formatDate(share.entryDate)}</Text>
      </View>
      <Text style={styles.content}>"{share.content}"</Text>

      <View style={styles.actionsRow}>
        <PressableScale onPress={handleLike} disabled={liking} style={styles.actionButton}>
          <Ionicons
            name={share.likedByMe ? 'heart' : 'heart-outline'}
            size={18}
            color={share.likedByMe ? theme.colors.accentDeep : theme.colors.textSecondary}
          />
          <Text style={styles.actionText}>{share.likeCount}</Text>
        </PressableScale>

        <PressableScale onPress={toggleComments} style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={17} color={theme.colors.textSecondary} />
          <Text style={styles.actionText}>{commentCount}</Text>
        </PressableScale>
      </View>

      {commentsOpen && (
        <View style={styles.commentsSection}>
          {loadingComments ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                <Text style={styles.commentAuthor}>{comment.author?.display_name ?? 'Someone'}</Text>
                <Text style={styles.commentText}>{comment.content}</Text>
              </View>
            ))
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment…"
              placeholderTextColor={theme.colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              editable={!postingComment}
            />
            <PressableScale onPress={handlePostComment} disabled={!commentText.trim() || postingComment}>
              <Ionicons name="arrow-up-circle" size={30} color={theme.colors.accentDeep} />
            </PressableScale>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  author: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  date: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  content: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.textPrimary,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
  },
  commentsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceBorder,
    gap: 10,
  },
  commentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  commentAuthor: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  commentText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
