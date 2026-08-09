import AsyncStorage from '@react-native-async-storage/async-storage';

// Hidden dev toggle (Pixel §9 gate plan) — lets Colin flip the onboarding
// opener for demos without shipping a visible setting. Never referenced in
// copy, excluded from frozen-copy checks.
const FLOW_KEY = 'dev:onboardingFlow';

export const DevSettings = {
  async getOnboardingFlow() {
    const value = await AsyncStorage.getItem(FLOW_KEY);
    return value === 'B' ? 'B' : 'A';
  },
  async setOnboardingFlow(flow) {
    await AsyncStorage.setItem(FLOW_KEY, flow === 'B' ? 'B' : 'A');
  },
};
