import { toISODate } from '../utils/dateRanges';

// Demo-only hive members (Colin's ask, 2026-08-09): the honeycomb should
// always look lively for demos even with only 1-2 real connections. These
// are decorative — never written to Supabase, never counted in real
// connection/like/comment totals. `HoneycombHive` merges them behind real
// people so the grid reads as a real, populated hive. Pull this file (and
// its one call site in HoneycombTab.js) whenever real usage makes it
// unnecessary.
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

const RAW_MEMBERS = [
  { name: 'Maya', gratitude: 'A friend who checked in on me for no reason at all.', daysAgo: 0 },
  { name: 'Theo', gratitude: 'The quiet five minutes before everyone else woke up.', daysAgo: 0 },
  { name: 'Priya', gratitude: 'My body carrying me through a long day without complaint.', daysAgo: 1 },
  { name: 'Sam', gratitude: 'A walk that cleared my head when nothing else could.', daysAgo: 0 },
  { name: 'Nora', gratitude: 'The way the light looked coming home tonight.', daysAgo: 1 },
  { name: 'Dev', gratitude: 'A problem I finally solved after three days stuck.', daysAgo: 0 },
  { name: 'Elena', gratitude: 'A stranger who held the door and meant it.', daysAgo: 2 },
  { name: 'Jonah', gratitude: 'Coffee that hit exactly right this morning.', daysAgo: 0 },
  { name: 'Ava', gratitude: "Something I'm actually looking forward to tomorrow.", daysAgo: 1 },
];

export const DEMO_HIVE_MEMBERS = RAW_MEMBERS.map((member, index) => ({
  id: `demo-${index}`,
  isDemo: true,
  isOwn: false,
  author: { display_name: member.name },
  content: member.gratitude,
  entryDate: daysAgo(member.daysAgo),
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
}));
