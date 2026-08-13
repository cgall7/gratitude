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

// One-sided safety check on the claiming account, using a field the blob
// already carries: `savedAt`. Can only ever REFUSE a claim, never approve
// one — entries older than the account is proof the account didn't write
// them (the account didn't exist yet); entries newer is no evidence of
// anything, since a legitimate owner keeps journaling on their own account
// after creating it too. That asymmetry is why this is safe to add without
// inventing an attribution the blob was never given (Sage, thread ba3783a7:
// "a key with no owner can only be given away once" — this is what keeps it
// from being given away to someone it provably wasn't written by).
export const legacyPredatesAccount = (legacy, accountCreatedAt) => {
  if (!accountCreatedAt) return false;
  const accountCreatedMs = new Date(accountCreatedAt).getTime();
  if (Number.isNaN(accountCreatedMs)) return false;

  let newestSavedAtMs = null;
  for (const entry of Object.values(legacy)) {
    if (!entry?.savedAt) continue;
    const ms = new Date(entry.savedAt).getTime();
    if (Number.isNaN(ms)) continue;
    if (newestSavedAtMs === null || ms > newestSavedAtMs) newestSavedAtMs = ms;
  }
  // No usable savedAt anywhere in the blob: no evidence either way, and this
  // check only ever acts on evidence, so it does not refuse.
  if (newestSavedAtMs === null) return false;

  return newestSavedAtMs < accountCreatedMs;
};
