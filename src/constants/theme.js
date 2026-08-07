export const theme = {
  colors: {
    // Backgrounds
    background: '#FFFBEB', // Sunlit Cream
    surface: '#FFFFFF', // Card white, pops off the cream backdrop
    surfaceBorder: 'rgba(26, 21, 0, 0.08)',
    surfaceBorderStrong: 'rgba(26, 21, 0, 0.14)', // filled/selected card states need more than a hairline

    // Accents
    accent: '#FFC300', // Marigold — primary brand yellow
    pop: '#12B76A', // Fresh Green (The "Unlock" color — the payoff pop)
    gold: '#FF8A00', // Warm Amber (The "Wrapped" color)

    // Text
    textPrimary: '#221B03', // Warm near-black, softer than pure black
    textSecondary: '#6B5F3D', // Darkened from #8A7F5C — that shade only hit 3.8:1 on Sunlit Cream, below WCAG AA for body text; this hits ~6.1:1
    textInverse: '#221B03', // Dark text for use on top of bright accent/gold surfaces
  },
  // Family names match the registered fonts loaded via useFonts() in
  // App.js (see src/constants/fontAssets.js) — Inter for display/UI, Plus
  // Jakarta Sans for reading copy, Dancing Script for the wordmark.
  fonts: {
    logo: 'DancingScript-Bold',
    header: 'Inter-Bold',
    headerExtraBold: 'Inter-ExtraBold',
    headerSemiBold: 'Inter-SemiBold',
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
    small: 12,
    medium: 20,
    large: 32, // Squircle/Bento style
    full: 999,
  },
  // Named type styles so every screen pulls from the same scale instead of
  // picking one-off fontSize/lineHeight pairs. Spread directly into a
  // StyleSheet entry, e.g. `title: { ...theme.type.h1, color: ... }`.
  type: {
    display: { fontFamily: 'Inter-ExtraBold', fontSize: 56, lineHeight: 60, letterSpacing: -1 },
    h1: { fontFamily: 'Inter-ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
    h2: { fontFamily: 'Inter-Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
    h3: { fontFamily: 'Inter-Bold', fontSize: 19, lineHeight: 26 },
    bodyLg: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 19, lineHeight: 28 },
    body: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 16, lineHeight: 24 },
    bodySm: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, lineHeight: 20 },
    label: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
    button: { fontFamily: 'Inter-Bold', fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
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
