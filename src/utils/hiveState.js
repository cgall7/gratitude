import { toISODate } from './dateRanges';

// How recently a member has to have sent a note for their cell to read as
// Blooming (PRD's "recently received gratitude" — undefined in the doc).
// Pixel's call to make against a rendered comb at real density (thread
// e10d0fed, 2026-08-13): a generous window blooms most of the hive and
// erases the quiet cells "Dormant is absence" depends on. Sage's starting
// point, not a ruling — this is the one number to tune, everything else
// in this file follows from it.
export const HIVE_BLOOMING_WINDOW_HOURS = 48;

// Mirrors partitionHive's own `entryDate === toISODate(now)` check
// (HoneycombTab.js) — Active is "this member's most recent shared entry is
// dated today," compared as ISO date strings against the viewer's local
// clock, never parsed into a Date. `list_hive_state()` returns the raw date
// for exactly this reason: computing "today" on the server would compare
// against the server's UTC clock instead, and disagree with the comb the
// viewer is looking at for part of every day for any non-UTC viewer.
export const isActiveToday = (lastEntryDate, now = new Date()) => lastEntryDate === toISODate(now);

// Blooming is a recency check on an absolute instant (notes.created_at is
// timestamptz), so — unlike Active — this one has no timezone ambiguity to
// worry about; the window is the only free parameter.
export const isBlooming = (lastNoteReceivedAt, now = new Date(), windowHours = HIVE_BLOOMING_WINDOW_HOURS) => {
  if (!lastNoteReceivedAt) return false;
  const elapsedMs = now.getTime() - new Date(lastNoteReceivedAt).getTime();
  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
};
