import DefaultAsyncStorage from '@react-native-async-storage/async-storage';
import { EntryStore as DefaultEntryStore } from './EntryStore';
import { legacyEntriesToMigrate } from '../utils/legacyJournal';

// P0-2 (thread 19e90cf8) moved the journal from this single AsyncStorage key
// to Supabase. Days later we found the key had zero remaining readers
// anywhere in the app (thread ba3783a7, Sage: `git grep` at github/main
// returns nothing) — every entry a tester wrote before that migration is
// stranded on their device, recoverable exactly once, until their next
// reinstall wipes it for good. This is that recovery, run once per device.
const LEGACY_KEY = 'gratitude_entries_v1';

// This key has NEVER been scoped to a user — it predates accounts entirely
// (single AsyncStorage blob, one per device). Sage caught what that means
// once this migration turns it into a server write (thread ba3783a7,
// 2026-08-13): sign out, sign in as a different person on the same device
// (the demo, not an edge case), and the second person's session uploads the
// first person's entries under their own user_id — permanent, and nothing
// distinguishes the rows afterward. Nothing clears this key on sign-out
// (verified: zero AsyncStorage.clear/removeItem calls anywhere in the app).
//
// There is no way to recover WHO the key's rows actually belong to — it was
// never recorded. So the fix isn't "attribute correctly," it's "attribute at
// most once, permanently, to whichever identity gets there first" — a key
// with no owner can only be given away one time. CLAIMED_BY_KEY records that
// identity BEFORE any read of LEGACY_KEY happens, not after a successful
// migration, so a first attempt that fails (offline, not yet migrated code)
// still locks the key to that identity — a second, different identity
// arriving before the first attempt's retry succeeds can never pick it up
// instead. Only the identity that already holds the claim is allowed to
// retry.
const CLAIMED_BY_KEY = 'gratitude_entries_v1_claimed_by';
const MIGRATED_KEY = 'gratitude_entries_v1_migrated';

// One in-flight run per module instance, memoised by promise rather than by
// a synchronous flag — Sage (thread ba3783a7): Supabase's GoTrueClient fires
// `INITIAL_SESSION` to every subscriber on subscribe, so AuthContext's
// `getSession().then(...)` and its `onAuthStateChange` handler both call
// this within the same tick on a cold launch with a stored session, and
// `TOKEN_REFRESHED` fires again on every refresh after that. Without this,
// concurrent calls all pass the not-yet-migrated check before any of them
// writes it, race the same uploads, and the loser's failed insert can leave
// the marker unset on the run that actually did the work. Same shape as
// `flushPendingEntry`'s in-flight guard.
let inFlight = null;

export const migrateLegacyJournal = (userId, deps = {}) => {
  // Capitalized to shadow the import, not a stray convention slip:
  // check-entry-writes.mjs's census matches the literal identifier
  // `EntryStore.<method>`, by name, everywhere in src/ — documented in that
  // gate as a deliberate simplification. A lowercase injected parameter
  // renders both calls below invisible to it, exactly the "census went
  // quietly empty" failure that gate exists to catch, just self-inflicted
  // instead of from a rename. Keeping the name is cheaper than teaching the
  // gate a second alias for one call site.
  const { storage = DefaultAsyncStorage, entryStore: EntryStore = DefaultEntryStore } = deps;
  if (!userId) return Promise.resolve({ migrated: 0, skipped: 0 });
  if (!inFlight) {
    inFlight = runMigration(userId, storage, EntryStore).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

// Everything below lives in one try/catch on purpose: a failed read, a
// rejected Supabase write, and any other surprise here all resolve to "try
// again next launch" — leave both keys as they were and let the caller's
// `.catch(() => {})` swallow it.
const runMigration = async (userId, storage, EntryStore) => {
  try {
    const claimedBy = await storage.getItem(CLAIMED_BY_KEY);
    if (claimedBy && claimedBy !== userId) {
      // A different identity already holds this device's one claim. Never
      // touch the key again for anyone else, whether that first claim ever
      // finished or not — that's the whole guarantee.
      return { migrated: 0, skipped: 0 };
    }
    if (!claimedBy) {
      await storage.setItem(CLAIMED_BY_KEY, userId);
    }

    if (await storage.getItem(MIGRATED_KEY)) return { migrated: 0, skipped: 0 };

    const raw = await storage.getItem(LEGACY_KEY);
    if (!raw) {
      await storage.setItem(MIGRATED_KEY, '1');
      return { migrated: 0, skipped: 0 };
    }

    let legacy;
    try {
      legacy = JSON.parse(raw);
    } catch (parseErr) {
      // Deliberately does NOT set MIGRATED_KEY. "Not retriable into
      // something different" was true of a genuinely corrupt blob and false
      // of a truncated or transient read — and this key is the one
      // documented as recoverable exactly once. Setting the marker here
      // would spend that once on a failure, with nobody ever looking again.
      // Leaving it unset costs one harmless re-parse per future launch
      // (claimedBy already pins retries to this same identity) and keeps
      // the raw bytes exactly where they are for as long as they might
      // become readable.
      console.warn('legacyJournalMigration: could not parse legacy journal', parseErr);
      return { migrated: 0, skipped: 0 };
    }

    const dateKeys = Object.keys(legacy);
    if (!dateKeys.length) {
      await storage.setItem(MIGRATED_KEY, '1');
      return { migrated: 0, skipped: 0 };
    }

    // Never overwrite a row that already exists server-side — see
    // legacyEntriesToMigrate for why a same-date collision always keeps the
    // Supabase row over the orphaned older one.
    const existingEntries = await EntryStore.getAllEntries();
    const existingDates = new Set(existingEntries.map((entry) => entry.date));
    const toMigrate = legacyEntriesToMigrate(legacy, existingDates);
    const skipped = dateKeys.length - toMigrate.length;

    let migrated = 0;
    let allSucceeded = true;

    for (const { dateKey, date, text, theme } of toMigrate) {
      try {
        await EntryStore.saveEntry(date, text, theme);
        migrated += 1;
      } catch (err) {
        allSucceeded = false;
        console.warn(`legacyJournalMigration: failed to upload ${dateKey}`, err);
      }
    }

    // Only retire the legacy key once every date has been accounted for. A
    // partial failure leaves MIGRATED_KEY unset so the next launch retries
    // just the dates that didn't make it — the dedupe check above means an
    // already-uploaded date is never re-sent, and CLAIMED_BY_KEY means that
    // retry can only ever be this same identity.
    if (allSucceeded) {
      await storage.setItem(MIGRATED_KEY, '1');
    }
    return { migrated, skipped };
  } catch (err) {
    console.warn('legacyJournalMigration: migration attempt failed', err);
    return { migrated: 0, skipped: 0, error: true };
  }
};
