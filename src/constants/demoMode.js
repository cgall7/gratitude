// Demo-mode only (Colin, 2026-08-09): every time the app comes back to the
// foreground it should reopen at onboarding, even if someone finished it or
// was sitting on Main a minute ago — the pitch should always be fresh for
// whoever's about to see it. Flip this off once the app is past the demo
// phase. Also forces every cold launch to start at Onboarding (App.js);
// with it off, cold launches route on the persisted completion flag / live
// session instead (resolveInitialRoute).
export const DEMO_MODE = true;

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
// This two-input disjunction can only distinguish two build shapes (demo-on
// vs. demo-off) and is safe only as long as those are the only two shapes
// that exist. A TestFlight/store-bound build also has `__DEV__` false, so
// it collapses onto the same branch as the pitch build and inherits demo
// content it shouldn't have. Once a distribution profile exists, DEMO_MODE
// needs to come from a build-profile env var (defaulting to false) rather
// than this literal, so a tester build can express as its own third state.
export const DEMO_CONTENT = __DEV__ || DEMO_MODE;
