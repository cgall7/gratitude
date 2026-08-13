import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HoneycombStore } from '../services/HoneycombStore';
import { PressableScale } from './PressableScale';
import { BeeTransition } from './BeeTransition';
import { Avatar } from './Avatar';

// Like delivery (Sunbeam §11.2): a short lift-off from the heart, carrying
// the like away rather than the long claim-screen traversal. Same glide
// spring, tighter path to match the icon's scale.
const LIKE_PATH = {
  translateX: [-4, 46],
  translateY: [4, -18, -38],
  rotate: ['-6deg', '-22deg'],
};

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
  const [likeFlightKey, setLikeFlightKey] = useState(0);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const wasLiked = share.likedByMe;
    try {
      await HoneycombStore.toggleLike(share.id, share.likedByMe);
      if (!wasLiked) setLikeFlightKey((key) => key + 1);
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

  // §18.1.1: demo shares are keepsakes — readable, never interactive. The
  // paler content is the week-list twin of the grid's paler demo cells, and
  // dropping the actions row (their counts are zeroed by construction) is
  // what keeps a tap from firing toggleLike('demo-N') at Supabase.
  const isDemo = share.isDemo ?? false;

  return (
    <View style={styles.card}>
      <View style={isDemo && styles.demoRegister}>
      <View style={styles.header}>
        <Avatar
          name={share.isOwn ? 'You' : share.author?.display_name ?? 'Someone'}
          avatarUrl={share.author?.avatar_url}
          size={36}
        />
        <View style={styles.headerText}>
          <Text style={styles.author}>{share.isOwn ? 'You' : share.author?.display_name ?? 'Someone'}</Text>
          <Text style={styles.date}>{formatDate(share.entryDate)}</Text>
        </View>
      </View>
      <Text style={styles.content}>"{share.content}"</Text>
      </View>

      {!isDemo && (
      <View style={styles.actionsRow}>
        <PressableScale onPress={handleLike} disabled={liking} style={styles.actionButton}>
          <Ionicons
            name={share.likedByMe ? 'heart' : 'heart-outline'}
            size={18}
            color={share.likedByMe ? theme.colors.accent : theme.colors.textSecondary}
          />
          {share.likeCount > 0 && <Text style={styles.actionText}>{share.likeCount}</Text>}
          <BeeTransition triggerKey={likeFlightKey} path={LIKE_PATH} anchorStyle={styles.likeBeeAnchor} size={13} />
        </PressableScale>

        <PressableScale onPress={toggleComments} style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={17} color={theme.colors.textSecondary} />
          {commentCount > 0 && <Text style={styles.actionText}>{commentCount}</Text>}
        </PressableScale>
      </View>
      )}

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
              placeholder="Say something kind."
              placeholderTextColor={theme.colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              editable={!postingComment}
              maxLength={2000}
            />
            <PressableScale onPress={handlePostComment} disabled={!commentText.trim() || postingComment}>
              <Ionicons name="arrow-up-circle" size={30} color={theme.colors.ink} />
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
  // Demo register, R55's physics applied to the card: the card surface
  // stays opaque and only the CONTENT dims against it, so dimming changes
  // strength, never hue — a translucent white card over Sunlit Honey would
  // drift warm, the exact failure the comb's surface-backing fix killed.
  // 0.7 keeps the quote readable; the number is provisional until Pixel
  // widens §18.1.2's "grid parity" line for cards (Sage's 17:02 ask).
  demoRegister: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
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
  likeBeeAnchor: {
    top: 0,
    left: 0,
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
