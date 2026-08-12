import { toISODate } from '../utils/dateRanges';

// Demo-only hive members (Colin's ask, 2026-08-09): the honeycomb should
// always look lively for demos even with only 1-2 real connections. These are
// decorative — never written to Supabase, never counted in real
// connection/like/comment totals, and never interactive (a `demo-N` id is not
// a uuid, so any write against it is rejected before it reaches a policy).
//
// `HoneycombTab` merges them into the raw share list; the Today comb maps that
// list through `toGridMember`, the Last-7-Days view groups it by `entryDate`
// (§18.1.1). Pull this file and its call site whenever real usage makes it
// unnecessary.
//
// THE SET IS SIZED, NOT ARBITRARY — §18 partitions on date, which made both
// of these load-bearing. Keep them true if you edit the list:
//
//   * SEVEN members at daysAgo 0. `HIVE_SLOTS` is 7 (HoneycombGrid.js), and
//     the grid honestly leaves unfilled seats empty rather than padding them.
//     Fewer than seven and a demo user with no real connections sees a comb
//     that never closes — the one job this file exists to do.
//   * At least one member on EACH of daysAgo 1-6, so every day header in the
//     week view has something under it. Two each is what makes it read as a
//     populated week rather than a technically non-empty one.
//
// Day 0 first, then ascending — the pre-partition call site still takes the
// first `HIVE_SLOTS` of this list, so today's people have to come first.
const RAW_MEMBERS = [
  { name: 'Maya', gratitude: 'A friend who checked in on me for no reason at all.', daysAgo: 0 },
  { name: 'Theo', gratitude: 'The quiet five minutes before everyone else woke up.', daysAgo: 0 },
  { name: 'Sam', gratitude: 'A walk that cleared my head when nothing else could.', daysAgo: 0 },
  { name: 'Dev', gratitude: 'A problem I finally solved after three days stuck.', daysAgo: 0 },
  { name: 'Jonah', gratitude: 'Coffee that hit exactly right this morning.', daysAgo: 0 },
  { name: 'Kai', gratitude: 'Rain that waited until I was already inside.', daysAgo: 0 },
  { name: 'Ines', gratitude: "My sister's laugh on the phone, three states away.", daysAgo: 0 },

  { name: 'Nora', gratitude: 'The way the light looked coming home tonight.', daysAgo: 1 },
  { name: 'Ava', gratitude: "Something I'm actually looking forward to tomorrow.", daysAgo: 1 },

  { name: 'Elena', gratitude: 'A stranger who held the door and meant it.', daysAgo: 2 },
  { name: 'Omar', gratitude: 'Bread still warm from the shop on the corner.', daysAgo: 2 },

  { name: 'Priya', gratitude: 'My body carrying me through a long day without complaint.', daysAgo: 3 },
  { name: 'Ruth', gratitude: 'A seat by the window, and nobody took it.', daysAgo: 3 },

  { name: 'Lena', gratitude: 'The song that came on right when I needed it.', daysAgo: 4 },
  { name: 'Hugo', gratitude: "My neighbor's dog, who has never once ignored me.", daysAgo: 4 },

  { name: 'Yusuf', gratitude: 'A whole evening with nowhere I had to be.', daysAgo: 5 },
  { name: 'Cleo', gratitude: "Hands that still know how to make my mother's soup.", daysAgo: 5 },

  { name: 'Wren', gratitude: 'The first cold morning that actually smelled like fall.', daysAgo: 6 },
  { name: 'Farid', gratitude: "A text I'd been dreading that turned out kind.", daysAgo: 6 },
];

// Built per call, against the caller's clock. It used to be a module-level
// `const`, which froze every date at import: the app compares these against a
// `toISODate(new Date())` recomputed on every refresh, so a session left open
// across midnight kept moving one operand and never the other, and the Today
// comb quietly emptied of demo members until a full JS reload. Pass the same
// `now` the partition uses and the two sides can't drift apart.
export const demoHiveShares = (now = new Date()) =>
  RAW_MEMBERS.map((member, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - member.daysAgo);
    return {
      id: `demo-${index}`,
      isDemo: true,
      isOwn: false,
      author: { display_name: member.name },
      content: member.gratitude,
      entryDate: toISODate(date),
      likeCount: 0,
      likedByMe: false,
      commentCount: 0,
    };
  });
