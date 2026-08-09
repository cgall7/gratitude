import { supabase } from './supabase';

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

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

  async hasSharedDate(date) {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('entries')
      .select('id, shares(id)')
      .eq('user_id', user.id)
      .eq('entry_date', date)
      .limit(1);
    if (error) throw error;
    // shares(id) is a to-one embed (unique entry_id) — PostgREST returns an
    // object, not an array, so `.length` is always undefined here.
    return Boolean(data?.[0]?.shares?.id);
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
    return (data ?? []).map((share) => ({
      id: share.id,
      createdAt: share.created_at,
      isOwn: share.user_id === user.id,
      author: share.author,
      content: share.entries?.content,
      entryDate: share.entries?.entry_date,
      likeCount: share.likes?.length ?? 0,
      likedByMe: (share.likes ?? []).some((like) => like.user_id === user.id),
      commentCount: share.comments?.[0]?.count ?? 0,
    }));
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
