// Hoisted out of the `theme` literal so `gradients` below can be built from
// the tokens themselves instead of re-typing their hex values. A stop that
// only *claims* in a comment to be `accent` goes stale the next time the
// accent moves — which is exactly how §11's retune got dropped on the floor
// once already.
const colors = {
  // Backgrounds
  background: '#FFF7CC', // Sunlit Honey (§12.1 retune) — identity screens: Today, Honeycomb, Recap, Wrapped, ritual gate.
  backgroundWriting: '#FFFBEB', // Sunlit Cream — ritual input step only. Contrast gate (Sage-ratified): read/write surfaces stay cream, never brighten.
  surface: '#FFFFFF', // Card white, pops off the cream backdrop
  surfaceShade: '#FFFAE8', // Surface in shadow. Only ever a gradient's far stop — stays lighter than `background` so a card never dissolves into the page.
  surfaceBorder: 'rgba(26, 21, 0, 0.08)',
  surfaceBorderStrong: 'rgba(26, 21, 0, 0.14)', // filled/selected card states need more than a hairline

  // Accents — Sunbeam v1 (GUIDES/GRATITUDE_DESIGN_SYSTEM_V1.md §1). Zero green anywhere.
  accent: '#FFD200', // Marigold — THE one accent. Active states, celebration badge, key highlights.
  accentDeep: '#FF7A00', // Warm amber — hero numerals, emphasis on cream (replaces `gold`).
  accentBurst: '#FFEA00', // Hottest yellow on the board. Motion only — bursts, pops, bee trail. Never a static fill, text, or background.
  washYellow: '#FFF3C4', // Pastel wash — Today/check-in moments.
  washPeach: '#FFE9D9', // Pastel wash — warmth/celebration moments.
  washSky: '#E4F2FB', // Pastel wash — calm/recap moments. Use sparingly.
  danger: '#E5484D', // Destructive only (delete entry). Rarely seen.

  // Text / ink
  ink: '#221B03', // Warm near-black. Text, primary CTA fill, icons.
  inkSoft: '#6B5F3D', // Secondary text — 5.84:1 on Sunlit Honey (every identity screen), 6.08:1 on Sunlit Cream (ritual input only). AA for normal text on both; quote the 5.84.
  textPrimary: '#221B03', // Alias of `ink`, kept for existing call sites.
  textSecondary: '#6B5F3D', // Alias of `inkSoft`, kept for existing call sites.
  textInverse: '#221B03', // Dark text for use on top of bright accent/accentDeep surfaces
};

// Two-stop washes for the hero insight cards, corner to corner: lit corner
// to shaded corner, so a card reads as catching light rather than sitting
// flat. Every stop is a token reference — no literal hex lives here.
const gradients = {
  // "This week" — a white card on the Sunlit Honey page is paper in sun, so
  // it falls to `surfaceShade` and stays neutral. Deliberately NOT
  // `washYellow`: since §12.1, washYellow (#FFF3C4) and background (#FFF7CC)
  // are ~2% apart, and that wash read as the card dissolving into the page.
  weekWash: [colors.surface, colors.surfaceShade],
  // "This month" — the summary card earns a hue shift so the two cards in
  // RecapTab's scroll read as different kinds of insight, not one repeated.
  // Peach, not `washSky`: §12.1 put Recap on Sunlit Honey, and the biggest
  // element on a warm field should not be the app's only cool cast.
  monthWash: [colors.surface, colors.washPeach],
  // Icon roundels — the one place accent is allowed to fill a shape.
  badge: [colors.accent, colors.accentDeep],
};

export const theme = {
  colors,
  gradients,
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
    // Glass floats because it's translucent, not because it casts a slab
    // shadow — lighter than `floating`, reserved for blurred surfaces
    // (spec §10).
    glass: {
      shadowColor: '#221B03',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
  },
};
