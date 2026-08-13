import { supabase } from './supabase';

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

// Notes table caps content at 500 chars (see the notes_content_length
// constraint) — kept here too so the compose screen can block over-length
// input before round-tripping to Postgres for the same answer.
export const NOTE_CONTENT_MAX = 500;

const PARTICIPANT_SELECT =
  'id, content, created_at, read_at, sender_id, recipient_id, sender:profiles!notes_sender_id_fkey(id, display_name, avatar_url), recipient:profiles!notes_recipient_id_fkey(id, display_name, avatar_url)';

export const NotesStore = {
  async sendNote(recipientId, content) {
    const client = requireSupabase();
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Note text is required');
    if (trimmed.length > NOTE_CONTENT_MAX) throw new Error(`Notes are capped at ${NOTE_CONTENT_MAX} characters`);
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('notes')
      .insert({ sender_id: user.id, recipient_id: recipientId, content: trimmed })
      .select(PARTICIPANT_SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async listReceived() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('notes')
      .select(PARTICIPANT_SELECT)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listSent() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('notes')
      .select(PARTICIPANT_SELECT)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Same filter shape as listReceived, but a head-only count query — the
  // tab/header badge polls this on an interval and shouldn't pull the full
  // joined row set (avatars, sender/recipient profiles) just to get a number.
  async countUnread() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { count, error } = await client
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(noteId) {
    const client = requireSupabase();
    const { error } = await client
      .from('notes')
      .update({ read_at: new Date().toISOString() })
      .eq('id', noteId)
      .is('read_at', null);
    if (error) throw error;
  },
};
