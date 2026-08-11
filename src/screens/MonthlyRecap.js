import React from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { theme } from '../constants/theme';
import { StaggeredItem } from '../components/StaggeredItem';
import { PrimaryButton } from '../components/PrimaryButton';

// Pointy-top hex, sized to fit a `size`-wide box — the month grid is made
// of the same cells as the hive, not generic rounded squares.
const hexPoints = (width, height) => {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    points.push(`${width / 2 + (width / 2) * Math.cos(angle)},${height / 2 + (height / 2) * Math.sin(angle)}`);
  }
  return points.join(' ');
};

const DayCell = ({ day, entry, index, size }) => {
  const filled = !!entry;
  const cell = (
    <View style={[styles.gridItem, { width: size, height: size * 1.1 }]}>
      <Svg width={size} height={size * 1.1}>
        <Polygon
          points={hexPoints(size, size * 1.1)}
          fill={filled ? theme.colors.accent : theme.colors.surface}
          fillOpacity={filled ? 1 : 0.5}
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
  return filled ? <StaggeredItem index={index}>{cell}</StaggeredItem> : cell;
};

export const MonthlyRecap = ({
  monthName,
  entries,
  daysInMonth = 31,
  insightTheme,
  insightDescription,
  onPreviewWrapped,
}) => {
  // entries = [{ date: '2026-07-01', text: '...', theme: 'Family' }, ...]
  const hasEntries = entries.length > 0;
  // 7 cells across, sized off the live window (not a module-scope
  // Dimensions read) so rotation and split-view don't leave a stale grid:
  // screen width, less RecapTab's 24pt padding each side, less six 8pt gaps.
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - 48 - 6 * 8) / 7);

  // Index entries by day-of-month so each one lands on its real date. The
  // grid used to render every filled day first and then pad with empties,
  // which made three scattered entries look like the 1st, 2nd and 3rd —
  // a tally wearing a calendar's clothes.
  const entryByDay = new Map(
    entries.map((entry) => [parseInt(entry.date.split('-')[2], 10), entry])
  );

  let filledSoFar = 0;

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{monthName}</Text>

      {/* Theme Insight Card */}
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>PRIMARY THEME</Text>
        <Text style={styles.insightValue}>
          {hasEntries ? insightTheme : 'No entries yet'}
        </Text>
        <Text style={styles.insightDesc}>
          {hasEntries
            ? insightDescription
            : 'Write your first entry to start building this month\'s theme.'}
        </Text>
      </View>

      {/* Gratitude Grid — one cell per calendar day, in date order */}
      <View style={styles.grid}>
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const entry = entryByDay.get(day);
          const staggerIndex = entry ? filledSoFar++ : 0;
          return (
            <DayCell key={day} day={day} entry={entry} index={staggerIndex} size={cellSize} />
          );
        })}
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
  insightCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 28,
    marginBottom: 32,
    alignItems: 'center',
    ...theme.shadows.card,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  gridItem: {
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
