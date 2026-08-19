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

// GUIDES/PRIVATE_HIVE_DESIGN_LANGUAGE.md §1 — the four selectable ids the
// create-flow theme picker and 20260817000002's check constraint both agree
// on. `golden-honey` is not one of them — §1's own note reserves it for the
// sealed-state visual (§9's wax seal badge), never a cover a hive is created
// with.
export const COVER_THEMES = ['sunlit-honey', 'wildflower', 'starlight', 'cream-gold'];
export const REVIEW_CADENCES = ['monthly', 'yearly', 'manual'];
const DEFAULT_COVER_THEME = 'sunlit-honey';
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
      .select('id, subject_name, cover_theme, review_cadence, sealed_at, created_at')
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
      .select('id, subject_name, cover_theme, review_cadence, sealed_at, created_at')
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
      sealedAt: h.sealed_at,
      createdAt: h.created_at,
      entryCount: counts.get(h.id) ?? 0,
    }));
  },

  // Carries subject_profile_id + sent_at (beyond what listHives needs) —
  // HiveDetailScreen's seal/send footer (Design Language §5-6) has to
  // derive "has a subject" and "already sent" from this single fetch.
  async getHive(hiveId) {
    const client = requireSupabase();
    const ownerId = await requireUserId(client);
    const { data, error } = await client
      .from('private_hives')
      .select('id, subject_name, subject_profile_id, cover_theme, review_cadence, sealed_at, sent_at, created_at')
      .eq('owner_id', ownerId)
      .eq('id', hiveId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      subjectName: data.subject_name,
      subjectProfileId: data.subject_profile_id,
      coverTheme: data.cover_theme,
      reviewCadence: data.review_cadence,
      sealedAt: data.sealed_at,
      sentAt: data.sent_at,
      createdAt: data.created_at,
    };
  },

  // §5 Screen 3's "Seal This Keepsake" CTA. SECURITY DEFINER RPC
  // (20260819000003) does the sealed_at set + private->packaged entry flip
  // in one transaction — see that migration for why a client-side pair of
  // writes can't be trusted to do the same thing atomically. Postgres error
  // text (owner/already-sealed) passes through `error.message` unchanged;
  // callers show it as-is rather than re-deriving the same two cases.
  async sealHive(hiveId) {
    const client = requireSupabase();
    const { error } = await client.rpc('seal_hive', { p_hive_id: hiveId });
    if (error) throw error;
  },

  // §6 Screen 2's "Send Keepsake" CTA. `send_hive` (20260819000001) is the
  // one existing RPC this wraps — was already live and correct, just never
  // had a caller (the gap this whole thread's Slice 1 review found).
  async sendHive(hiveId) {
    const client = requireSupabase();
    const { error } = await client.rpc('send_hive', { p_hive_id: hiveId });
    if (error) throw error;
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

  // No one-row-per-day dedupe — `entries_one_journal_per_day`'s unique
  // index is `where hive_id is null` on purpose (20260815000001's own
  // note), so a hive is its own per-day space with no such cap.
  //
  // This call does not check sealedAt itself — `entries_insert_own`
  // (20260815000005) rejects the write at the database once a hive is
  // sealed, with `and h.sealed_at is null` in its WITH CHECK. That refusal
  // is a standard Postgres RLS violation (SQLSTATE 42501), not a network
  // failure — callers must gate the UI (HiveDetailScreen hides "+ Add
  // Entry" once `sealedAt` is set) and must not report a 42501 the way
  // they'd report a dropped connection.
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

  // 8b.6 — the recipient's side of the send act (`docs/strategy/
  // Pollinate_Delivery_Slices.md` §8b.5's "Recipient read-access ruling").
  // Reads through the two subject-scoped policies that migration ships —
  // `private_hives_select_as_subject` and `entries_select_as_hive_subject`,
  // both gated on `sent_at is not null` — so an unsealed or unsent hive
  // never surfaces here, and neither method below needs its own sealed/sent
  // guard on top of RLS.
  //
  // NOT CALLABLE YET: `private_hives.sent_at` is "not yet in schema" as of
  // this PR — Fizz's 8b.5 migration ships it, the two policies, and
  // `send_hive`. Until that lands both methods fail with Postgres 42703
  // (undefined column), the expected shape of "the schema hasn't caught up"
  // per `undefined_column_beats_permission_denied` — not a client bug, and
  // not evidence the query is wrong. This branch is written against the
  // exact column/policy names Sage ratified so no rewrite is needed once
  // 8b.5 merges, only a rebase.
  async listReceivedPackages() {
    const client = requireSupabase();
    const subjectId = await requireUserId(client);
    const { data: hives, error } = await client
      .from('private_hives')
      .select('id, owner_id, subject_name, cover_theme, sealed_at, sent_at')
      .eq('subject_profile_id', subjectId)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    if (!hives || hives.length === 0) return [];

    // Sender names, batched — `profiles_select_connections`
    // (20260809000005) is the same policy an incoming request card reads
    // under, and it drops silently (zero rows, not an error) once the
    // sender is unfriended. Missing names below fall back to 'Someone',
    // reusing that migration's own established fallback rather than a
    // second, inconsistent one — see the client note in Sage's spec about
    // read access surviving an unfriend while the profile does not.
    const ownerIds = [...new Set(hives.map((h) => h.owner_id))];
    const { data: senders } = await client.from('profiles').select('id, display_name').in('id', ownerIds);
    const senderNames = new Map((senders ?? []).map((p) => [p.id, p.display_name]));

    return hives.map((h) => ({
      id: h.id,
      subjectName: h.subject_name,
      coverTheme: h.cover_theme,
      sentAt: h.sent_at,
      senderName: senderNames.get(h.owner_id) || 'Someone',
    }));
  },

  // One package: the hive's own facts, its sent entries (chronological,
  // oldest first — `revealSequencer.buildRevealSequence` sorts on `at` too,
  // but a stable input order here keeps the tie-break on `savedAt`/`id`
  // meaningful rather than accidental), and the sender name with the same
  // fallback `listReceivedPackages` uses.
  async getReceivedPackage(hiveId) {
    const client = requireSupabase();
    const subjectId = await requireUserId(client);
    const { data: hive, error } = await client
      .from('private_hives')
      .select('id, owner_id, subject_name, cover_theme, sealed_at, sent_at')
      .eq('id', hiveId)
      .eq('subject_profile_id', subjectId)
      .not('sent_at', 'is', null)
      .maybeSingle();
    if (error) throw error;
    if (!hive) return null;

    const { data: entryRows, error: entriesError } = await client
      .from('entries')
      .select()
      .eq('hive_id', hiveId)
      .eq('visibility', 'sent')
      .order('entry_date', { ascending: true });
    if (entriesError) throw entriesError;

    const { data: sender } = await client
      .from('profiles')
      .select('display_name')
      .eq('id', hive.owner_id)
      .maybeSingle();

    return {
      id: hive.id,
      subjectName: hive.subject_name,
      coverTheme: hive.cover_theme,
      sentAt: hive.sent_at,
      senderName: sender?.display_name || 'Someone',
      entries: (entryRows ?? []).map(toHiveEntry),
    };
  },
};
