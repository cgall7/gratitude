# Project Structure: gratitude

```text
gratitude/
├── android/               # Native Android code (Kotlin/Java)
│   └── app/src/main/java/ # AccessibilityService implementation here
├── ios/                   # Native iOS code (Swift/Obj-C)
│   └── gratitude/         # FamilyControls & ManagedSettings implementation here
├── src/
│   ├── assets/            # Fonts (Cursive/Sans), Images, Lottie animations
│   ├── components/        # Reusable UI components (Buttons, Cards, GlassPanes)
│   ├── constants/         # theme.js, config.js
│   ├── hooks/             # Custom hooks (useGratitudeLock, useTheme)
│   ├── navigation/        # React Navigation stacks
│   ├── screens/           # Main views (LockScreen, InputScreen, RecapScreen, Wrapped)
│   ├── services/          # API calls to Supabase/Firebase
│   └── utils/             # Helpers (Date formatting, AI prompt builders)
├── App.js                 # Root entry point
└── package.json           # Dependencies
```
