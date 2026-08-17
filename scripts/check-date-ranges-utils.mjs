// Direct unit coverage for src/utils/dateRanges.js's non-streak exports
// (issue: client layer has zero runtime tests). `currentStreak`,
// `longestStreak`, and `recentMonths` already have real coverage in
// check-streaks.mjs — not duplicated here. Everything else in the file —
// the timezone-safe date builders and the hive-week grouping — had no
// direct assertion anywhere; check-streaks.mjs only ever calls `toISODate`
// to build its own fixtures, it never asserts what `toISODate` returns.
//
//   npm run check:date-ranges-utils
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  toISODate,
  startOfWeek,
  endOfWeek,
  daysAgoISO,
  groupSharesByDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  monthName,
  STREAK_MILESTONES,
  isStreakMilestone,
  nextMilestone,
} = await import(path.join(ROOT, 'src/utils/dateRanges.js'));

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};
const eq = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) ok(label);
  else bad(label, `got ${a}, expected ${e}`);
};

// --- toISODate: local-date, not UTC-parsed ------------------------------
// The bug class this exists to correct for (check-streaks.mjs's own note):
// `new Date('2026-08-13')` parses as UTC midnight, which reads as the
// previous day anywhere west of Greenwich. Built from local Y/M/D
// components, toISODate must round-trip exactly.
eq('toISODate: local midnight round-trips', toISODate(new Date(2026, 7, 13)), '2026-08-13');
eq('toISODate: last day of month', toISODate(new Date(2026, 0, 31)), '2026-01-31');
eq('toISODate: pads single-digit month/day', toISODate(new Date(2026, 2, 5)), '2026-03-05');

// --- startOfWeek / endOfWeek: Monday-anchored ----------------------------
// day === 0 (Sunday) is the one branch with its own arithmetic (diff = -6
// instead of 1 - day), so it needs its own case, not just "a Wednesday".
eq('startOfWeek: mid-week (Wed) rolls back to Monday', toISODate(startOfWeek(new Date(2026, 7, 12))), '2026-08-10');
eq('startOfWeek: already Monday is a no-op', toISODate(startOfWeek(new Date(2026, 7, 10))), '2026-08-10');
eq('startOfWeek: Sunday rolls back to the Monday before it (not forward)', toISODate(startOfWeek(new Date(2026, 7, 16))), '2026-08-10');
eq('endOfWeek: same week as startOfWeek, six days later', toISODate(endOfWeek(new Date(2026, 7, 12))), '2026-08-16');

// --- daysAgoISO -----------------------------------------------------------
eq('daysAgoISO: 0 days ago is today', daysAgoISO(0, new Date(2026, 7, 13)), '2026-08-13');
eq('daysAgoISO: crosses a month boundary', daysAgoISO(5, new Date(2026, 7, 2)), '2026-07-28');

// --- groupSharesByDay: newest day first, share order preserved within a day
{
  const today = new Date(2026, 7, 13);
  const shares = [
    { id: 'a', entryDate: '2026-08-13' },
    { id: 'b', entryDate: '2026-08-11' },
    { id: 'c', entryDate: '2026-08-13' }, // same day as 'a', must stay in the same section, after it
    { id: 'd', createdAt: new Date(2026, 7, 12) }, // falls back to createdAt when entryDate is absent
  ];
  const sections = groupSharesByDay(shares, today);
  eq('groupSharesByDay: one section per distinct day', sections.map((s) => s.date), ['2026-08-13', '2026-08-12', '2026-08-11']);
  eq('groupSharesByDay: newest day first', sections[0].date, '2026-08-13');
  eq('groupSharesByDay: same-day shares land in one section, in arrival order', sections[0].shares.map((s) => s.id), ['a', 'c']);
  eq('groupSharesByDay: today\'s label', sections[0].label, 'Today');
  eq('groupSharesByDay: yesterday\'s label', sections[1].label, 'Yesterday');
  eq('groupSharesByDay: falls back to createdAt when entryDate is missing', sections[1].shares.map((s) => s.id), ['d']);
}
{
  const sections = groupSharesByDay([], new Date(2026, 7, 13));
  eq('groupSharesByDay: no shares -> no sections, not a section with nothing in it', sections, []);
}

// --- startOfMonth / endOfMonth / startOfYear / endOfYear -----------------
eq('startOfMonth', toISODate(startOfMonth(new Date(2026, 7, 19))), '2026-08-01');
eq('endOfMonth: 30-day month', toISODate(endOfMonth(new Date(2026, 8, 19))), '2026-09-30');
eq('endOfMonth: February in a non-leap year', toISODate(endOfMonth(new Date(2026, 1, 5))), '2026-02-28');
eq('endOfMonth: February in a leap year', toISODate(endOfMonth(new Date(2028, 1, 5))), '2028-02-29');
eq('startOfYear', toISODate(startOfYear(new Date(2026, 7, 19))), '2026-01-01');
eq('endOfYear', toISODate(endOfYear(new Date(2026, 7, 19))), '2026-12-31');

// --- monthName --------------------------------------------------------
eq('monthName', monthName(new Date(2026, 0, 1)), 'January');
eq('monthName: December, not off-by-one into next year', monthName(new Date(2026, 11, 1)), 'December');

// --- STREAK_MILESTONES / isStreakMilestone / nextMilestone --------------
eq('isStreakMilestone: a listed value', isStreakMilestone(30), true);
eq('isStreakMilestone: not a listed value', isStreakMilestone(31), false);
eq('isStreakMilestone: zero is not a milestone', isStreakMilestone(0), false);
eq('nextMilestone: between two milestones', nextMilestone(10), { target: 14, remaining: 4 });
eq('nextMilestone: exactly on a milestone still targets the next one (> not >=)', nextMilestone(30), { target: 60, remaining: 30 });
eq('nextMilestone: past the final milestone is null, not undefined coerced weird', nextMilestone(400), null);
eq('STREAK_MILESTONES: ascending, matches the values nextMilestone/isStreakMilestone rely on', STREAK_MILESTONES, [3, 7, 14, 30, 60, 100, 365]);

console.log(`\ncheck-date-ranges-utils: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
