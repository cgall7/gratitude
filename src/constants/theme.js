export const theme = {
  colors: {
    // Backgrounds
    background: '#FFFBEB', // Sunlit Cream
    surface: '#FFFFFF', // Card white, pops off the cream backdrop
    surfaceBorder: 'rgba(26, 21, 0, 0.08)',

    // Accents
    accent: '#FFC300', // Marigold — primary brand yellow
    pop: '#12B76A', // Fresh Green (The "Unlock" color — the payoff pop)
    gold: '#FF8A00', // Warm Amber (The "Wrapped" color)

    // Text
    textPrimary: '#221B03', // Warm near-black, softer than pure black
    textSecondary: '#8A7F5C',
    textInverse: '#221B03', // Dark text for use on top of bright accent/gold surfaces
  },
  fonts: {
    logo: 'DancingScript-Regular', // Cursive smooth font
    header: 'Inter-Bold',
    body: 'PlusJakartaSans-Regular',
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
  }
};
