# gratitude 🌿

A digital discipline tool that replaces doomscrolling with spiritual mindfulness.

## 🚀 Core Loop
1. **Lock:** Selected apps are blocked via System APIs at a scheduled morning time.
2. **Reflect:** User opens `gratitude` and records one thing they are grateful for.
3. **Unlock:** Upon saving, the system removes the block for the day.
4. **Mirror:** A nightly push notification reminds the user of their morning gratitude.

## 🛠 Tech Stack
- **Frontend:** React Native (Expo or CLI)
- **Styling:** Styled-components / StyleSheet with a custom `theme.js`
- **Native Logic:** 
    - iOS: `FamilyControls`, `ManagedSettings`, `DeviceActivity`
    - Android: `AccessibilityService` / `UsageStatsManager`
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **AI:** GPT-4o-mini (for monthly theme analysis)

## 🎨 Visual Identity
- **Name:** gratitude (all lowercase)
- **Colors:** Sunlit Cream (#FFFBEB), Marigold (#FFC300), Fresh Green (#12B76A), Warm Amber (#FF8A00).
- **Style:** Bright, joyful, vibrant — clean cards on a warm light backdrop, high-contrast dark ink text.
