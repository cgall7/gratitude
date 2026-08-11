// Gratitude ideas — accordion categories (Sunbeam §6, frozen copy from
// GUIDES/GRATITUDE_IDEAS_ACCORDION_COPY.md).
//
// Five curated categories, each rendered as a card: `icon` in a washYellow
// circle, `title` in h3, `teaser` in bodySm. Expanding a card reveals its
// `sparks` — feed them straight into the existing <SparkChips> component.
// Only one category should be expanded at a time (R1 refinement, adopted
// into spec). Icon names are Ionicons, 22pt, matching the check-in-time card
// pattern.
export const IDEA_CATEGORIES = [
  {
    id: 'people',
    icon: 'people',
    title: 'People',
    teaser: 'The person who made today lighter.',
    sparks: [
      'someone who made me laugh today',
      'a friend who checked in on me',
      'someone who helped without being asked',
      'a stranger who was kind',
    ],
  },
  {
    id: 'small-moments',
    icon: 'cafe',
    title: 'Small moments',
    teaser: 'The tiny things that were, somehow, the best part.',
    sparks: [
      'my first sip of coffee this morning',
      'a song that caught me off guard',
      'the quiet five minutes before everyone woke up',
      'a meal that hit just right',
    ],
  },
  {
    id: 'your-body',
    icon: 'fitness',
    title: 'Your body',
    teaser: 'A body that showed up for you today.',
    sparks: [
      'a walk that cleared my head',
      'sleeping well last night',
      'my body carrying me through today',
      'a moment I felt strong',
    ],
  },
  {
    id: 'nature',
    icon: 'leaf',
    title: 'Nature',
    teaser: 'Something outside that stopped you, just for a second.',
    sparks: [
      'the way the light looked this evening',
      'fresh air on my walk',
      'a tree, a bird, the sky — something outside',
      'weather that matched my mood',
    ],
  },
  {
    id: 'today',
    icon: 'today',
    title: 'Today',
    teaser: 'One good thing that happened, no matter how small.',
    sparks: [
      'something that went better than expected',
      'a problem I finally solved',
      'a small win nobody else noticed',
      "something I'm looking forward to tomorrow",
    ],
  },
];
