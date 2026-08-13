import { supabase } from './supabase';

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

// seed_contents caps content at 500 chars (see the seed_content_length
// constraint) — kept here too so the compose screen can block over-length
// input before round-tripping to Postgres for the same answer. Matches
// NOTE_CONTENT_MAX: a seed is a note that arrives late, not a longer one.
export const SEED_CONTENT_MAX = 500;

// `content` is **what you may read right now** — not whether the seed is
// sealed. Use `hasBloomed(seed)` for that; see §22.1.
//
// I originally wrote that a null `content` *was* the sealed state. It isn't,
// and three paths on this file disprove it: a seed you SENT returns its text
// while still sealed (the select policy names `sender_id` with no bloom
// condition), `plantSeed` used to return null for a seed the caller had just
// typed, and a broken or renamed embed also lands on null. An absence carries
// the union of every reason it could be absent, so it cannot identify one of
// them. `bloom_at` is a positive fact, present on every row either list
// returns, and it is the thing to branch on.
//
// Corollary worth knowing before you write a view: `hasBloomed(seed) &&
// content == null` has no legitimate meaning. It is a clock disagreement or a
// broken embed — render sealed and refetch, never an error, never an opened
// seal over nothing.
const SEED_SELECT =
  'id, bloom_at, created_at, opened_at, sender_id, recipient_id, ' +
  'sender:profiles!seeds_sender_id_fkey(id, display_name, avatar_url), ' +
  'recipient:profiles!seeds_recipient_id_fkey(id, display_name, avatar_url), ' +
  'seed_contents(content)';

// PostgREST returns a to-one embed as an object and a to-many as an array,
// and which one it picks depends on how it reads the FK. Normalise here so
// nothing downstream has to care, and drop the join table out of the shape
// the screens see.
const shapeSeed = (row) => {
  if (!row) return row;
  const { seed_contents: contents, ...seed } = row;
  const held = Array.isArray(contents) ? contents[0] : contents;
  return { ...seed, content: held?.content ?? null };
};

/** True once a seed's bloom date has passed. Derived, never stored — see the
 *  seeds migration for why there is no `status` column to read instead. */
export const hasBloomed = (seed, at = Date.now()) =>
  !!seed?.bloom_at && new Date(seed.bloom_at).getTime() <= at;

export const SeedsStore = {
  async plantSeed(recipientId, content, bloomAt) {
    const client = requireSupabase();
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Seed text is required');
    if (trimmed.length > SEED_CONTENT_MAX) throw new Error(`Seeds are capped at ${SEED_CONTENT_MAX} characters`);
    const bloom = bloomAt instanceof Date ? bloomAt : new Date(bloomAt);
    if (Number.isNaN(bloom.getTime())) throw new Error('Pick a date for this seed to bloom');
    if (bloom.getTime() <= Date.now()) throw new Error('A seed has to bloom in the future');

    // One RPC, not two inserts: `seeds` and `seed_contents` have no INSERT
    // policy, so this function is the only way in, and it writes both rows in
    // one transaction — there is no path that leaves an empty envelope.
    const { data, error } = await client.rpc('plant_seed', {
      p_recipient_id: recipientId,
      p_content: trimmed,
      p_bloom_at: bloom.toISOString(),
    });
    if (error) throw error;
    // `plant_seed` is declared `returns public.seeds`, and that table has no
    // `seed_contents` column — so no shape PostgREST can produce from it
    // carries the embed, and shaping `data` alone would hand back
    // `content: null` for text the caller typed a millisecond ago. That value
    // would then disagree with `listSent()`, which returns the same row's text
    // on the very next read. Splice in what we already hold; it isn't a
    // fabrication, it's the string we just sent.
    return shapeSeed({ ...data, seed_contents: { content: trimmed } });
  },

  async listReceived() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('seeds')
      .select(SEED_SELECT)
      .eq('recipient_id', user.id)
      // Soonest to open first: what the Hive leads with is what blooms next.
      .order('bloom_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(shapeSeed);
  },

  async listSent() {
    const client = requireSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { data, error } = await client
      .from('seeds')
      .select(SEED_SELECT)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(shapeSeed);
  },

  /** Marks a bloomed seed as opened by its recipient (8.11 hangs off this).
   *  Postgres refuses this before bloom — see seeds_recipient_open_only. */
  async markOpened(seedId) {
    const client = requireSupabase();
    const { error } = await client
      .from('seeds')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', seedId)
      .is('opened_at', null);
    if (error) throw error;
  },

  /** Un-plants a seed the caller sent. Postgres refuses once it has bloomed
   *  — see seeds_delete_sender_before_bloom. */
  async unplantSeed(seedId) {
    const client = requireSupabase();
    const { error } = await client.from('seeds').delete().eq('id', seedId);
    if (error) throw error;
  },
};
