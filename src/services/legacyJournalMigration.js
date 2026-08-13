import AsyncStorage from '@react-native-async-storage/async-storage';
import { EntryStore } from './EntryStore';
import { legacyEntriesToMigrate } from '../utils/legacyJournal';

// P0-2 (thread 19e90cf8) moved the journal from this single AsyncStorage key
// to Supabase. Days later we found the key had zero remaining readers
// anywhere in the app (thread ba3783a7, Sage: `git grep` at github/main
// returns nothing) — every entry a tester wrote before that migration is
// stranded on their device, recoverable exactly once, until their next
// reinstall wipes it for good. This is that recovery, run once per device.
const LEGACY_KEY = 'gratitude_entries_v1';
const MIGRATED_MARKER_KEY = 'gratitude_entries_v1_migrated';

// Everything below lives in one try/catch on purpose: "not signed in yet",
// "AsyncStorage read failed", and "the Supabase write rejected" all resolve
// to the same outcome — leave the legacy key alone and let the next launch
// try again. None of those are the marker getting set, so none of them can
// look like a completed migration that silently lost data.
export const migrateLegacyJournal = async () => {
  try {
    if (await AsyncStorage.getItem(MIGRATED_MARKER_KEY)) return { migrated: 0, skipped: 0 };

    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) {
      await AsyncStorage.setItem(MIGRATED_MARKER_KEY, '1');
      return { migrated: 0, skipped: 0 };
    }

    let legacy;
    try {
      legacy = JSON.parse(raw);
    } catch (parseErr) {
      // Not retriable into something different on the next launch — mark it
      // handled rather than re-attempting the same parse forever.
      console.warn('legacyJournalMigration: could not parse legacy journal', parseErr);
      await AsyncStorage.setItem(MIGRATED_MARKER_KEY, '1');
      return { migrated: 0, skipped: 0 };
    }

    const dateKeys = Object.keys(legacy);
    if (!dateKeys.length) {
      await AsyncStorage.setItem(MIGRATED_MARKER_KEY, '1');
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
    // partial failure leaves it in place so the next launch retries just the
    // dates that didn't make it — the dedupe check above means an
    // already-uploaded date is never re-sent.
    if (allSucceeded) {
      await AsyncStorage.setItem(MIGRATED_MARKER_KEY, '1');
    }
    return { migrated, skipped };
  } catch (err) {
    console.warn('legacyJournalMigration: migration attempt failed', err);
    return { migrated: 0, skipped: 0, error: true };
  }
};
