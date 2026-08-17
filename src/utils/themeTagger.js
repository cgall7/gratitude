// Lightweight keyword tagging so weekly/monthly/yearly recaps have a real
// theme to show without wiring an AI call. Swap for the GPT-4o-mini pass
// mentioned in the README later without changing any of the call sites —
// they only care about the returned theme string.
//
// Each keyword is a whole-word match by default. Wrap a term in stem() to
// let it match inside a longer word (e.g. 'mother' inside 'grandmother').
// No mechanical rule (prefix/suffix position) separates the two cases —
// both 'work'/'workday' and 'mom'/'moment' are prefixes, only one is a
// real hit — so stem() is applied per keyword, verified against the
// corpus, not per algorithm.
const stem = (term) => ({ term, stem: true });

export const THEMES = [
  { key: 'Family', keywords: ['family', 'mom', 'dad', stem('mother'), stem('father'), 'sister', 'brother', 'kids', 'children', 'parent', 'grandma', 'grandpa', 'husband', 'wife', 'spouse'] },
  { key: 'Friendship', keywords: ['friend', 'friends', 'buddy', 'colleague', 'coworker'] },
  { key: 'Health', keywords: ['health', 'healthy', 'body', 'workout', 'exercise', stem('sleep'), 'rest', 'energy', 'healing'] },
  { key: 'Nature', keywords: ['sun', 'sunshine', 'sunlight', 'sky', 'tree', 'trees', 'ocean', 'beach', 'walk', 'outside', 'weather', 'rain', 'garden', 'nature'] },
  { key: 'Growth', keywords: ['learned', 'growth', 'lesson', 'challenge', 'progress', 'improve', 'goal'] },
  { key: 'Career', keywords: [stem('work'), 'job', 'project', 'team', 'boss', 'career', 'client', 'meeting'] },
  { key: 'Joy', keywords: ['laugh', 'laughed', 'fun', 'joy', 'happy', 'smile', 'music', 'coffee', 'food'] },
  { key: 'Faith', keywords: ['god', 'faith', stem('pray'), 'prayer', 'blessed', 'spirit', 'church'] },
  { key: 'Creativity', keywords: ['art', 'music', 'write', 'writing', 'create', 'creative', 'idea', 'design'] },
];

export const FALLBACK_THEME = 'Reflection';

const escapeRegExp = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesKeyword = (lower, keyword) => {
  if (typeof keyword === 'string') {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(lower);
  }
  return lower.includes(keyword.term);
};

export const tagEntry = (text) => {
  if (!text) return FALLBACK_THEME;
  const lower = text.toLowerCase();
  let best = FALLBACK_THEME;
  let bestScore = 0;
  for (const theme of THEMES) {
    const score = theme.keywords.reduce((acc, kw) => acc + (matchesKeyword(lower, kw) ? 1 : 0), 0);
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
