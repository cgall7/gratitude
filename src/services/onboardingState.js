import AsyncStorage from '@react-native-async-storage/async-storage';

// Onboarding completion flag — written once when the flow's finish() runs,
// read by App.js to pick the cold-launch route. Kept separate from
// devSettings: this is real app state, not a demo toggle. The flag is
// device-local on purpose; App.js also treats a live Supabase session as
// completion, so an existing user on a fresh install skips onboarding
// without this key ever having been written.
const STORAGE_KEY = 'onboarding_complete_v1';

export const OnboardingState = {
  async isComplete() {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  },
  async markComplete() {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  },
};
