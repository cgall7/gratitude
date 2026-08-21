// Canonical per-violation identity for each ratcheted baseline, shared by
// the gate that diffs against it (check-safe-area.mjs, check-spring-
// adoption.mjs) and ratchet-update.mjs that regenerates it. R16 (Lumen,
// 2026-08-21, thread 6596d9c2): those two used to each define their own
// copy of `keyOf` — the exact hand-reimplementation class R12 already
// named once this pass (a gate re-deriving instead of importing). One
// definition per baseline, imported everywhere it's needed.
//
// R16a: `paddingKeyOf` is `file:styleKey`, not `file:line`. `styleKey` is a
// StyleSheet.create property name — unique per file by construction (JS
// object literals can't repeat a key) — measured across the live sweep:
// 14 entries, 14 distinct. Keying on it means a cosmetic edit that only
// shifts a violation's line number produces no diff at all: no red, no
// `ratchet:update`, nothing to habituate past.
export const paddingKeyOf = (v) => `${v.file}:${v.styleKey}`;

// One entry per file already (a screen either imports the deprecated API
// or it doesn't) — no line-sensitivity to begin with.
export const deprecatedImportKeyOf = (v) => v.file;

// R16a is NOT general (Lumen): `check-spring-adoption`'s durations have no
// comparably stable per-entry field — measured, 6 live entries, only 4
// distinct on `file:value` (three `CoreRitual.js` sites share the literal
// `200`). No key rename can carry this gate; monotonicity here has to live
// in the updater (R16b, see `computeMonotoneUpdate` in `ratchet.mjs`), so
// these two stay `file:line`.
export const springKeyOf = (v) => `${v.file}:${v.line}`;
export const durationKeyOf = (v) => `${v.file}:${v.line}`;
