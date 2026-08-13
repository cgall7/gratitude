// Gate for the streak/recap defects Pixel and Sage found in thread 19e90cf8
// (2026-08-13): a duplicate same-day entry, and a descending-ordered query,
// both silently collapse `longestStreak`.
//
//   npm run check:streaks
//
// WHY ONE ASSERTION INSTEAD OF FIXTURES FOR EACH BUG.
//
// `longestStreak(entries) >= currentStreak(entries)` is true by definition —
// the run you're currently on is one of the runs, so the longest cannot be
// shorter than it. It needs no knowledge of the shape of the defect, which
// is why it caught duplicate-day collapse, descending order, and the
// combination of both from the same line (Sage: "every defect in this post,
// and both of Pixel's, from one line"). A gate built to name each bug only
// proves today's bug is fixed, not that the invariant holds.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { currentStreak, longestStreak } = await import(
  path.join(ROOT, 'src/utils/dateRanges.js')
);

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};

const dateAt = (offsetDays, from = new Date('2026-08-13')) => {
  const d = new Date(from);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

// A 30-day run, ascending, no duplicates.
const clean = Array.from({ length: 30 }, (_, i) => ({ date: dateAt(29 - i) }));

const withDup = (dupOffset) => [...clean, { date: dateAt(dupOffset) }];

const everyDayTwice = clean.flatMap((e) => [e, { ...e }]);

const descending = [...clean].reverse();
const descendingWithDup = [...withDup(15)].reverse();

// A real user's history: gaps, not one unbroken run — the case a naive
// "streaks are always long" assertion would false-positive on.
const gapped = [
  ...Array.from({ length: 10 }, (_, i) => ({ date: dateAt(90 - i) })),
  ...Array.from({ length: 5 }, (_, i) => ({ date: dateAt(60 - i) })),
];

const invariant = (label, entries) => {
  const best = longestStreak(entries);
  const current = currentStreak(entries, new Date('2026-08-13'));
  if (best >= current) {
    ok(`${label}: best (${best}) >= current (${current})`);
  } else {
    bad(`${label}: best (${best}) < current (${current})`, 'longest cannot be shorter than the run you are on');
  }
};

invariant('clean ascending', clean);
invariant('dup on day 1', withDup(0));
invariant('dup on day 15 (midpoint)', withDup(15));
invariant('dup on day 29', withDup(29));
invariant('every day duplicated (Private Hives, used as designed)', everyDayTwice);
invariant('clean DESCENDING (matches entries_user_id_idx order)', descending);
invariant('descending + dup', descendingWithDup);
invariant('gapped real-world history', gapped);

// The specific regression this gate exists to catch first: 30 clean days
// must stay 30 regardless of input order, because `longestStreak` sorts
// internally rather than trusting its caller (dateRanges.js:152).
{
  const ascVal = longestStreak(clean);
  const descVal = longestStreak(descending);
  if (ascVal === 30 && descVal === 30) {
    ok(`order-independence: ascending (${ascVal}) === descending (${descVal}) === 30`);
  } else {
    bad('order-independence', `ascending=${ascVal} descending=${descVal}, expected both 30`);
  }
}

console.log(`\ncheck-streaks: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
