import { supabase } from './supabase';
import { toISODate } from '../utils/dateRanges';

// Private Hives — the client half. Until this file, `private_hives` had a
// full server side (six migrations, live in production) and ZERO readers or
// writers anywhere in `src/`: the hero was a room with no door.
//
// A separate module from EntryStore on purpose. EntryStore's header says it
// only ever touches the personal journal — every one of its six accessors
// carries `.is('hive_id', null)` — and that a hive's rows "will add
// hive-scoped rows later through different call sites". This module is that
// call site (8b.3), not a widening of that one. Hive entries stay in the
// same `entries` table (P0-2's one-date-ordered-set ruling) but are read and
// written exclusively through the methods below.
//
// A separate module from HoneycombStore for the same reason its RLS is
// different: every other table in this schema models a relationship between
// two accounts and its policies are mutual. A private hive is the schema's
// first OWNED entity — owner only, on every action
// (20260815000001_private_hives.sql). Putting it beside the connection graph
// would file it as a social object, which is exactly what it is not.
const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

const requireUserId = async (client) => {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
};

// GUIDES/PRIVATE_HIVE_DESIGN_LANGUAGE.md §1 — the five ids the create-flow
// theme picker and 20260817000002's check constraint both agree on.
export const COVER_THEMES = ['golden-honey', 'sunlit-honey', 'wildflower', 'starlight', 'cream-gold'];
export const REVIEW_CADENCES = ['monthly', 'yearly', 'manual'];
const DEFAULT_COVER_THEME = 'golden-honey';
const DEFAULT_REVIEW_CADENCE = 'yearly';

const toHiveEntry = (row) => ({
  id: row.id,
  hiveId: row.hive_id,
  date: row.entry_date,
  text: row.content,
  theme: row.theme,
  savedAt: row.created_at,
});

export const HiveStore = {
  // The complete creation act against today's schema (§30.9.3): a hive IS
  // its subject's name plus its owner, plus (as of 20260817000002) the
  // cover theme and review cadence 8b.2's flow collects. `subject_profile_id`
  // stays null — it is only ever set when the subject is themselves a
  // registered user, and the Who beat's subject (a child, a parent, a
  // friend) usually has no account and no row anywhere in this schema.
  //
  // No entry is filed into the hive here — the Who beat (Onboarding.js)
  // creates the hive with a bare name and no theme/cadence choice, so both
  // params default rather than require a call-site update there.
  async createHive(subjectName, { coverTheme = DEFAULT_COVER_THEME, reviewCadence = DEFAULT_REVIEW_CADENCE } = {}) {
    const client = requireSupabase();
    const ownerId = await requireUserId(client);
    const name = subjectName.trim();
    // `subject_name text not null` — an empty label is not a hive with a
    // blank name, it is the decline, and the decline writes nothing.
    if (!name) throw new Error('A hive needs a subject name');
    if (!COVER_THEMES.includes(coverTheme)) throw new Error(`Unknown cover theme: ${coverTheme}`);
    if (!REVIEW_CADENCES.includes(reviewCadence)) throw new Error(`Unknown review cadence: ${reviewCadence}`);

    const { data, error } = await client
      .from('private_hives')
      .insert({ owner_id: ownerId, subject_name: name, cover_theme: coverTheme, review_cadence: reviewCadence })
      .select('id, subject_name, cover_theme, review_cadence, created_at')
      .single();
    if (error) throw error;
    return data;
  },

  // Every hive the signed-in user owns, most recently created first, each
  // with its entry count — the Today-tab shelf and the create-flow's "0
  // memories" preview both need the count without a second round trip per
  // card. `private_hives_select_own` (owner only) is the sole authorization
  // surface; the `.eq('owner_id', ownerId)` below is defense in depth, same
  // pattern EntryStore's accessors already use over RLS.
  async listHives() {
    const client = requireSupabase();
    const ownerId = await requireUserId(client);
    const { data: hives, error } = await client
      .from('private_hives')
      .select('id, subject_name, cover_theme, review_cadence, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!hives || hives.length === 0) return [];

    const { data: entryRows, error: countError } = await client
      .from('entries')
      .select('hive_id')
      .eq('user_id', ownerId)
      .not('hive_id', 'is', null);
    if (countError) throw countError;

    const counts = new Map();
    for (const row of entryRows ?? []) {
      counts.set(row.hive_id, (counts.get(row.hive_id) ?? 0) + 1);
    }

    return hives.map((h) => ({
      id: h.id,
      subjectName: h.subject_name,
      coverTheme: h.cover_theme,
      reviewCadence: h.review_cadence,
      createdAt: h.created_at,
      entryCount: counts.get(h.id) ?? 0,
    }));
  },

  async getHive(hiveId) {
    const client = requireSupabase();
    const ownerId = await requireUserId(client);
    const { data, error } = await client
      .from('private_hives')
      .select('id, subject_name, cover_theme, review_cadence, created_at')
      .eq('owner_id', ownerId)
      .eq('id', hiveId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      subjectName: data.subject_name,
      coverTheme: data.cover_theme,
      reviewCadence: data.review_cadence,
      createdAt: data.created_at,
    };
  },

  // Chronological entry list for one hive, most recent first (Design
  // Language §3's Entry List Screen). Scoped to `hive_id = $1` — never
  // `is('hive_id', null)` — that is the entire point of this being a
  // separate module from EntryStore.
  async getHiveEntries(hiveId) {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const { data, error } = await client
      .from('entries')
      .select()
      .eq('user_id', userId)
      .eq('hive_id', hiveId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toHiveEntry);
  },

  // Author can add entries to any (unsealed) hive at any time — no
  // one-row-per-day dedupe. `entries_one_journal_per_day`'s unique index is
  // `where hive_id is null` on purpose (20260815000001's own note), so a
  // hive is its own per-day space with no such cap.
  async addHiveEntry(hiveId, date, text, themeTag) {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const body = text.trim();
    if (!body) throw new Error('An entry needs some text');

    const { data, error } = await client
      .from('entries')
      .insert({ user_id: userId, hive_id: hiveId, content: body, entry_date: toISODate(date), theme: themeTag })
      .select()
      .single();
    if (error) throw error;
    return toHiveEntry(data);
  },
};
