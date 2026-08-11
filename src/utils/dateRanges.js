export const toISODate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfWeek = (date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
export const startOfYear = (date) => new Date(date.getFullYear(), 0, 1);
export const endOfYear = (date) => new Date(date.getFullYear(), 11, 31);

export const monthName = (date) => date.toLocaleString('default', { month: 'long' });

// The streak you're *on* right now — the one worth putting on the home
// screen. Counts back from today; a today-less run still counts as long as
// yesterday is there, so the streak doesn't visibly "break" at midnight
// before you've had a chance to write.
export const currentStreak = (entries, today = new Date()) => {
  if (entries.length === 0) return 0;
  const dates = new Set(entries.map((entry) => entry.date));
  const cursor = new Date(today);
  // Anchor on today if it's logged, otherwise yesterday — anything older
  // means the run is already over.
  if (!dates.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(toISODate(cursor))) return 0;
  }
  let streak = 0;
  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

// Streak lengths that earn a burst instead of a quiet tick (§14.1: bursts
// on every positive moment, with the big ones reserved for real landmarks).
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export const isStreakMilestone = (streak) => STREAK_MILESTONES.includes(streak);

// The next landmark to chase, and how close you are — the "3 more days"
// line that turns a number into a goal. Null once every milestone is past.
export const nextMilestone = (streak) => {
  const target = STREAK_MILESTONES.find((milestone) => milestone > streak);
  return target ? { target, remaining: target - streak } : null;
};

// entries must be sorted ascending by ISO date string
export const longestStreak = (entries) => {
  let longest = 0;
  let current = 0;
  let prevDate = null;
  for (const entry of entries) {
    const d = new Date(entry.date);
    if (prevDate) {
      const diffDays = Math.round((d - prevDate) / 86400000);
      current = diffDays === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    prevDate = d;
  }
  return longest;
};
