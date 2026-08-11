import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Defs, Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { StaggeredItem } from '../components/StaggeredItem';
import { PrimaryButton } from '../components/PrimaryButton';
import { GradientCard } from '../components/GradientCard';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { StripePattern } from '../components/StripeTexture';
import { useSvgId } from '../utils/svgId';
import { COLS, HEX_ASPECT, combLayout, hexAt, hexPoints } from '../utils/combGeometry';

// §17.5 — the month grid is a true honeycomb: cells share walls instead of
// sitting in a square lattice with air between them. The lattice itself
// (hex vertices, row parity, hit-testing) lives in `utils/combGeometry` so
// it can be exercised without a renderer.

const DayCell = ({ day, entries, index, filledCount, w, h, x, y, points }) => {
  const filled = entries.length > 0;
  // The hatch is a `<Defs>` fill on the hex itself, so it follows the six
  // edges exactly — an overlay clipped by `overflow: hidden` would square
  // off the corners.
  const hatchId = useSvgId('emptyHatch');
  const cell = (
    <View style={[styles.cell, { width: w, height: h }]}>
      <Svg width={w} height={h}>
        {!filled && (
          <Defs>
            <StripePattern id={hatchId} />
          </Defs>
        )}
        <Polygon
          points={points}
          fill={filled ? theme.colors.accent : `url(#${hatchId})`}
          stroke={filled ? theme.colors.accentDeep : theme.colors.surfaceBorderStrong}
          strokeWidth={1}
        />
      </Svg>
      <View style={styles.dayNumberOverlay} pointerEvents="none">
        <Text style={[styles.dateText, filled && styles.dateTextFilled]}>{day}</Text>
      </View>
    </View>
  );

  // Only the days you actually earned cascade in; empty days are scenery and
  // shouldn't each cost an animation.
  return (
    <View style={[styles.cellPosition, { left: x, top: y }]} pointerEvents="none">
      {filled ? (
        <StaggeredItem index={index} count={filledCount} pop>
          {cell}
        </StaggeredItem>
      ) : (
        cell
      )}
    </View>
  );
};

export const MonthlyRecap = ({
  monthName,
  entries,
  daysInMonth = 31,
  insightTheme,
  insightDescription,
  onPreviewWrapped,
  onSelectDay,
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

  const handlePress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const cell = hexAt(locationX, locationY, cells, cellW, cellH);
    // Empty days don't open — the reveal is the entry, and there isn't one.
    if (!cell || !entriesByDay.has(cell.day)) return;
    onSelectDay?.(cell.day, entriesByDay.get(cell.day));
  };

  let filledSoFar = 0;

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{monthName}</Text>

      {/* Theme Insight Card */}
      <GradientCard
        colors={theme.gradients.monthWash}
        style={styles.insightCardOuter}
        contentStyle={styles.insightCard}
      >
        <GradientIconBadge icon="sparkles" style={styles.insightBadge} />
        <Text style={styles.insightLabel}>PRIMARY THEME</Text>
        <Text style={styles.insightValue}>
          {hasEntries ? insightTheme : 'No entries yet'}
        </Text>
        <Text style={styles.insightDesc}>
          {hasEntries
            ? insightDescription
            : 'Write your first entry to start building this month\'s theme.'}
        </Text>
      </GradientCard>

      {/* The comb — one hexagon per calendar day, in date order */}
      <View style={[styles.comb, { width: cellW * COLS, height }]}>
        {cells.map((cell) => {
          const dayEntries = entriesByDay.get(cell.day) || [];
          const staggerIndex = dayEntries.length > 0 ? filledSoFar++ : 0;
          return (
            <DayCell
              key={cell.day}
              day={cell.day}
              entries={dayEntries}
              index={staggerIndex}
              filledCount={entries.length}
              w={cellW}
              h={cellH}
              x={cell.x}
              y={cell.y}
              points={points}
            />
          );
        })}

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
          {cells.map((cell) => {
            const dayEntries = entriesByDay.get(cell.day) || [];
            const filled = dayEntries.length > 0;
            return (
              <View
                key={cell.day}
                accessible
                accessibilityRole={filled ? 'button' : undefined}
                accessibilityLabel={
                  filled
                    ? `${monthName} ${cell.day}, ${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'}`
                    : `${monthName} ${cell.day}, no entry`
                }
                onAccessibilityTap={
                  filled ? () => onSelectDay?.(cell.day, dayEntries) : undefined
                }
                style={[styles.cellPosition, { left: cell.x, top: cell.y, width: cellW, height: cellH }]}
              />
            );
          })}
        </View>
      </View>

      <Text style={styles.gridCaption}>
        {entries.length} of {daysInMonth} days filled in
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
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
    marginBottom: 24,
    textAlign: 'center',
  },
  // Split in two on purpose: `overflow: hidden` is what clips the wash to
  // the rounded corners, and on the same node it kills the iOS shadow. The
  // outer view carries radius + shadow, the inner one carries the clip.
  // The `backgroundColor` is invisible (the clip sits on top of it) but not
  // decorative — iOS derives a shadow from an opaque layer, and falls back
  // to reading the contents' alpha channel when there isn't one.
  insightCardOuter: {
    width: '100%',
    marginBottom: 32,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    alignItems: 'center',
  },
  insightBadge: {
    marginBottom: 12,
  },
  insightLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  insightValue: {
    ...theme.type.h1,
    fontSize: 36,
    color: theme.colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  insightDesc: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  // Cells are absolutely positioned: the 0.75h row pitch means rows must
  // overlap, which no flex row can express.
  comb: {
    position: 'relative',
  },
  cellPosition: {
    position: 'absolute',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
