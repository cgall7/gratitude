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

// R16 (Lumen, 2026-08-21): a baseline `owner` field that reads "unassigned"
// satisfies the FIELD Lumen's R15 ruling required, not the CONDITION it
// named — a named owner. Callers assert this once per baseline so the
// suite itself, not a review comment, holds the second of R15's two
// conditions ("named owner" / "retired only in the fixing commit").
export function ownerIsNamed(owner) {
  return typeof owner === 'string' && owner.trim().length > 0 && !/\bunassigned\b/i.test(owner);
}

// R16b (Lumen, 2026-08-21) — BLOCKING finding: `diffAgainstBaseline`'s
// `added`/`stale` are the right diagnostic for the GATE (it should red on
// anything not reproduced verbatim), but `ratchet-update.mjs` used to take
// that same `stale` list and blindly retire it while writing the ENTIRE
// live sweep back as the new baseline — including whatever showed up in
// `added`. A single cosmetic edit (one comment line above a baselined
// violation) shifts that violation's line, which under a line-sensitive
// key reads as one retirement + one addition; the "addition" is
// indistinguishable from a real new violation, and the update script wrote
// both in unconditionally. Lumen's run: a genuinely new unshielded
// violation landed in the same commit as a cosmetic shift, and
// `ratchet:update` absorbed both — 14 -> 15, gate green, real defect
// laundered through the sanctioned repair.
//
// A monotone update may only ever (1) RETIRE a baseline row whose exact
// key no longer reproduces live, or (2) RE-KEY a row: a live entry that
// matches no baseline key directly, but whose fields are otherwise
// IDENTICAL to a retired baseline row in the same file (same everything
// except whatever the key itself already varies, e.g. `line`) is treated
// as the same violation, moved, not a new one. Anything left over is
// genuinely new and is refused unless its key is explicitly named by the
// caller (`ratchet-update.mjs --accept-new <key>`) — the shape of R16a's
// stable key one level up, applied to the updater instead of the gate.
//
// NAMED RESIDUAL (Lumen): two violations with identical fields in one
// file, one fixed and one added in the same commit, is still ambiguous —
// either pairing of "old retired / new re-keyed" is indistinguishable from
// the other, and this function may pick either. That ambiguity already
// existed in a plain line-keyed baseline; this fix neither creates nor
// closes it, it only refuses the case that has no matching shape at all.
export function computeMonotoneUpdate(live, baselineEntries, keyOf, acceptNewKeys = new Set()) {
  const shapeOf = (entry) => {
    const { line, ...rest } = entry;
    const keys = Object.keys(rest).sort();
    return `${entry.file}::${keys.map((k) => `${k}=${JSON.stringify(rest[k])}`).join('|')}`;
  };

  const baselineByKey = new Map(baselineEntries.map((e) => [keyOf(e), e]));
  const liveByKey = new Map(live.map((e) => [keyOf(e), e]));

  // Baseline rows not directly reproduced, pooled by shape — candidates to
  // be "the same violation, moved." Each is consumable at most once.
  const pool = new Map();
  for (const entry of baselineEntries) {
    if (liveByKey.has(keyOf(entry))) continue;
    const shape = shapeOf(entry);
    if (!pool.has(shape)) pool.set(shape, []);
    pool.get(shape).push(entry);
  }

  const next = [];
  const rekeyed = [];
  const genuinelyNew = [];
  const accepted = [];
  const matchedBaselineKeys = new Set();

  for (const entry of live) {
    const key = keyOf(entry);
    const direct = baselineByKey.get(key);
    if (direct) {
      // Same key: carry the live entry's fresh fields forward, but keep any
      // baseline-only annotation (e.g. a `note`) the live sweep can't
      // produce — see the WalletTab entry in safe-area-padding.json.
      next.push({ ...direct, ...entry });
      matchedBaselineKeys.add(key);
      continue;
    }
    const shape = shapeOf(entry);
    const candidates = pool.get(shape);
    if (candidates && candidates.length) {
      const consumed = candidates.shift();
      matchedBaselineKeys.add(keyOf(consumed));
      next.push({ ...consumed, ...entry });
      rekeyed.push({ from: consumed, to: entry });
      continue;
    }
    if (acceptNewKeys.has(key)) {
      next.push(entry);
      accepted.push(entry);
      continue;
    }
    genuinelyNew.push(entry);
  }

  const retired = baselineEntries.filter((e) => !matchedBaselineKeys.has(keyOf(e)));

  return { next, rekeyed, genuinelyNew, accepted, retired };
}
