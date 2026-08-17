import AsyncStorage from '@react-native-async-storage/async-storage';

// No crash reporter is wired today, so an ErrorBoundary catch is the only
// trace a field crash leaves. One key, overwritten on every catch — this
// is "what broke last", not a log, so it never grows unbounded on-device.
const STORAGE_KEY = 'crash_breadcrumb_v1';

export const CrashBreadcrumb = {
  async record(error, errorInfo) {
    const breadcrumb = {
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
      componentStack: errorInfo?.componentStack ?? null,
      at: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(breadcrumb));
    } catch (e) {
      // AsyncStorage itself is unavailable — nothing left to fall back to.
    }
  },

  async read() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
};
