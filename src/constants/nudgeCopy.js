// §7, DAILY_NUDGE_SPEC.md: "The notification's own title and body — owed
// WITH half A, not after it... this is the most-seen sentence in the
// product — lock screen, every day, forever. A placeholder there is the
// EveningMirror defect on the highest-visibility surface we have. Half A
// does not ship without it."
//
// These are Deezine's strings, not mine. `NUDGE_TITLE` / `NUDGE_BODY` below
// are a deliberately-unshippable sentinel, not a placeholder someone could
// mistake for a draft: `scripts/check-daily-nudge.mjs` fails while either
// value still matches it, and `src/services/dailyNudge.js`'s `reconcile()`
// requires real strings to be passed in at all — this file existing with the
// sentinel in it does not make the feature schedulable.
//
// Register: never an imperative, never "don't forget", never a streak
// threat. The app noticed the day and did not notice a line in it.
export const NUDGE_TITLE = '__OWNED_BY_DEEZINE__';
export const NUDGE_BODY = '__OWNED_BY_DEEZINE__';
