// Curated daily prompts for when "I am grateful for..." draws a blank.
// Deterministic by day-of-year so the prompt is stable across a single day
// (and across a re-render) rather than jumping around on every mount.
export const DAILY_PROMPTS = [
  "Who made you smile this week?",
  "What's something small that made today better?",
  "What's a challenge you're grateful you faced?",
  "What part of your morning routine do you love?",
  "Who would you like to thank today?",
  "What's something in nature you noticed recently?",
  "What's a skill or ability you're thankful to have?",
  "What meal or drink are you grateful for today?",
  "What's a memory that still makes you smile?",
  "What's something about your home you appreciate?",
  "Who supported you recently?",
  "What's a small win from this week?",
  "What song or sound brought you joy lately?",
  "What's something you're looking forward to?",
  "What's a lesson you're grateful you learned?",
  "What's a comfort you often take for granted?",
  "Who believed in you when it mattered?",
  "What made you laugh out loud recently?",
  "What's a tool or object that made your day easier?",
  "What's something about your body you're thankful for today?",
];

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
};

export const getDailyPrompt = (date = new Date()) => {
  const idx = dayOfYear(date) % DAILY_PROMPTS.length;
  return DAILY_PROMPTS[idx];
};
