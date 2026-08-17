// The words that may not appear in Pollinate's copy, and the pattern that
// decides whether a string contains one.
//
// A LEAF MODULE ON PURPOSE — no imports, no side effects, nothing to run. Two
// gates consume it (`check-copy-rules`, `check-demo-hive`) and a gate cannot
// import a module that exits the process on load. Keep it dependency-free.
//
// WHERE THE RULES COME FROM
//
// Colin, 2026-08-11 (R15): onboarding's register is subtly Christian and none
// of the religious words below may appear on a screen. "hallelujah" is the
// guiding principle for the writing and is explicitly the word most banned
// from the surface.
// Colin, 2026-08-10: he hates the word "ritual".
//
// WHY EACH WORD CARRIES ITS OWN PATTERN
//
// Three candidate rules, measured over the 451 real copy strings under `src/`
// at f0df9c2:
//
//   raw substring       4 hits, all false — "single", "Using", "advertising"
//                       and "consequential" all contain `sin`
//   \bword\b            0 hits — but blind to "praying", "blessings",
//                       "faithful", "churches", which are the register the
//                       ban is actually about
//   \bword  (prefix)    1 hit, false — "single"
//
// So: prefix-at-word-boundary for eleven of them, which catches inflections
// and cannot fire mid-word. `sin` is the only word short enough to be the
// start of ordinary English, so it is spelled out with its inflections.
//
// `bless` rather than the literal `blessed`: the ban is on a REGISTER, and
// "blessing" carries it identically. That is wider than the word Colin said,
// and is stated here rather than smuggled into a regex.
//
// `check-copy-rules` asserts this list's recall AND its precision on fixtures
// before it is trusted with a verdict. If you tighten a pattern, that is where
// it fails.
export const FORBIDDEN = [
  { word: 'God', re: /\bgod/i },
  { word: 'Jesus', re: /\bjesus/i },
  { word: 'Lord', re: /\blord/i },
  { word: 'pray', re: /\bpray/i },
  { word: 'scripture', re: /\bscriptur/i },
  { word: 'church', re: /\bchurch/i },
  { word: 'faith', re: /\bfaith/i },
  { word: 'blessed', re: /\bbless/i },
  { word: 'worship', re: /\bworship/i },
  { word: 'sin', re: /\bsin(s|ful|ner|ners|ning)?\b/i },
  { word: 'hallelujah', re: /\bhallelujah/i },
  { word: 'ritual', re: /\britual/i },
];

// The bare words, for a consumer testing a set it controls end to end.
// `check-demo-hive` runs RAW SUBSTRING over nineteen hand-written fixtures,
// where the false-positive rate is zero and the stricter arm is free. That
// arm does not transfer to real copy — see above — so it stays local to the
// fixture gate rather than becoming this module's opinion.
export const FORBIDDEN_WORDS = FORBIDDEN.map((f) => f.word);
