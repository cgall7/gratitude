// How recently a member has to have sent a note for their cell to read as
// Blooming (PRD's "recently received gratitude" — undefined in the doc).
// Ruled in R59 (thread e10d0fed, 2026-08-13, Pixel): the real constraint is
// a density cap, not a feel — above ~3-of-7 blooming in the expected case,
// the ring stops reading as a per-cell mark and Dormant gets reinstated by
// the back door as the dominant read. 48h is the starting window that keeps
// ~1 note/member/week under that cap; retune against real note volume, not
// against how the comb happens to look on one day.
export const HIVE_BLOOMING_WINDOW_HOURS = 48;

// Blooming is a recency check on an absolute instant (notes.created_at is
// timestamptz), so it has no timezone ambiguity to worry about — the window
// is the only free parameter.
export const isBlooming = (lastNoteReceivedAt, now = new Date(), windowHours = HIVE_BLOOMING_WINDOW_HOURS) => {
  if (!lastNoteReceivedAt) return false;
  const elapsedMs = now.getTime() - new Date(lastNoteReceivedAt).getTime();
  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
};
