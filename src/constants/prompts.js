// Curated daily prompts for when "I am grateful for..." draws a blank.
// Deterministic by day-of-year so the prompt is stable across a single day
// (and across a re-render) rather than jumping around on every mount.
//
// Each prompt carries a few short "sparks" — example completions a user can
// tap to drop straight into the input and edit, rather than staring at a
// blank page.
//
// THE SPARK REGISTER IS A COMPOSITION CONTRACT, NOT A STYLE PREFERENCE.
// A spark is never rendered alone: both of IdeasAccordion's mounts hand the
// tapped spark straight into a sentence — CoreRitual sets the input to
// `I am grateful for ${spark}.`, Onboarding's Write beat to
// `I'm grateful for ${spark}.`. So a spark must be a
// LOWERCASE NOUN PHRASE — anything else lands mid-sentence as a capital,
// and a leading preposition ("in a gesture") lands as broken grammar the
// user then has to repair before they can write. Measured over this file:
// 72/72 sparks are lowercase, 0/72 lead with a preposition, and no spark
// string appears twice (a repeated chip in a four-chip row reads as a
// rendering bug). check:copy-rules cannot see any of that — its walker asks
// whether a word is allowed, not whether a fragment composes — so the
// contract is written here and asserted in check:onboarding-flow section D.
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

// --- The first three days: seniority, not rotation ---
//
// One Door (PLANS/ONBOARDING_ONE_DOOR_SPEC.md) cut the three belief screens
// B1–B3 out of onboarding. They are NOT deleted — the argument they made
// arrives one line a day instead, which is the product's own thesis applied
// to its own pitch. Lumen's ruling put them here rather than on the gate
// line: §27.1 ("Pause. / Think of someone.") already owns the gate, under
// the rule merged with it — a gate aims; the screen with the field asks.
// These are the screen with the field, so these are questions.
//
// The originals, verbatim from GUIDES/GRATITUDE_ONBOARDING_GIVEN_COPY.md §5:
//   B1  "The morning showed up without you."
//   B2  "Noticing is one thing. Saying thanks is another."
//   B3  "Peace tends to follow, but it's not the point."
//
// The rephrase carries each line's TURN, not its words — and never names
// what a Christian reader hears in them. That guide's §2 is explicit: the
// subtlety is the mechanism, so naming it deletes it.
//
// Indexed by days-since-first-entry (0, 1, 2), then the day-of-year
// rotation below takes over for good.
export const FIRST_DAYS_PROMPTS = [
  {
    // B1 — the day arrived without you arranging it.
    //
    // "today", not "this morning". Deezine's rephrase said morning (B1's own
    // first word) and Lumen accepted it, but day 0 is not a morning: it is
    // the first entry, written at whatever hour someone installs the app,
    // and Onboarding.js's FirstEntryStep renders this exact question at that
    // moment. "What showed up for you this morning?" at 9pm asks about a
    // time that has already gone — a small false premise on the one screen
    // §5 calls the activation moment. This is the line already live on main
    // for that screen, so the change is a deletion, not a new string.
    question: 'What showed up for you today?',
    sparks: ['something unexpected', 'a quiet moment', 'a conversation', 'the light'],
  },
  {
    // B2 — the turn: receiving the day, not reviewing it.
    //
    // The question carries the turn; the chips do not have to. Day 1 was the
    // only all-abstract deck of the three, and abstraction is what loses to a
    // blank page — so all four are now things a day hands you, not categories
    // of thing. The first recut kept the categories ('a song', 'a walk') and
    // was rejected for it: the file already renders both of those grounded
    // ("a song from high school on the radio", "my walk to work"), so the
    // generic form is the deck saying worse what it already says well.
    //
    // 'an ease' also failed the read-aloud test the contract above implies:
    // "I am grateful for an ease." is strained English in a way "a breath"
    // is not, because ease does not take an article in that frame. Every
    // replacement was said aloud inside the template before it landed.
    question: 'What let the day land with you today?',
    sparks: [
      'the commute home',
      'my first shower of the day',
      'the end of the workday',
      'a few minutes to myself',
    ],
  },
  {
    // B3 — peace as the byproduct, never the reason.
    question: 'What let you breathe a little easier today?',
    sparks: ['a gesture', 'a word', 'a rest', 'a kindness'],
  },
];

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
};

// `daysSinceFirstEntry` is optional and null-safe on purpose: a caller that
// cannot cheaply know a user's seniority (or whose lookup failed) gets the
// rotation, which is exactly the behaviour every caller had before this
// argument existed. A wrong prompt is a worse failure than an unseasoned
// one, so the fallback is the general deck, never a guess at day 0.
export const getDailyPrompt = (date = new Date(), daysSinceFirstEntry = null) => {
  if (
    Number.isInteger(daysSinceFirstEntry) &&
    daysSinceFirstEntry >= 0 &&
    daysSinceFirstEntry < FIRST_DAYS_PROMPTS.length
  ) {
    return FIRST_DAYS_PROMPTS[daysSinceFirstEntry];
  }
  const idx = dayOfYear(date) % DAILY_PROMPTS.length;
  return DAILY_PROMPTS[idx];
};
