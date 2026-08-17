// Demo-mode reset (Colin, 2026-08-09): every time the app comes back to the
// foreground it should reopen at onboarding, even if someone finished it or
// was sitting on Main a minute ago — the pitch should always be fresh for
// whoever's about to see it. Also forces every cold launch to start at
// Onboarding (App.js); with it off, cold launches route on the persisted
// completion flag / live session instead (resolveInitialRoute).
//
// Driven by `eas.json`'s per-profile `EXPO_PUBLIC_DEMO_MODE` (Sage, thread
// 14492cf2), not a literal — a hardcoded `true` shipped demo mode to every
// TestFlight build regardless of profile. Two traps this derivation avoids:
// Expo's inline-env-vars babel plugin only rewrites a direct
// `process.env.X` member read, so destructuring `{ EXPO_PUBLIC_DEMO_MODE }`
// from `process.env` resolves to `undefined` at runtime and silently kills
// the flag; and the inlined value is always a string, so a bare truthiness
// check makes the explicit `"false"` the production profile sets truthy.
// The `=== 'true'` comparison is what makes an absent var (development
// profile, no env block) resolve safely to `false`. Shape-asserted by
// scripts/check-demo-mode-env.mjs — if you change this line, that gate is
// pointing at it on purpose.
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

// Sage's LATENT finding (thread 37fb8ef6, 2026-08-15): DEMO_MODE and
// __DEV__ are different axes and disagreed in exactly one build — a
// *pitch* build (DEMO_MODE on, __DEV__ off) got the foreground-reset
// behaviour with none of the demo affordances that make the reset worth
// having, because CoreRitual's "Load demo data" button and
// HoneycombTab's demoHiveShares merge were gated on `__DEV__` alone
// (WP-10a). Pixel's WP-10(c) finding is the same class one screen over:
// Onboarding's FlowToggle and "Skip to the logged-in view (demo)" were
// gated on nothing at all, and gating them on raw `__DEV__` would delete
// Colin's flow picker from exactly the release build he demos from
// (`__DEV__` is false there; `DEMO_MODE` is what's still true).
//
// One exported constant, every demo-only affordance imports it instead of
// checking `__DEV__` directly: dev builds get it from `__DEV__`, pitch/demo
// builds get it from `DEMO_MODE`, and a real release build (both off) is
// the only state where it's false.
//
// With DEMO_MODE env-derived (above), this disjunction now distinguishes
// all three build shapes that exist: a dev/Metro build (`__DEV__` true,
// var unset) is on; the preview/pitch profile (`__DEV__` false, var
// "true") is on; the production profile (`__DEV__` false, var "false") is
// off. That third state is what this file's earlier literal couldn't
// express — a store-bound build no longer collapses onto the pitch
// build's branch and inherits demo content it shouldn't have.
export const DEMO_CONTENT = __DEV__ || DEMO_MODE;
