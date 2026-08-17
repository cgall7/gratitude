import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_CONTENT } from '../constants/demoMode';

// Hidden dev toggle (Pixel §9 gate plan) — lets Colin flip the onboarding
// opener for demos without shipping a visible setting. Never referenced in
// copy, excluded from frozen-copy checks.
const FLOW_KEY = 'dev:onboardingFlow';

export const DevSettings = {
  async getOnboardingFlow() {
    const value = await AsyncStorage.getItem(FLOW_KEY);
    // Defaults to B (Colin, 2026-08-09): Flow B is the one with the claim
    // screens + bee transitions, so a fresh install shows the full
    // experience without anyone having to know to flip the toggle first.
    // Flow C (2026-08-10) demos the real screen-lock/unlock loop in place
    // of the plain entry form. Flow A (straight to it, no belief screens,
    // plain form) was deleted 2026-08-12 — any device with a stale 'A'
    // falls through to B here rather than staying stuck on a flow the UI
    // can no longer select.
    //
    // The READ is guarded too, not just the setter (Pixel, thread
    // 4510c5c8): pitch and store builds ship the same bundle id, so a 'C'
    // persisted by a demo-flagged build arrives in a production build's
    // AsyncStorage container without this build ever writing it. To a
    // production build, 'C' is the same category as stale 'A' — a value
    // this build cannot honour — and the self-heal write below (a direct
    // setItem, deliberately not the DEMO_CONTENT-gated setter) rewrites it
    // to B on first read.
    const resolved = value === 'C' && DEMO_CONTENT ? value : 'B';
    // Self-heal a stale invalid value (e.g. 'A') by writing the resolved
    // value back — otherwise AsyncStorage holds it forever, waiting for a
    // future reader that doesn't route through this getter. Skip the write
    // when value is null (never set): that's the normal fresh-install case,
    // not a value to correct.
    if (value !== null && value !== resolved) await AsyncStorage.setItem(FLOW_KEY, resolved);
    return resolved;
  },
  async setOnboardingFlow(flow) {
    // The capability guard, not just the entry point (Sage, thread
    // 4510c5c8): in a production build this no-ops, so no caller — present
    // or future — can persist a demo flow choice from THIS build. The 'C'
    // a demo build already persisted into the shared container is the
    // getter's guard's job, above.
    if (!DEMO_CONTENT) return;
    await AsyncStorage.setItem(FLOW_KEY, flow === 'C' ? flow : 'B');
  },
};
