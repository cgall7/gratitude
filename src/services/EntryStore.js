import { supabase } from './supabase';
import { toISODate } from '../utils/dateRanges';
import { buildDemoEntries } from '../utils/demoSeed';
import { DEMO_CONTENT } from '../constants/demoMode';

// Supabase-backed as of P0-2 (thread 19e90cf8) — was a single AsyncStorage
// key with no user_id, so a year of entries lived on exactly one phone and
// signing in as someone else on the same device rendered the previous
// account's journal. Call sites are unchanged: every screen only ever
// talked to EntryStore's methods, never AsyncStorage directly, which is
// exactly what made this swap possible without touching them.
//
// hive_id is always null here — every method below only reads/writes the
// personal journal (hive_id is null). Private Hives (Project 8b, not built
// yet) will add hive-scoped rows later through different call sites; this
// module predates that and was never asked to handle it.
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

const toEntry = (row) => ({
  id: row.id,
  date: row.entry_date,
  text: row.content,
  theme: row.theme,
  savedAt: row.created_at,
  visibility: row.visibility,
});

export const EntryStore = {
  // One row per day: finds today's existing personal-journal row and
  // updates it, or inserts a new one. Matches the AsyncStorage version's
  // overwrite-on-resave behavior — editing the same day's entry twice
  // was never two entries, and shareEntry (HoneycombStore.js) depends on
  // there being exactly one row per day to share, not a second copy.
  async saveEntry(date, text, themeTag) {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const key = toISODate(date);

    const { data: existing, error: findError } = await client
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .eq('entry_date', key)
      .is('hive_id', null)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { data, error } = await client
        .from('entries')
        .update({ content: text, theme: themeTag })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return toEntry(data);
    }

    const { data, error } = await client
      .from('entries')
      .insert({ user_id: userId, content: text, entry_date: key, theme: themeTag })
      .select()
      .single();
    if (error) throw error;
    return toEntry(data);
  },

  async getEntry(date) {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const key = toISODate(date);
    const { data, error } = await client
      .from('entries')
      .select()
      .eq('user_id', userId)
      .eq('entry_date', key)
      .is('hive_id', null)
      .maybeSingle();
    if (error) throw error;
    return data ? toEntry(data) : null;
  },

  // Sorted ascending by date.
  async getAllEntries() {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const { data, error } = await client
      .from('entries')
      .select()
      .eq('user_id', userId)
      .is('hive_id', null)
      .order('entry_date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toEntry);
  },

  // The user's first journal day, as a plain 'YYYY-MM-DD' string, or null if
  // they have never written one. Its own query rather than
  // `getAllEntries()[0]`: this runs on the writing screen's mount, and a
  // user with two years of entries would otherwise pull ~700 rows across the
  // wire to read one date off the front. `limit(1)` on the same index the
  // ascending order already uses.
  //
  // Consumed by the daily prompt (src/constants/prompts.js): the first three
  // days are seniority-based before the day-of-year rotation takes over.
  async getFirstEntryDate() {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const { data, error } = await client
      .from('entries')
      .select('entry_date')
      .eq('user_id', userId)
      .is('hive_id', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.entry_date ?? null;
  },

  async getEntriesBetween(startDate, endDate) {
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const start = toISODate(startDate);
    const end = toISODate(endDate);
    const { data, error } = await client
      .from('entries')
      .select()
      .eq('user_id', userId)
      .is('hive_id', null)
      .gte('entry_date', start)
      .lte('entry_date', end)
      .order('entry_date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toEntry);
  },

  // Demo/dev only — fills the last `days` consecutive days with realistic
  // entries so Wrapped/Recap have something worth demoing. Merges on top of
  // whatever's already stored: only inserts into dates this user has no
  // journal entry for yet, never overwrites what a tester actually wrote
  // (R12: Pixel).
  async seedDemoData(days = 180) {
    // The capability guard, not just the button (Sage, thread 4510c5c8):
    // the CoreRitual button that calls this is DEMO_CONTENT-gated, but the
    // handler sits lexically outside that guard, and a future caller with a
    // neutral label would silently acquire seeding. Guarded here, any such
    // caller is inert in a production build. Returns 0 — the same "nothing
    // to insert" result the merge path already produces.
    if (!DEMO_CONTENT) return 0;
    const client = requireSupabase();
    const userId = await requireUserId(client);
    const demo = buildDemoEntries(days);
    const dates = Object.keys(demo);

    const { data: existingRows, error: existingError } = await client
      .from('entries')
      .select('entry_date')
      .eq('user_id', userId)
      .is('hive_id', null)
      .in('entry_date', dates);
    if (existingError) throw existingError;
    const existingDates = new Set((existingRows ?? []).map((row) => row.entry_date));

    const toInsert = dates
      .filter((date) => !existingDates.has(date))
      .map((date) => ({
        user_id: userId,
        entry_date: date,
        content: demo[date].text,
        theme: demo[date].theme,
      }));
    if (toInsert.length === 0) return 0;

    const { error } = await client.from('entries').insert(toInsert);
    if (error) throw error;
    return toInsert.length;
  },
};
