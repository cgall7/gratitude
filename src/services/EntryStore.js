import AsyncStorage from '@react-native-async-storage/async-storage';
import { toISODate } from '../utils/dateRanges';

// Local-first persistence for now — no Supabase project is wired up yet
// (README lists it as the intended backend, but there's no client/env
// config in this repo). Swapping this module for a Supabase-backed one
// later shouldn't require touching any call site, since every screen only
// talks to EntryStore's methods, never AsyncStorage directly.
const STORAGE_KEY = 'gratitude_entries_v1';

const loadAll = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
};

const saveAll = async (entriesByDate) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entriesByDate));
};

export const EntryStore = {
  async saveEntry(date, text, themeTag) {
    const entries = await loadAll();
    const key = toISODate(date);
    entries[key] = { text, theme: themeTag, savedAt: new Date().toISOString() };
    await saveAll(entries);
    return { date: key, ...entries[key] };
  },

  async getEntry(date) {
    const entries = await loadAll();
    const key = toISODate(date);
    return entries[key] ? { date: key, ...entries[key] } : null;
  },

  // Sorted ascending by date.
  async getAllEntries() {
    const entries = await loadAll();
    return Object.entries(entries)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async getEntriesBetween(startDate, endDate) {
    const all = await this.getAllEntries();
    const start = toISODate(startDate);
    const end = toISODate(endDate);
    return all.filter((entry) => entry.date >= start && entry.date <= end);
  },
};
