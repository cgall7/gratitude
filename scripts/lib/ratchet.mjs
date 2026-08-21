// Shared mechanism for Lumen's R15 ruling (thread 6596d9c2, 2026-08-21):
// two gates (`check-safe-area`, `check-spring-adoption`) found real,
// pre-existing violations that are genuine debt, not gate defects — and
// holding the whole 37-gate suite red until every screen is fixed is what
// let both go unnoticed for days (they were invisible because the suite
// never passed, so nothing ever looked at their output).
//
// A ratchet converts that red into a shrinking, checked-in boundary:
//   - a live violation NOT in the baseline -> FAIL (someone added a new one;
//     the ratchet only ever tightens, never loosens by accident).
//   - a baseline entry NOT in the live sweep -> FAIL (the code changed
//     underneath a listed violation without the baseline being told — see
//     `ratchet-update.mjs`, the one sanctioned way to shrink a baseline).
//   - present in both -> passes, printed as still-open, named debt.
//
// Two conditions or the baseline becomes furniture (Lumen's own wording):
// it needs a named owner (recorded in the baseline file's `owner` field,
// not here) and an entry leaves only in the same commit that fixes the
// code — enforced by the second failure mode above, which is the whole
// reason "baseline entry not reproduced" is a FAIL and not a silent no-op.
import fs from 'node:fs';

export function loadBaseline(baselinePath) {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

// `live` and the baseline's `entries` are both arrays of plain objects.
// `keyOf` must produce the same string for the same logical violation
// whether it came from a fresh sweep or from the JSON on disk — see each
// gate's own `ratchetKeyOf` for what identifies a violation in that gate.
//
// KNOWN LIMITATION, STATED RATHER THAN HIDDEN: keys here are line-number
// sensitive. An unrelated edit earlier in the same file that shifts a
// still-open violation's line will register as one retirement + one
// addition at once, not silently — the gate goes red and names both — but
// it isn't a real change. The fix is `npm run ratchet:update` for that
// file's rows, same as a real fix would need. This ratchet does not claim
// identity survives arbitrary refactors, only that nothing can silently
// bypass it by fixing without updating, or by adding a new one unnoticed.
export function diffAgainstBaseline(live, baselineEntries, keyOf) {
  const baselineKeys = new Set(baselineEntries.map(keyOf));
  const liveKeys = new Set(live.map(keyOf));
  const added = live.filter((v) => !baselineKeys.has(keyOf(v)));
  const stale = baselineEntries.filter((v) => !liveKeys.has(keyOf(v)));
  const stillOpen = live.length - added.length;
  return { added, stale, stillOpen };
}
