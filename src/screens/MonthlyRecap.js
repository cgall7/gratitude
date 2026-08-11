import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Defs, Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { DURATIONS, staggerDelay, useReducedMotion } from '../constants/motion';
import { StaggeredItem } from '../components/StaggeredItem';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { ThemeCardFlip } from '../components/ThemeCardFlip';
import { StripePattern } from '../components/StripeTexture';
import { useSvgId } from '../utils/svgId';
import { tagEntry } from '../utils/themeTagger';
import { COLS, HEX_ASPECT, combLayout, hexAt, hexPoints } from '../utils/combGeometry';

// §17.5 — the month grid is a true honeycomb: cells share walls instead of
// sitting in a square lattice with air between them. The lattice itself
// (hex vertices, row parity, hit-testing) lives in `utils/combGeometry` so
// it can be exercised without a renderer.

// The reveal card's header hex. Same generator as the comb, so it is the
// same shape at a different size rather than a lookalike (R36).
const REVEAL_HEX_W = 30;
const REVEAL_HEX_H = REVEAL_HEX_W * HEX_ASPECT;

// R38 (Pixel, 2026-08-11 device matrix): a sibling group of `<Svg>` roots
// displaces the minority configuration by exactly ⅔·cellH, regardless of
// what its `Polygon` props look like — prop identity was ruled out (variant
// E), and the trigger is cardinality of Svg-root configs in the group, not
// color. The only census that rule can't punish is one: the whole comb, the
// selection ring, and every day's fill/stroke now paint from a SINGLE
// shared `<Svg>` (below, in the main render), so this file never mounts a
// second Svg-root config near the grid. Everything below is plain RN views
// animated on the native driver — no SVG, so nothing here can trigger it.

// Only ever mounted when `!reduced` (see DayCell below) — accentBurst is
// "motion only" per its own theme token comment, and Reduce Motion's flat
// fade already lives on the numeral's StaggeredItem.
const CellGlow = ({ index, count, cascade, w, h }) => {
  // Same motif as StreakHexTrail's ignite glow (`StreakHexTrail.js:89`) —
  // one ramp 0→1, read through a bloom-then-fade interpolation, rather than
  // an explicit up/down animation.
  const glow = useRef(new Animated.Value(0)).current;
  const lastCascade = useRef(cascade);

  useEffect(() => {
    if (lastCascade.current !== cascade) {
      lastCascade.current = cascade;
      glow.setValue(0);
    }
    // Same R18 hazard `StaggeredItem` guards against: a second month swipe
    // inside the 700ms cascade re-fires this effect while the previous
    // glow is still animating. Stop it first so the loser can't strand the
    // value mid-fade.
    Animated.timing(glow, {
      toValue: 1,
      duration: DURATIONS.arrival,
      delay: staggerDelay(index, count),
      useNativeDriver: true,
    }).start();
    return () => glow.stopAnimation();
  }, [cascade]);

  const opacity = glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] });
  // Deezine (2026-08-11): at [0.6, 1.3] the bloom peaks (glow=0.3) at scale
  // 0.81 — still inside the hex, so max brightness is accentBurst painted
  // over accent, a 14/255 shift nobody sees. StreakHexTrail's version reads
  // outside the hex, against cream; ours has to clear the hex's own edge
  // before it's visible. [0.95, 1.6] puts scale at ~1.145 when opacity
  // peaks, so the halo is outside the hex right when it's brightest.
  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.cellGlow, { width: w, height: h, borderRadius: w / 2, opacity, transform: [{ scale }] }]}
    />
  );
};

// The comb's paint (fill, stroke, hatch, selection ring) lives entirely in
// the shared `<Svg>` in the main render now. This is only the stuff that
// sits ON TOP of that paint: the day numeral (plain RN `<Text>`, always
// was) and, for a filled day, its ignite glow — the streak trail's motif
// (`StreakHexTrail.js:163`) applied to a calendar, since a filled cell IS a
// streak hex igniting (`StaggeredItem.js:10` already said so for the pop).
// Only the days you actually earned animate; empty days are scenery.
const DayCell = ({ day, filled, index, filledCount, cascade, reduced, w, h, x, y }) => (
  <View style={[styles.cellPosition, { left: x, top: y, width: w, height: h }]} pointerEvents="none">
    {/* Deezine (2026-08-11): accentBurst is motion-only by its own token
        comment. Gated on `filled` alone, Reduce Motion still ran every
        filled cell's glow as a simultaneous flat flash — the scale pins to
        1 but the flash itself isn't motion-free. StreakHexTrail's own
        Reduce Motion path only glows once, for its last hex, inside a
        celebration the user opened; thirty-one at once on arrival isn't
        that. §12.5 Rule 4 wants a flat fade here, which the numeral's
        StaggeredItem already carries alone. */}
    {filled && !reduced && (
      <CellGlow index={index} count={filledCount} cascade={cascade} w={w} h={h} />
    )}
    {filled ? (
      <StaggeredItem index={index} count={filledCount} replayKey={cascade} pop style={styles.dayNumberOverlay}>
        <Text style={[styles.dateText, styles.dateTextFilled]}>{day}</Text>
      </StaggeredItem>
    ) : (
      <View style={styles.dayNumberOverlay} pointerEvents="none">
        <Text style={styles.dateText}>{day}</Text>
      </View>
    )}
  </View>
);

// R35: the day opens IN PLACE, directly under the comb — not a modal, not a
// navigation push. The card is the hive's reveal card
// (`HoneycombGrid.js:187-207`) in the same component language, because
// tapping a day here and tapping a person there are the same gesture
// answered the same way; the rhyme is the point.
const DayRevealCard = ({ monthName, day, entries, progress, reduced, w, h }) => (
  <Animated.View
    style={[
      styles.revealCard,
      {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [reduced ? 0 : 10, 0],
            }),
          },
        ],
      },
    ]}
  >
    <View style={styles.revealHeader}>
      {/* The cell's own fill state, shrunk — the card wears the motif it
          came from instead of a generic icon roundel. */}
      <View style={styles.revealHex}>
        <Svg width={w} height={h}>
          <Polygon
            points={hexPoints(w, h)}
            fill={theme.colors.accent}
            stroke={theme.colors.accentDeep}
            strokeWidth={1}
          />
        </Svg>
        <View style={styles.revealHexNumeral} pointerEvents="none">
          <Text style={styles.revealHexText}>{day}</Text>
        </View>
      </View>
      <Text style={styles.revealDate}>
        {monthName} {day}
      </Text>
      <Text style={styles.revealCount}>
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </Text>
    </View>

    {entries.map((entry, index) => (
      <View key={`${entry.date}-${index}`} style={index > 0 && styles.revealEntryRule}>
        <Text style={styles.revealQuote}>“{entry.text}”</Text>
        <Text style={styles.revealTheme}>{entry.theme || tagEntry(entry.text)}</Text>
      </View>
    ))}
  </Animated.View>
);

export const MonthlyRecap = ({
  monthName,
  // Display override for the title only — the pager adds a year once it
  // scrolls past December, while `monthName` stays bare so the per-day
  // VoiceOver labels read "December 14", not "December 2025 14".
  title,
  entries,
  daysInMonth = 31,
  insightTheme,
  insightDescription,
  onPreviewWrapped,
  // False for the pages either side of the one you're looking at. Defaults
  // true so a lone MonthlyRecap behaves exactly as it did before the pager.
  active = true,
}) => {
  // entries = [{ date: '2026-07-01', text: '...', theme: 'Family' }, ...]
  const hasEntries = entries.length > 0;
  // Sized off the live window (not a module-scope Dimensions read) so
  // rotation and split-view don't leave a stale comb: screen width, less
  // RecapTab's 24pt padding each side. R33: no gap term — the comb has no
  // gaps to subtract, and nothing from the analysis basis is frozen here.
  const { width } = useWindowDimensions();
  const cellW = Math.floor((width - 48) / COLS);
  const cellH = cellW * HEX_ASPECT;

  const { cells, height } = useMemo(
    () => combLayout(daysInMonth, cellW, cellH),
    [daysInMonth, cellW, cellH]
  );
  const points = useMemo(() => hexPoints(cellW, cellH), [cellW, cellH]);
  // One hatch pattern per mounted MonthlyRecap, not per cell: R38's shared
  // root paints every empty cell's hatch from the same `<Defs>` entry, and
  // the pager keeps several months' combs mounted at once (Pixel's variant
  // I, 2026-08-11), so the id still has to be unique per screen instance.
  const hatchId = useSvgId('recapHatch');

  // Index entries by day-of-month so each one lands on its real date. The
  // grid used to render every filled day first and then pad with empties,
  // which made three scattered entries look like the 1st, 2nd and 3rd —
  // a tally wearing a calendar's clothes.
  const entriesByDay = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const day = parseInt(entry.date.split('-')[2], 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(entry);
    }
    return map;
  }, [entries]);

  const [selectedDay, setSelectedDay] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [cascade, setCascade] = useState(0);
  const reduced = useReducedMotion();
  const revealProgress = useRef(new Animated.Value(0)).current;

  // R35: both reveals belong to their month, so scrolling away takes them
  // with it — a card whose content outlived the comb it was opened from is
  // the confusing kind of persistence.
  useEffect(() => {
    setSelectedDay(null);
    setThemeOpen(false);
  }, [monthName, active]);

  // §17.5: the incoming grid re-staggers on a page turn. Skipped on mount,
  // where StaggeredItem's own entrance is already the cascade — bumping the
  // replay key there would start a second one a render later.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (active) setCascade((c) => c + 1);
  }, [active]);

  // The card names a theme, so it should quote an entry that IS that theme —
  // the first one that tags to it, falling back to the month's opener if the
  // dominant theme came from entries that all tag on the fly.
  const themeSnippet = useMemo(() => {
    const match = entries.find((entry) => (entry.theme || tagEntry(entry.text)) === insightTheme);
    return (match || entries[0])?.text;
  }, [entries, insightTheme]);

  const openDay = (day) => {
    // R35: re-tapping the open day closes it; tapping a different filled day
    // swaps the content in place, with no close/reopen cycle — replaying the
    // rise on a card that never left the screen reads as a flinch.
    if (day === selectedDay) {
      setSelectedDay(null);
      return;
    }
    const wasOpen = selectedDay !== null;
    setSelectedDay(day);
    if (wasOpen) return;
    revealProgress.setValue(0);
    Animated.timing(revealProgress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : DURATIONS.revealGlide,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const cell = hexAt(locationX, locationY, cells, cellW, cellH);
    // Empty days don't open — the reveal is the entry, and there isn't one.
    if (!cell || !entriesByDay.has(cell.day)) return;
    openDay(cell.day);
  };

  const selectedCell = selectedDay === null ? null : cells.find((c) => c.day === selectedDay);
  const selectedEntries = selectedDay === null ? [] : entriesByDay.get(selectedDay) || [];

  // One pass, shared by the Svg paint layer, the numeral/glow overlay and
  // the accessibility layer below — all three walk the same cells in the
  // same order, so the stagger index a filled day gets for its glow is the
  // same one it gets for its numeral pop.
  const cellRenderData = useMemo(() => {
    let filledSoFar = 0;
    return cells.map((cell) => {
      const dayEntries = entriesByDay.get(cell.day) || [];
      const filled = dayEntries.length > 0;
      return { cell, dayEntries, filled, index: filled ? filledSoFar++ : 0 };
    });
  }, [cells, entriesByDay]);

  return (
    <View style={styles.content}>
      {/* §17.5: the month's theme is something you tap for, not furniture
          that sits above the comb announcing itself. The title carries the
          affordance — a month with nothing in it has nothing to reveal, so
          it renders as plain text with no phantom tap target. */}
      {hasEntries ? (
        <PressableScale
          onPress={() => setThemeOpen((open) => !open)}
          style={styles.titleRow}
          accessibilityLabel={
            themeOpen
              ? `${monthName}, hide this month's theme`
              : `${monthName}, reveal this month's theme`
          }
        >
          <Text style={styles.title}>{title || monthName}</Text>
          <Ionicons
            name={themeOpen ? 'sparkles' : 'sparkles-outline'}
            size={18}
            color={theme.colors.accentDeep}
            style={styles.titleHint}
          />
        </PressableScale>
      ) : (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title || monthName}</Text>
        </View>
      )}

      {/* Mounted on open, so the gold-back flip replays every time rather
          than only on the screen's first render. */}
      {themeOpen && (
        <View style={styles.themeCardSlot}>
          <ThemeCardFlip
            themeWord={insightTheme}
            snippet={themeSnippet}
            caption={insightDescription}
          />
        </View>
      )}

      {/* The comb — one hexagon per calendar day, in date order. Every
          cell's fill, stroke, hatch, AND the selection ring paint from this
          one shared `<Svg>` root — see R38 above. 1pt of bleed on every
          side (root sized w+2/h+2, contents translated +1,+1, positioned at
          -1,-1) so a full-strength 2pt selection ring on an edge cell has
          somewhere to paint instead of clipping against the root's own
          edge — the same trick the old per-cell SelectionRing used, now
          applied once instead of on every tap. */}
      <View style={[styles.comb, { width: cellW * COLS, height }]}>
        <Svg width={cellW * COLS + 2} height={height + 2} style={styles.combSvg}>
          <Defs>
            <StripePattern id={hatchId} />
          </Defs>
          {/* Deezine (2026-08-11): a 1pt stroke on a shared wall paints
              twice in one root, and the later element wins — so painting
              in date order let a later empty day eat a filled day's wall.
              Empties first, then every filled cell, so a filled hex always
              owns its complete outline regardless of date. Order within
              a group doesn't matter: every member of it strokes the same
              color, so whichever paints second is a no-op repaint. */}
          {cellRenderData
            .filter(({ filled }) => !filled)
            .map(({ cell }) => (
              <Polygon
                key={cell.day}
                points={points}
                transform={`translate(${cell.x + 1} ${cell.y + 1})`}
                fill={`url(#${hatchId})`}
                stroke={theme.colors.surfaceBorderStrong}
                strokeWidth={1}
              />
            ))}
          {cellRenderData
            .filter(({ filled }) => filled)
            .map(({ cell }) => (
              <Polygon
                key={cell.day}
                points={points}
                transform={`translate(${cell.x + 1} ${cell.y + 1})`}
                fill={theme.colors.accent}
                stroke={theme.colors.accentDeep}
                strokeWidth={1}
              />
            ))}
          {selectedCell && (
            <Polygon
              points={points}
              transform={`translate(${selectedCell.x + 1} ${selectedCell.y + 1})`}
              fill="none"
              stroke={theme.colors.ink}
              strokeWidth={2}
            />
          )}
        </Svg>

        {cellRenderData.map(({ cell, filled, index }) => (
          <DayCell
            key={cell.day}
            day={cell.day}
            filled={filled}
            index={index}
            filledCount={entriesByDay.size}
            cascade={cascade}
            reduced={reduced}
            w={cellW}
            h={cellH}
            x={cell.x}
            y={cell.y}
          />
        ))}

        {/* R33: exactly one Pressable for the whole comb. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handlePress}
          accessible={false}
        />

        {/* §17.7-adjacent: per-day screen-reader targets. `pointerEvents:
            none` keeps them out of the touch path (the overlay above owns
            every tap) while leaving them in the accessibility tree, so
            VoiceOver can still land on an individual day. This composition
            is UNVERIFIED on device — it is the mechanism half of R34's
            ratified requirement and is on the device-pass list. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {cellRenderData.map(({ cell, dayEntries, filled }) => (
            <View
              key={cell.day}
              accessible
              accessibilityRole={filled ? 'button' : undefined}
              accessibilityLabel={
                filled
                  ? `${monthName} ${cell.day}, ${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'}`
                  : `${monthName} ${cell.day}, no entry`
              }
              onAccessibilityTap={filled ? () => openDay(cell.day) : undefined}
              style={[styles.cellPosition, { left: cell.x, top: cell.y, width: cellW, height: cellH }]}
            />
          ))}
        </View>
      </View>

      {/* Directly below the comb, and after it in tree order — which is also
          the reading order VoiceOver walks, so the card lands right after the
          day that opened it. */}
      {selectedDay !== null && (
        <DayRevealCard
          monthName={monthName}
          day={selectedDay}
          entries={selectedEntries}
          progress={revealProgress}
          reduced={reduced}
          w={REVEAL_HEX_W}
          h={REVEAL_HEX_H}
        />
      )}

      <Text style={styles.gridCaption}>
        {hasEntries
          ? `${entriesByDay.size} of ${daysInMonth} days filled in`
          : 'No entries this month yet.'}
      </Text>

      <PrimaryButton onPress={onPreviewWrapped} style={styles.wrappedTeaser}>
        Preview your annual Wrapped
      </PrimaryButton>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  // The whole affordance: one small mark that fills in once the card is
  // open. Anything louder would be the PRIMARY THEME card again, wearing a
  // smaller hat.
  titleHint: {
    marginTop: 2,
  },
  themeCardSlot: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  // Cells are absolutely positioned: the 0.75h row pitch means rows must
  // overlap, which no flex row can express.
  comb: {
    position: 'relative',
  },
  cellPosition: {
    position: 'absolute',
  },
  // R38: 1pt bleed on every side so the selection ring's outer 1pt (of its
  // 2pt stroke, centred on the path) has room to paint on an edge cell
  // instead of clipping against the root's own bounds.
  combSvg: {
    position: 'absolute',
    left: -1,
    top: -1,
  },
  dayNumberOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellGlow: {
    position: 'absolute',
    backgroundColor: theme.colors.accentBurst,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.inkSoft,
    fontFamily: theme.fonts.bodyMedium,
  },
  dateTextFilled: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.bodySemiBold,
  },
  // R35 — the hive's `revealCard` treatment, matched deliberately: white
  // surface, hairline border, card shadow. `alignSelf: stretch` because this
  // one sits in a centring column, where the hive's sits in a full-width one.
  revealCard: {
    alignSelf: 'stretch',
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    ...theme.shadows.card,
  },
  revealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  revealHex: {
    width: REVEAL_HEX_W,
    height: REVEAL_HEX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealHexNumeral: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealHexText: {
    fontSize: 12,
    color: theme.colors.ink,
    fontFamily: theme.fonts.bodySemiBold,
  },
  revealDate: {
    fontFamily: theme.fonts.header,
    fontSize: 17,
    color: theme.colors.ink,
  },
  // Pushed right by the header's own flex, so the count sits at the card's
  // edge no matter how long the month's name is.
  revealCount: {
    ...theme.type.bodySm,
    marginLeft: 'auto',
    color: theme.colors.inkSoft,
  },
  // Hairline between entries only — a rule above the first one would fence
  // the day off from its own header.
  revealEntryRule: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceBorder,
  },
  revealQuote: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  revealTheme: {
    ...theme.type.label,
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.colors.inkSoft,
    marginTop: 8,
  },
  gridCaption: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 16,
    marginBottom: 32,
  },
  wrappedTeaser: {
    marginTop: 4,
  },
});
