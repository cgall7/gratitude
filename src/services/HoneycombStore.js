import { supabase } from './supabase';

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

// The week query's row cap. Exported so the screen can tell "got everything"
// from "hit the cap": the cap is cut on `created_at` while the window is cut
// on `entry_date`, so a full page means the older end of the week may be
// silently missing and the view should say so.
export const WEEK_FEED_LIMIT = 200;

// One share row → the shape FeedCard and the grid mappers consume. Shared
// by both feed queries so the two views can never drift apart on fields.
const toFeedShare = (share, userId) => ({
  id: share.id,
  createdAt: share.created_at,
  authorId: share.user_id,
  isOwn: share.user_id === userId,
  author: share.author,
  content: share.entries?.content,
  entryDate: share.entries?.entry_date,
  likeCount: share.likes?.length ?? 0,
  likedByMe: (share.likes ?? []).some((like) => like.user_id === userId),
  commentCount: share.comments?.[0]?.count ?? 0,
});

export const HoneycombStore = {
  // --- Auth -----------------------------------------------------------
  async signUp(email, password, displayName) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  // --- Connections ------------------------------------------------------
  async findProfileByEmail(email) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('find_connectable_profile', {
      lookup_email: email.trim().toLowerCase(),
    });
    if (error) throw error;
    return data?.[0] ?? null;
  },

  async sendConnectionRequest(addresseeId) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { error } = await client
      .from('honeycomb_connections')
      .insert({ requester_id: user.id, addressee_id: addresseeId });
    if (error) throw error;
  },

  async respondToRequest(connectionId, accept) {
    const client = requireSupabase();
    if (!accept) {
      const { error } = await client.from('honeycomb_connections').delete().eq('id', connectionId);
      if (error) throw error;
      return;
    }
    const { error } = await client
      .from('honeycomb_connections')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', connectionId);
    if (error) throw error;
  },

  // Only the addressee can move a row to 'blocked' (connections_update_addressee
  // policy) — this only ever fires from an incoming request, never against an
  // existing accepted connection you didn't originate. The row stays (not
  // deleted), so `unique_pair` blocks the same requester from re-adding you.
  async blockRequest(connectionId) {
    const client = requireSupabase();
    const { error } = await client
      .from('honeycomb_connections')
      .update({ status: 'blocked', responded_at: new Date().toISOString() })
      .eq('id', connectionId);
    if (error) throw error;
  },

  async listIncomingRequests() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('honeycomb_connections')
      .select('id, created_at, requester:profiles!honeycomb_connections_requester_id_fkey(id, display_name)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listConnections() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('honeycomb_connections')
      .select(
        'id, requester_id, addressee_id, requester:profiles!honeycomb_connections_requester_id_fkey(id, display_name), addressee:profiles!honeycomb_connections_addressee_id_fkey(id, display_name)'
      )
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (error) throw error;
    return (data ?? []).map((row) => (row.requester_id === user.id ? row.addressee : row.requester));
  },

  // Project 6.7 — facts, not derived states (see the migration comment for
  // why). Each row is { member_id, display_name, avatar_url, last_entry_date,
  // last_note_received_at } for one accepted connection. Callers derive
  // `blooming` with src/utils/hiveState.js; `active` was struck from MVP1
  // entirely (R59, thread e10d0fed) — the Today comb's own membership filter
  // already is "posted today," so a treatment true of every cell it can draw
  // is not a signal. last_entry_date still ships as a plain fact (e.g. "last
  // shared N days ago"), just not as an Active-state input.
  async listHiveState() {
    const client = requireSupabase();
    const { data, error } = await client.rpc('list_hive_state');
    if (error) throw error;
    return data ?? [];
  },

  // --- Entries & sharing -----------------------------------------------
  async shareEntry({ date, text, theme }) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();

    const { data: entry, error: entryError } = await client
      .from('entries')
      .insert({ user_id: user.id, content: text, entry_date: date })
      .select()
      .single();
    if (entryError) throw entryError;

    const { error: shareError } = await client.from('shares').insert({ entry_id: entry.id, user_id: user.id });
    if (shareError) throw shareError;
  },

  // Was `.from('entries').select('id, shares(id)').eq('entry_date', date)
  // .limit(1)` with no `.order()` — correct only while one entry per day
  // was guaranteed. P0-2 (entries_hive_visibility migration) lifts that
  // guarantee, so `.limit(1)` reads an unordered index and returns
  // whichever row Postgres happens to store first — not random, reliably
  // wrong: with no journal-then-share write order, that's consistently
  // the day's first-inserted row, not the shared one (Sage measured 12/12
  // runs, thread 19e90cf8, 2026-08-13). has_shared_date checks existence
  // directly instead of reading one row's shares embed.
  async hasSharedDate(date) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('has_shared_date', { p_date: date });
    if (error) throw error;
    return Boolean(data);
  },

  // --- Feed ---------------------------------------------------------------
  async listFeed() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('shares')
      .select(
        'id, created_at, user_id, author:profiles(display_name, avatar_url), entries(content, entry_date), likes(user_id), comments(count)'
      )
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((share) => toFeedShare(share, user.id));
  },

  // The last-7-days window for the hive's week view. Filters on
  // `entries.entry_date` — the day the gratitude is *about* — because
  // that's the key the week view groups under; filtering on `created_at`
  // instead could let a share slip into the window while its day header
  // falls outside it. The `!inner` join is what makes the `.gte()` prune
  // parent share rows rather than just nulling out the embed.
  async listFeedSince(sinceISO) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('shares')
      .select(
        'id, created_at, user_id, author:profiles(display_name, avatar_url), entries!inner(content, entry_date), likes(user_id), comments(count)'
      )
      .gte('entries.entry_date', sinceISO)
      .order('created_at', { ascending: false })
      .limit(WEEK_FEED_LIMIT);
    if (error) throw error;
    return (data ?? []).map((share) => toFeedShare(share, user.id));
  },

  async toggleLike(shareId, currentlyLiked) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (currentlyLiked) {
      const { error } = await client.from('likes').delete().eq('share_id', shareId).eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('likes').insert({ share_id: shareId, user_id: user.id });
      if (error) throw error;
    }
  },

  async listComments(shareId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('comments')
      .select('id, content, created_at, author:profiles(display_name)')
      .eq('share_id', shareId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addComment(shareId, content) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { error } = await client.from('comments').insert({ share_id: shareId, user_id: user.id, content });
    if (error) throw error;
  },
};
