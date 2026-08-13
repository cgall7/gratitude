# Pollinate 🐝

A social gratitude network: appreciation notes to friends, optionally carrying a
real money tip, with time-capsule "seeds" and a honeycomb view of your people.

> ⚠️ **The Core Loop below predates the Pollinate redirect (2026-08-13) and
> describes the previous product** — a solo journal fronted by a screen-lock.
> The Hive, the entry, the theming and the recaps all survive; the money layer,
> seeds, and the friendship model are net-new and not described here yet.
> Rewriting this section belongs with the strategy owner, not this rebrand pass.
> Current source of truth: `PLANS/POLLINATE_{STRATEGY,PRD,DELIVERY_SLICES}.md`.

## 🚀 Core Loop
1. **Onboard:** First run walks through a 6-step flow that ends with a real gratitude entry, not a blank dashboard.
2. **Lock:** Selected apps are blocked via System APIs at a scheduled morning time.
3. **Reflect:** User opens `Pollinate`, sees a rotating daily prompt for inspiration, and records one thing they are grateful for.
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
- **Persistence:** Two stores, split by privacy. Private entries are local-only
  via `AsyncStorage` (`src/services/EntryStore.js`, key `gratitude_entries_v1` —
  **that key is frozen; renaming it orphans every entry on every device**, §19.2).
  Anything social — profiles, shares, likes, comments — is Supabase Postgres
  behind RLS (`src/services/HoneycombStore.js`, schema in `supabase/migrations/`).
  This README previously claimed no backend was wired; that stopped being true
  on 2026-08-08.
- **Theming logic:** Entries are tagged with a category by lightweight keyword matching (`src/utils/themeTagger.js`) so weekly/monthly/yearly recaps have a real theme without an AI call. Swappable for GPT-4o-mini later behind the same function signature.

## 🎨 Visual Identity

The design system is **Sunbeam v1** — `GUIDES/GRATITUDE_DESIGN_SYSTEM_V1.md` is
the spec and `src/constants/theme.js` is the only place the values live. The
list below is a summary; if the two ever disagree, `theme.js` wins.

- **Name:** Pollinate. The on-screen wordmark is **"Pollinate", title-case, in
  Dancing Script** (`theme.type.logo`) — ruled §19.3, 2026-08-13. All three
  sites that draw it (`Onboarding.js:236`, `CoreRitual.js:57` and `:126`) use
  that one casing. Earlier revisions of this file specified all-lowercase; that
  is superseded.
- **The word "gratitude" is still the product noun** — a "gratitude note" is
  what users write. Only the *app's name* changed (§19.1). Do not sweep it.
- **Colors:** Sunlit Honey `#FFF7CC` (identity screens), Sunlit Cream `#FFFBEB`
  (write surfaces only), Marigold `#FFD200` — the one accent, Warm Amber
  `#FF7A00`, Golden Honey `#F0C023` (keepsakes only), warm near-black ink
  `#221B03`.
- **ZERO GREEN, anywhere.** This is a ratified, load-bearing rule (§7 green
  purge). Earlier revisions of this file listed a "Fresh Green #12B76A" in the
  brand palette; that colour was purged from the app and must not come back.
- **Style:** Bright, joyful, vibrant — clean cards on a warm light backdrop,
  high-contrast dark ink text. Nunito ExtraBold is the display face.
