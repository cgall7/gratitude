# gratitude 🌿

A digital discipline tool that replaces doomscrolling with spiritual mindfulness.

## 🚀 Core Loop
1. **Onboard:** First run walks through a 6-step flow that ends with a real gratitude entry, not a blank dashboard.
2. **Lock:** Selected apps are blocked via System APIs at a scheduled morning time.
3. **Reflect:** User opens `gratitude`, sees a rotating daily prompt for inspiration, and records one thing they are grateful for.
4. **Unlock:** Upon saving, the system removes the block for the day.
5. **Recap:** The Recap tab surfaces this week's dominant theme and the month's, computed from real saved entries.
6. **Wrapped:** The Wrapped tab is the December-tradition, Spotify-Wrapped-style year-in-review — entry count, top theme, longest streak, and a random favorite memory, all computed from the year's entries.
7. **Mirror:** A nightly push notification reminds the user of their morning gratitude.

## 🛠 Tech Stack
- **Frontend:** React Native (Expo or CLI), `@react-navigation` (stack + bottom tabs)
- **Styling:** StyleSheet with a custom `theme.js`
- **Native Logic:** 
    - iOS: `FamilyControls`, `ManagedSettings`, `DeviceActivity`
    - Android: `AccessibilityService` / `UsageStatsManager`
- **Persistence:** Local-first via `AsyncStorage` (`src/services/EntryStore.js`). No backend is wired up yet — Supabase is the intended future home once auth/sync is needed, but every screen talks to `EntryStore`, so swapping the storage layer later shouldn't touch call sites.
- **Theming logic:** Entries are tagged with a category by lightweight keyword matching (`src/utils/themeTagger.js`) so weekly/monthly/yearly recaps have a real theme without an AI call. Swappable for GPT-4o-mini later behind the same function signature.

## 🎨 Visual Identity
- **Name:** gratitude (all lowercase)
- **Colors:** Sunlit Cream (#FFFBEB), Marigold (#FFC300), Fresh Green (#12B76A), Warm Amber (#FF8A00).
- **Style:** Bright, joyful, vibrant — clean cards on a warm light backdrop, high-contrast dark ink text.
