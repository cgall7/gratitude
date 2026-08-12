import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const resolved = value === 'C' ? value : 'B';
    // Self-heal a stale invalid value (e.g. 'A') by writing the resolved
    // value back — otherwise AsyncStorage holds it forever, waiting for a
    // future reader that doesn't route through this getter. Skip the write
    // when value is null (never set): that's the normal fresh-install case,
    // not a value to correct.
    if (value !== null && value !== resolved) await AsyncStorage.setItem(FLOW_KEY, resolved);
    return resolved;
  },
  async setOnboardingFlow(flow) {
    await AsyncStorage.setItem(FLOW_KEY, flow === 'C' ? flow : 'B');
  },
};
