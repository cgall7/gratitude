// Pure logic for legacyJournalMigration.js, split out so it's gateable
// without AsyncStorage or a Supabase session — see check-legacy-journal.mjs.

// "YYYY-MM-DD" -> the local Date that EntryStore.saveEntry's toISODate()
// will serialize back to the SAME string. `new Date(dateKey)` parses a bare
// date string as UTC midnight, and toISODate's timezone correction then
// shifts it a calendar day earlier in any negative-UTC-offset zone —
// verified: "2026-08-01" round-trips to "2026-07-31" in America/New_York.
// Local components at noon are clear of that shift in either direction.
export const legacyDateKeyToDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Which rows of the legacy `{ [dateKey]: { text, theme, savedAt } }` blob
// are worth uploading: real text, and a date Supabase doesn't already have
// for this user. `existingDates` wins every collision — this key has had no
// writer since P0-2 shipped, so every one of its dates predates every
// Supabase row for this user, and a same-date collision means the user
// journaled that day again after migrating; that newer write stands.
export const legacyEntriesToMigrate = (legacy, existingDates) =>
  Object.entries(legacy)
    .filter(([dateKey, entry]) => entry?.text && !existingDates.has(dateKey))
    .map(([dateKey, entry]) => ({
      dateKey,
      date: legacyDateKeyToDate(dateKey),
      text: entry.text,
      theme: entry.theme,
    }));
