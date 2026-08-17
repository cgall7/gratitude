// The Daily Nudge, §4 / §6 row 6 — the rolling window, as arithmetic.
//
// `DAILY_NUDGE_SPEC.md` §4: a `SchedulableTriggerInputTypes.DAILY` repeat
// fires unconditionally, forever, with no on-delivery hook to skip a day that
// already has an entry. The ruled shape instead is a window of individually
// -dated one-shot notifications, `WINDOW_DAYS` ahead, re-armed on every
// foreground and every entry save, skipping any day that already has an
// entry. This module computes that window. It does not schedule anything —
// `src/services/dailyNudge.js` turns the returned day-keys into
// `scheduleNotificationAsync` calls.
//
// ZERO IMPORTS, not "dependency-free" as a description — an operative
// requirement (§6 row 6, amended, Bumble). `scripts/check-daily-nudge.mjs`
// loads this file by reading its source and `import()`-ing it as a base64
// `data:text/javascript` URL — the only way to import a plain `.js` file in a
// package that is not `type: module`. A `data:` URL has no hierarchical base,
// so it cannot resolve ANY relative specifier, the same failure
// `pollinationFlight.js` and `combLattice.js` were written against:
//
//   ERR_UNSUPPORTED_RESOLVE_REQUEST ... base scheme is not hierarchical
//
// A window builder is date arithmetic, so the reflex is to import a
// `toISODate` helper on line one — which is exactly what would break the
// loader. So `today` and the day-arithmetic helper both arrive as arguments
// instead:
//
//   - `addDays` is injected, not imported. The app wires in real calendar
//     arithmetic at the call site; the gate wires in plain integer offsets so
//     it can sweep the domain without touching a Date object at all.
//   - `today` is injected as a day-key, never `Date.now()` / `new Date()`
//     read from inside. A builder that reads the clock cannot be swept
//     deterministically (§6 row 6's sweep and row 9's worst-case sample both
//     need to run the same inputs twice and get the same answer), and §5's
//     "the app stores no timezone data" rule already points this logic at
//     pure day-key arithmetic rather than at a Date.
//
// A "day-key" is deliberately opaque to this module — whatever `today` is,
// `addDays` returns another one, and `writtenDays` is compared to the result
// with a Set. The real app uses `YYYY-MM-DD` strings; the gate uses small
// integers. Neither is privileged; the function does not know which it got.

/**
 * The window: `windowDays` calendar days starting at `today` (index 0 IS
 * today — §4.1's "today is skipped the moment the entry is saved" only makes
 * sense if today is a member of the window to begin with), with any day
 * already in `writtenDays` removed rather than replaced.
 *
 * Removed, not replaced, on purpose: a window that backfilled a skipped day
 * with `today + windowDays` would make the returned length constant
 * (`windowDays` always) regardless of how many days are written, which is
 * the thing §6 row 9's headroom guard exists to bound — a window that always
 * schedules its full size is a window whose worst case is also its typical
 * case, and the whole point of skipping written days is that an engaged
 * user's pending count drops, not holds steady.
 *
 * @param {object} args
 * @param {*} args.today       day-key, index-0 of the window
 * @param {Iterable<*>} args.writtenDays  day-keys that already have an entry
 * @param {number} args.windowDays        how many calendar days to consider
 * @param {(day: *, n: number) => *} args.addDays  day-key + n days
 * @returns {Array<*>} day-keys to schedule a one-shot nudge on, in order,
 *   length between 0 and `windowDays`
 */
export const buildWindow = ({ today, writtenDays, windowDays, addDays }) => {
  const written = writtenDays instanceof Set ? writtenDays : new Set(writtenDays);
  const days = [];
  for (let i = 0; i < windowDays; i += 1) {
    const day = addDays(today, i);
    if (!written.has(day)) days.push(day);
  }
  return days;
};
