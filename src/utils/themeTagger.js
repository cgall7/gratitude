// Lightweight keyword tagging so weekly/monthly/yearly recaps have a real
// theme to show without wiring an AI call. Swap for the GPT-4o-mini pass
// mentioned in the README later without changing any of the call sites —
// they only care about the returned theme string.
export const THEMES = [
  { key: 'Family', keywords: ['family', 'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'kids', 'children', 'parent', 'grandma', 'grandpa', 'husband', 'wife', 'spouse'] },
  { key: 'Friendship', keywords: ['friend', 'friends', 'buddy', 'colleague', 'coworker'] },
  { key: 'Health', keywords: ['health', 'healthy', 'body', 'workout', 'exercise', 'sleep', 'rest', 'energy', 'healing'] },
  { key: 'Nature', keywords: ['sun', 'sunshine', 'sky', 'tree', 'trees', 'ocean', 'beach', 'walk', 'outside', 'weather', 'rain', 'garden', 'nature'] },
  { key: 'Growth', keywords: ['learned', 'growth', 'lesson', 'challenge', 'progress', 'improve', 'goal'] },
  { key: 'Career', keywords: ['work', 'job', 'project', 'team', 'boss', 'career', 'client', 'meeting'] },
  { key: 'Joy', keywords: ['laugh', 'laughed', 'fun', 'joy', 'happy', 'smile', 'music', 'coffee', 'food'] },
  { key: 'Faith', keywords: ['god', 'faith', 'pray', 'prayer', 'blessed', 'spirit', 'church'] },
  { key: 'Creativity', keywords: ['art', 'music', 'write', 'writing', 'create', 'creative', 'idea', 'design'] },
];

export const FALLBACK_THEME = 'Reflection';

export const tagEntry = (text) => {
  if (!text) return FALLBACK_THEME;
  const lower = text.toLowerCase();
  let best = FALLBACK_THEME;
  let bestScore = 0;
  for (const theme of THEMES) {
    const score = theme.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = theme.key;
    }
  }
  return best;
};

// entries: [{ text, theme? }] — falls back to tagging on the fly if untagged
export const dominantTheme = (entries) => {
  if (!entries || entries.length === 0) return null;
  const counts = {};
  for (const entry of entries) {
    const key = entry.theme || tagEntry(entry.text);
    counts[key] = (counts[key] || 0) + 1;
  }
  const [theme, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { theme, count, total: entries.length };
};
