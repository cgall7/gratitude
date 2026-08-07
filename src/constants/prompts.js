// Curated daily prompts for when "I am grateful for..." draws a blank.
// Deterministic by day-of-year so the prompt is stable across a single day
// (and across a re-render) rather than jumping around on every mount.
//
// Each prompt carries a few short "sparks" — example completions a user can
// tap to drop straight into the input and edit, rather than staring at a
// blank page. They're phrased as noun phrases so they read naturally after
// "I am grateful for...".
export const DAILY_PROMPTS = [
  {
    question: "Who made you smile this week?",
    sparks: ["my coworker's joke at lunch", "a text from my sister", "the barista who remembered my order"],
  },
  {
    question: "What's something small that made today better?",
    sparks: ["the first sip of coffee", "a parking spot right up front", "sunlight through the window"],
  },
  {
    question: "What's a challenge you're grateful you faced?",
    sparks: ["that hard conversation last month", "the year I had to start over", "learning to ask for help"],
  },
  {
    question: "What part of your morning routine do you love?",
    sparks: ["five quiet minutes before anyone's awake", "my walk to work", "making my bed"],
  },
  {
    question: "Who would you like to thank today?",
    sparks: ["my mom, for always picking up the phone", "the friend who checked in on me", "my old teacher"],
  },
  {
    question: "What's something in nature you noticed recently?",
    sparks: ["the way the trees looked at sunset", "a cool breeze on a hot day", "birdsong outside my window"],
  },
  {
    question: "What's a skill or ability you're thankful to have?",
    sparks: ["being able to make people laugh", "my hands, for everything they build", "patience with my kids"],
  },
  {
    question: "What meal or drink are you grateful for today?",
    sparks: ["my grandmother's recipe", "a warm cup of tea", "leftovers that saved my evening"],
  },
  {
    question: "What's a memory that still makes you smile?",
    sparks: ["that road trip with old friends", "the day I got my dog", "my kid's first laugh"],
  },
  {
    question: "What's something about your home you appreciate?",
    sparks: ["a roof over my head", "the light in the kitchen in the morning", "my ridiculously comfy couch"],
  },
  {
    question: "Who supported you recently?",
    sparks: ["a stranger who held the door", "my partner, for listening last night", "a coworker who covered for me"],
  },
  {
    question: "What's a small win from this week?",
    sparks: ["finally sending that email", "showing up even when I didn't want to", "a good night's sleep"],
  },
  {
    question: "What song or sound brought you joy lately?",
    sparks: ["a song from high school on the radio", "my kids laughing in the other room", "rain on the roof"],
  },
  {
    question: "What's something you're looking forward to?",
    sparks: ["seeing an old friend soon", "a quiet weekend at home", "a trip I've been planning"],
  },
  {
    question: "What's a lesson you're grateful you learned?",
    sparks: ["that it's okay to say no", "how to sit with discomfort", "that asking for help isn't weakness"],
  },
  {
    question: "What's a comfort you often take for granted?",
    sparks: ["clean water from the tap", "a warm bed on a cold night", "having enough to eat today"],
  },
  {
    question: "Who believed in you when it mattered?",
    sparks: ["a teacher who saw something in me", "my best friend, always", "a mentor early in my career"],
  },
  {
    question: "What made you laugh out loud recently?",
    sparks: ["a video my friend sent me", "something my kid said at dinner", "an old memory that resurfaced"],
  },
  {
    question: "What's a tool or object that made your day easier?",
    sparks: ["my well-worn running shoes", "a good pair of headphones", "my grandfather's old toolbox"],
  },
  {
    question: "What's something about your body you're thankful for today?",
    sparks: ["legs that carried me through a long day", "a good night of real rest", "hands steady enough to create"],
  },
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
