import { toISODate } from './dateRanges';

// Sample lines per theme, written to actually match themeTagger's keyword
// lists so a freshly-tagged entry agrees with the theme we're assigning it —
// keeps Wrapped/Recap's dominant-theme math honest even on seeded data.
const SAMPLE_LINES = {
  Family: [
    'I am grateful for a quiet dinner with my family tonight.',
    'I am grateful my mom called just to check in.',
    'I am grateful for my kids laughing in the next room.',
    'I am grateful my dad taught me how to fix things.',
  ],
  Friendship: [
    'I am grateful for a long call with a friend I hadn’t heard from in a while.',
    'I am grateful my friends showed up when I needed them.',
    'I am grateful for an old friend who still gets my sense of humor.',
  ],
  Health: [
    'I am grateful for a good night’s sleep for once.',
    'I am grateful my body felt strong on today’s workout.',
    'I am grateful for the energy to get through a busy day.',
  ],
  Nature: [
    'I am grateful for the sunshine on my walk today.',
    'I am grateful for the quiet of the trees near my apartment.',
    'I am grateful for the ocean air this weekend.',
  ],
  Growth: [
    'I am grateful for the lesson a hard week taught me.',
    'I am grateful for the progress I made on a goal today.',
    'I am grateful I pushed through a real challenge today.',
  ],
  Career: [
    'I am grateful for a good meeting with my team today.',
    'I am grateful to be close to finishing a project I care about.',
    'I am grateful for a boss who actually listens.',
  ],
  Joy: [
    'I am grateful for a genuine laugh with someone today.',
    'I am grateful for good coffee and a slow morning.',
    'I am grateful for music that turned my whole day around.',
  ],
  Faith: [
    'I am grateful for a moment of real quiet to pray today.',
    'I am grateful to feel blessed even on an ordinary day.',
  ],
  Creativity: [
    'I am grateful for an hour to just write today.',
    'I am grateful for a burst of a good idea out of nowhere.',
  ],
};

// Roughly matches a believable real-user spread rather than a flat
// distribution, so Wrapped's "top 3 themes" reads like an actual year.
const THEME_WEIGHTS = [
  ['Family', 24], ['Friendship', 16], ['Health', 14], ['Joy', 12],
  ['Growth', 10], ['Career', 9], ['Nature', 8], ['Creativity', 4], ['Faith', 3],
];

const weightedTheme = (rand) => {
  const total = THEME_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [theme, weight] of THEME_WEIGHTS) {
    if (roll < weight) return theme;
    roll -= weight;
  }
  return THEME_WEIGHTS[0][0];
};

// Small deterministic PRNG (mulberry32) so a given seed always produces the
// same demo year — reproducible if we need to regenerate for a screenshot.
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Builds `days` consecutive daily entries ending today (inclusive), keyed
// the same way EntryStore keys real entries. Every day filled — this is a
// demo account, the point is a maxed-out streak and a full Wrapped year.
export const buildDemoEntries = (days = 180, seed = 42) => {
  const rand = mulberry32(seed);
  const entries = {};
  const today = new Date();

  for (let i = 0; i < days; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    const theme = weightedTheme(rand);
    const lines = SAMPLE_LINES[theme];
    const text = lines[Math.floor(rand() * lines.length)];
    const key = toISODate(date);
    entries[key] = {
      text,
      theme,
      savedAt: date.toISOString(),
    };
  }

  return entries;
};
