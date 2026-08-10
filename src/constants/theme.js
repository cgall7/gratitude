export const theme = {
  colors: {
    // Backgrounds
    background: '#FFFBEB', // Sunlit Cream
    surface: '#FFFFFF', // Card white, pops off the cream backdrop
    surfaceBorder: 'rgba(26, 21, 0, 0.08)',
    surfaceBorderStrong: 'rgba(26, 21, 0, 0.14)', // filled/selected card states need more than a hairline

    // Accents — Sunbeam v1 (GUIDES/GRATITUDE_DESIGN_SYSTEM_V1.md §1). Zero green anywhere.
    accent: '#FFD200', // Marigold — THE one accent. Active states, celebration badge, key highlights.
    accentDeep: '#FF7A00', // Warm amber — hero numerals, emphasis on cream (replaces `gold`).
    accentBurst: '#FFEA00', // Hottest yellow on the board. Motion only — bursts, pops, bee trail. Never a static fill, text, or background.
    washYellow: '#FFF3C4', // Pastel wash — Today/ritual moments.
    washPeach: '#FFE9D9', // Pastel wash — warmth/celebration moments.
    washSky: '#E4F2FB', // Pastel wash — calm/recap moments. Use sparingly.
    danger: '#E5484D', // Destructive only (delete entry). Rarely seen.

    // Text / ink
    ink: '#221B03', // Warm near-black. Text, primary CTA fill, icons.
    inkSoft: '#6B5F3D', // Secondary text — ~6.1:1 on Sunlit Cream, AA-compliant.
    textPrimary: '#221B03', // Alias of `ink`, kept for existing call sites.
    textSecondary: '#6B5F3D', // Alias of `inkSoft`, kept for existing call sites.
    textInverse: '#221B03', // Dark text for use on top of bright accent/accentDeep surfaces
  },
  // Family names match the registered fonts loaded via useFonts() in
  // App.js (see src/constants/fontAssets.js) — Nunito for display/UI
  // headlines, Plus Jakarta Sans for reading copy, Dancing Script for the
  // wordmark. Inter stays registered only as a fallback; nothing references it.
  fonts: {
    logo: 'DancingScript-Bold',
    header: 'Nunito-Bold',
    headerExtraBold: 'Nunito-ExtraBold',
    body: 'PlusJakartaSans-Regular',
    bodyMedium: 'PlusJakartaSans-Medium',
    bodySemiBold: 'PlusJakartaSans-SemiBold',
    bodyItalic: 'PlusJakartaSans-Italic',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    small: 14,
    medium: 24,
    large: 32, // Squircle/Bento style
    full: 999,
  },
  // Named type styles so every screen pulls from the same scale instead of
  // picking one-off fontSize/lineHeight pairs. Spread directly into a
  // StyleSheet entry, e.g. `title: { ...theme.type.h1, color: ... }`.
  type: {
    hero: { fontFamily: 'Nunito-ExtraBold', fontSize: 72, lineHeight: 76, letterSpacing: -1.5 },
    display: { fontFamily: 'Nunito-ExtraBold', fontSize: 44, lineHeight: 48, letterSpacing: -1 },
    h1: { fontFamily: 'Nunito-ExtraBold', fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
    h2: { fontFamily: 'Nunito-Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontFamily: 'Nunito-Bold', fontSize: 18, lineHeight: 24 },
    bodyLg: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 18, lineHeight: 27 },
    body: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 16, lineHeight: 24 },
    bodySm: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, lineHeight: 20 },
    label: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 2, textTransform: 'uppercase' },
    button: { fontFamily: 'Nunito-Bold', fontSize: 17, lineHeight: 22, letterSpacing: 0 },
    logo: { fontFamily: 'DancingScript-Bold', fontSize: 44 },
  },
  // Two weights of elevation: `card` for content at rest, `floating` for
  // anything that should feel pressable/afloat (primary buttons, tab bar,
  // the unlock badge). Ambient shadows key off the warm near-black so they
  // read as soft depth rather than a grey drop-shadow on a cream backdrop.
  shadows: {
    card: {
      shadowColor: '#221B03',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    floating: {
      shadowColor: '#221B03',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 10,
    },
    // Colored glow for accent-tinted elements (CTA buttons, unlock badge) —
    // pass the element's own background color so the shadow reads as a
    // glow of that color rather than a generic dark drop-shadow.
    tinted: (color) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    }),
  },
};
