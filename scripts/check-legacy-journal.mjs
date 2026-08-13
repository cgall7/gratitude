// Gate for the orphaned-journal recovery (thread ba3783a7, 2026-08-13, Sage):
// P0-2 moved the journal off `gratitude_entries_v1` and the key lost every
// reader, stranding pre-migration entries on-device. legacyJournalMigration.js
// reads that key once and uploads through EntryStore — this gates the pure
// logic behind it, not the AsyncStorage/Supabase I/O around it.
//
//   npm run check:legacy-journal
//
// TWO PROPERTIES, EACH WITH ITS OWN FAILURE MODE IF UNTESTED.
//
// 1. legacyDateKeyToDate must round-trip through the SAME toISODate the rest
//    of the app uses. `new Date("YYYY-MM-DD")` parses as UTC midnight; in any
//    negative-UTC-offset zone the app's own timezone correction then shifts
//    that a calendar day earlier. Every entry a migration run touches would
//    land one day off from what the tester actually wrote, silently, the
//    exact defect class Sage's thread already caught once in streak/recap
//    code (check-streaks.mjs's own TODAY comment). Run across a whole year
//    including both US DST transitions, not one fixture date, because the
//    failure is timezone-offset-dependent and a single date can accidentally
//    sit on the side that doesn't shift.
//
// 2. legacyEntriesToMigrate must never let an orphaned local entry overwrite
//    a Supabase row that already exists for that date — that would silently
//    replace a tester's newer, real write with a stale one recovered from a
//    key nothing has read since the migration that orphaned it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { toISODate } = await import(path.join(ROOT, 'src/utils/dateRanges.js'));
const { legacyDateKeyToDate, legacyEntriesToMigrate } = await import(
  path.join(ROOT, 'src/utils/legacyJournal.js')
);

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};
const eq = (label, got, want) =>
  got === want ? ok(label) : bad(label, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ---------------------------------------------------------------------------
console.log('\n  §1 — legacyDateKeyToDate round-trips through toISODate, every day of a year');

{
  const offenders = [];
  // 2026, spanning both US DST transitions (spring forward 2026-03-08,
  // fall back 2026-11-01) — the boundary days are exactly where a
  // timezone-offset bug would show up first.
  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(2026, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const roundTrip = toISODate(legacyDateKeyToDate(dateKey));
      if (roundTrip !== dateKey) offenders.push(`${dateKey} -> ${roundTrip}`);
    }
  }
  eq('every date in 2026 round-trips to itself', offenders.join(', '), '');
}

// ---------------------------------------------------------------------------
console.log('\n  §2 — legacyEntriesToMigrate: what gets uploaded, what does not, and why');

{
  const legacy = {
    '2026-01-05': { text: 'walked the dog', theme: 'nature', savedAt: '2026-01-05T12:00:00.000Z' },
    '2026-01-06': { text: 'finished a book', theme: 'growth', savedAt: '2026-01-06T12:00:00.000Z' },
  };
  const result = legacyEntriesToMigrate(legacy, new Set());
  eq('both entries with real text and no existing row are included', result.length, 2);
  const byKey = Object.fromEntries(result.map((r) => [r.dateKey, r]));
  eq('text carried through unchanged', byKey['2026-01-05']?.text, 'walked the dog');
  eq('theme carried through unchanged', byKey['2026-01-06']?.theme, 'growth');
  eq(
    'date reconstructs to the same calendar day',
    toISODate(byKey['2026-01-05']?.date),
    '2026-01-05',
  );
}

{
  // The collision case this whole gate exists for: a date that already has a
  // Supabase row must never be re-uploaded from the orphaned local copy —
  // that row is the user's newer write, and this key has had no writer since
  // P0-2 shipped, so the local copy can only be older.
  const legacy = {
    '2026-02-01': { text: 'already on the server, newer', theme: null },
    '2026-02-02': { text: 'never made it to the server', theme: null },
  };
  const existingDates = new Set(['2026-02-01']);
  const result = legacyEntriesToMigrate(legacy, existingDates);
  eq('a date already in Supabase is excluded', result.length, 1);
  eq('the excluded date is the colliding one, not the other', result[0]?.dateKey, '2026-02-02');
}

{
  // Rows with no real text: a corrupt or half-written legacy record should
  // not become an empty entry in Supabase — skip it, don't upload a blank.
  const legacy = {
    '2026-03-01': { text: '', theme: 'nature' },
    '2026-03-02': { theme: 'nature' }, // no text field at all
    '2026-03-03': { text: 'a real entry', theme: 'nature' },
  };
  const result = legacyEntriesToMigrate(legacy, new Set());
  eq('empty-text and missing-text rows are both excluded', result.length, 1);
  eq('the surviving row is the one with real text', result[0]?.dateKey, '2026-03-03');
}

{
  eq('an empty legacy blob migrates nothing', legacyEntriesToMigrate({}, new Set()).length, 0);
}

console.log(`\ncheck-legacy-journal: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
