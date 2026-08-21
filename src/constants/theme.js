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
  // Golden Honey — the adaptive icon's locked gold (§13.1), and the KEEPSAKE
  // REGISTER: the field a finished, kept thing stands on. Today that is the
  // Seal that opens Wrapped, the Year Card that closes it, and the month-theme
  // flip. Deliberately NOT `accent`: the two are only 1.179:1 apart, close
  // enough that a keepsake next to an accent fill reads as a printing error
  // rather than a second colour. Promoted to a token in §17.5 after living as
  // a hand-copied literal in three files.
  //
  // §29.1 — ADMISSION. Gold is a MATERIAL, not an emphasis. A surface may wear
  // it only if all three hold:
  //   1. FINISHED  — no further authoring by the user is expected of it.
  //   2. KEPT      — it persists as an artifact, not as a view of live data.
  //   3. SINGULAR  — a specific thing with an identity, not a summary of things.
  // A streak count fails (2). A balance fails (2) and (3). An in-progress
  // private hive fails (1); a sealed one passes all three.
  //
  // Material is a property of the object, so it does NOT change when a second
  // object of the same kind arrives — WP-2's "at most one gold surface per
  // screen" is WITHDRAWN (§29.1). A count rule makes the register a function of
  // position in a list, and then gold means "the first one", which is a rank.
  // Three sealed hives are three gold cards. What survives the withdrawal: gold
  // may never carry EMPHASIS (emphasis is relative, material is not), and GOLD
  // MAY NOT BE THE GROUND — it sits on a non-gold page and the cream must still
  // read as the page.
  //
  // TEXT ON THIS FIELD IS SINGLE-TIER. `ink` is 10.01:1 and is the only legal
  // text colour here. `inkSoft` is 3.69:1 and FAILS 4.5:1; `accentDeep` is
  // 1.53:1; white is 1.71:1 (R15, remeasured §29.2). So hierarchy on a gold
  // surface comes from size, weight and position — never from colour (§23.9.2b).
  // Ground pairs, ΔE00 (§20.7: ΔE for ground-on-ground, WCAG for ink-on-ground):
  // vs `background` 21.14, vs `surface` 30.82, vs `washYellow` 19.63.
  goldField: '#F0C023',
  washYellow: '#FFF3C4', // The warm ground — Sunbeam's default full-bleed wash, activation staging included (R50). A role, not a screen.
  washPeach: '#FFE9D9', // Retired as a surface (§17.2/R50). Avatar identity swatch ONLY (sub-40pt); no new uses at any size.
  washSky: '#E4F2FB', // The cool counter-ground — hive surfaces + avatar swatch only (+ one legacy §8 Wrapped slide until §14.2 replaces that screen). Use sparingly (§1).
  danger: '#E5484D', // Destructive only (delete entry). Rarely seen.

  // Text / ink
  ink: '#221B03', // Warm near-black. Text, primary CTA fill, icons.
  inkSoft: '#6B5F3D', // Secondary text — ~6.1:1 on Sunlit Cream, AA-compliant.
  // Third rung of the warm ink ladder — placeholder/hint text only. Read by
  // three `placeholderTextColor` call sites that predate this token and have
  // been resolving `undefined` ever since (CreateHive x2, ComposeHiveEntry),
  // which hands the field to iOS's system placeholder grey: ~#C7C7CD, hue
  // 290.5deg, 1.68:1 on white. That is not merely "a cold grey" — it sits 199deg
  // around the wheel from every other piece of text in the product, and below
  // every contrast floor there is.
  //
  // Derived, not picked. `ink` is L*10.0 / h90.9deg, `inkSoft` is L*40.7 / h91.4deg,
  // so the ladder holds one hue and steps dL*=30.6. An evenly-spaced third rung
  // lands at L*71.3 — and only reaches ~2.3:1, so even spacing loses to
  // legibility and legibility wins. This sits at L*54.5, h94.0deg (within 3deg of
  // the ladder), 3.82:1 on `surface` and 3.68:1 on `backgroundWriting`.
  //
  // Deliberately NOT >=4.5:1: a placeholder that reads as strongly as entered
  // text stops reading as a prompt. 3.82:1 clears the 3:1 large-text floor on
  // both grounds with margin and is 2.3x what ships today. This holds only
  // while the placeholder stays SUPPLEMENTARY — both live call sites carry a
  // visible <Text> title stating the question. A placeholder that becomes a
  // field's only label is content, and needs 4.5:1, not this token.
  inkFaint: '#8F8256',
  textPrimary: '#221B03', // Alias of `ink`, kept for existing call sites.
  textSecondary: '#6B5F3D', // Alias of `inkSoft`, kept for existing call sites.
  textInverse: '#221B03', // Dark text for use on top of bright accent/accentDeep surfaces

  // ---------------------------------------------------------------------
  // Materials — the alpha register (Luxury Pass, Lane A).
  //
  // Every token below was a hand-typed literal at its call sites until now.
  // ALPHA LIVES IN THE TOKEN, NEVER AT THE CALL SITE: an alpha applied at the
  // call site has to be documented in a comment to be legible, and then the
  // comment is a dependency that goes stale the first time the value moves.
  // Three sites were doing exactly that by string-concatenating a hex pair
  // onto a token (`surface + 'D9'  // 85%`), which also made them invisible
  // to any gate keyed on `rgba(` or `#RRGGBB`.
  //
  // Each of these collects call sites that were ALREADY consistent with each
  // other; the audit that found them mistook two roles for one, and the roles
  // are recorded here so the next reader doesn't repeat it.

  // Modal scrim — the field a detail overlay sits on. NOT the same role as
  // `trackDim` below, despite both being ink-at-alpha: NotesInbox and
  // SeedsInbox are `detailOverlay`, and SeedsInbox's own comment says it
  // matches NotesInbox deliberately, "because a seed detail and a note detail
  // should be siblings." That was correct, not drift.
  scrim: 'rgba(26, 21, 0, 0.4)',

  // Unfilled progress-track fill — a 4pt rail, MemoryLane and PackageOpen.
  // A track is not a scrim; it is read against the filled portion beside it,
  // not against content floating on top of it.
  trackDim: 'rgba(34, 27, 3, 0.5)',

  // Glass — translucent white over live content. Two roles, and only the rim
  // ever actually drifted.
  //   fill: five sites, every one a 40x40 circular back button, byte-identical.
  //   rim:  Avatar was 0.6, GlassBackground 0.65. One value now; Avatar moves
  //         +0.05 on a 1pt border under 40pt. Named rather than buried.
  glassFill: 'rgba(255, 255, 255, 0.4)',
  glassRim: 'rgba(255, 255, 255, 0.65)',

  // Frosted veils over the tab bar (GlassBackground). Were `surface + 'D9'`
  // and `surface + '8C'`; 0xD9/255 = 0.851 and 0x8C/255 = 0.549 round-trip to
  // the same 8-bit alpha, so these render identically to what shipped.
  glassVeil: 'rgba(255, 255, 255, 0.851)',
  glassVeilSoft: 'rgba(255, 255, 255, 0.549)',

  // Marigold as an EDGE, not a fill — the active tab pill's border. Was
  // `rgba(255, 210, 0, 0.6)` hand-typed at MainTabs, which is `accent`
  // (#FFD200) retyped by hand, annotated with a comment claiming it was
  // Marigold. This module's own opening comment warns about precisely that
  // failure mode; this is the instance it predicted.
  accentEdge: 'rgba(255, 210, 0, 0.6)',

  // `accentDeep` at 10% — a warm tint wash behind an inline element
  // (TodayTab). Was `accentDeep + '1A'`; 0x1A/255 = 0.102.
  accentDeepWash: 'rgba(255, 122, 0, 0.102)',
};

// Two-stop washes, corner to corner: lit corner to shaded corner, so a
// surface reads as catching light rather than sitting flat. Every stop is a
// token reference — no literal hex lives here.
const gradients = {
  // `weekWash` and `monthWash` retired in §17.5: they existed for Recap's two
  // always-on insight cards, and both cards are gone — the week card because
  // it spoiled the reveal below it, the month card because the theme is now
  // something you earn by tapping the month. Retired rather than relocated,
  // per the ruling; a wash looking for a new home is how the peach kept
  // coming back.
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
