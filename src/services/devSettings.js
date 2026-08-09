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
    return value === 'A' ? 'A' : 'B';
  },
  async setOnboardingFlow(flow) {
    await AsyncStorage.setItem(FLOW_KEY, flow === 'B' ? 'B' : 'A');
  },
};
