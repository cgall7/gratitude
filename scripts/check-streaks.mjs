// Gate for the streak/recap defects Pixel and Sage found in thread 19e90cf8
// (2026-08-13): a duplicate same-day entry, and a descending-ordered query,
// both silently collapse `longestStreak`. Sage mutation-tested this file
// (§2-4 of the same thread) and found the gate itself under-tested: the
// duplicate fixtures didn't reproduce the bug they name, the pager fix had
// no coverage at all, and the anchor date was UTC-built while the code
// under test is local-built. Fixed below rather than re-argued.
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
import { readFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { currentStreak, longestStreak, recentMonths, toISODate } = await import(
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

// Local construction, not `new Date('2026-08-13')`: a bare ISO string
// parses as UTC midnight, so anywhere west of Greenwich this anchor was
// already "yesterday evening" before a single date got built from it — the
// same class of bug `toISODate` exists to correct for. Sage measured the
// drift: `clean ascending: best (30) >= current (29)` in America/New_York,
// silent because the assertion is an inequality. Building TODAY locally and
// deriving every fixture date through `toISODate` (the same function
// `currentStreak` uses internally) means the gate and the code under test
// can't disagree about what day it is.
const TODAY = new Date(2026, 7, 13);

const dateAt = (offsetDays, from = TODAY) => {
  const d = new Date(from);
  d.setDate(d.getDate() - offsetDays);
  return toISODate(d);
};

// A 30-day run, ascending, no duplicates.
const clean = Array.from({ length: 30 }, (_, i) => ({ date: dateAt(29 - i) }));

// Sorted, not appended-then-left: an unsorted list already reads as
// out-of-order to the pre-fix function, so the trailing duplicate produced
// one huge negative gap at the very end instead of landing mid-run — the
// pre-fix `longestStreak` passed all three offsets anyway (Sage, thread
// 19e90cf8: "Pixel's actual defect... is not reachable by this gate").
// Sorting after inserting the dup is what makes the fixture the same shape
// `EntryStore.getAllEntries` actually hands the function.
const withDup = (dupOffset) =>
  [...clean, { date: dateAt(dupOffset) }].sort((a, b) => a.date.localeCompare(b.date));

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
  const current = currentStreak(entries, TODAY);
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

// RecapTab.js's buildMonths (the pager fix, thread 19e90cf8 §3) can't be
// imported here: it pulls in react-native and JSX, which this plain-Node
// gate can't parse. Sage's fallback — "assert on recentMonths(now, earliest)
// with earliest computed both ways" — is what runs instead. earliestDate
// below mirrors buildMonths' reduce line for line; if that line changes,
// this one has to change with it.
const earliestDate = (entries) =>
  entries.reduce((min, entry) => (min === null || entry.date < min ? entry.date : min), null);

// allEntries[0]?.date — the precondition the fix removed. Kept here only as
// a witness: something has to demonstrate that the naive read is the thing
// going wrong, or "we assert the correct form" reads as an arbitrary choice
// instead of a fix for a reachable failure.
const naiveEarliest = (entries) => entries[0]?.date ?? null;

const monthKeysOf = (entries) => new Set(entries.map((entry) => entry.date.slice(0, 7)));

const pagerCoverage = (label, entries, earliest) => {
  const paged = new Set(recentMonths(TODAY, earliest(entries)).map((month) => month.key));
  const missing = [...monthKeysOf(entries)].filter((key) => !paged.has(key));
  if (missing.length === 0) {
    ok(`${label}: every month with entries has a page (${paged.size} pages)`);
  } else {
    bad(`${label}: months missing a page`, missing.join(', '));
  }
};

// One entry per month for 6 months, built newest-first — the shape
// `entries_user_id_idx (user_id, entry_date desc)` returns.
const monthSpread = Array.from({ length: 6 }, (_, monthsBack) => ({
  date: toISODate(new Date(TODAY.getFullYear(), TODAY.getMonth() - monthsBack, 15)),
}));

pagerCoverage('pager, ascending input', [...monthSpread].reverse(), earliestDate);
pagerCoverage('pager, DESCENDING input (matches entries_user_id_idx order)', monthSpread, earliestDate);

// The regression this section exists to catch: under descending input, the
// naive read grabs the newest date instead of the oldest, so recentMonths
// opens a one-month window and five months of real entries lose their page
// with no visible seam (Sage: "six months of history become one page").
{
  const paged = new Set(recentMonths(TODAY, naiveEarliest(monthSpread)).map((m) => m.key));
  const missing = [...monthKeysOf(monthSpread)].filter((key) => !paged.has(key));
  if (missing.length > 0) {
    ok(`naive earliest under DESCENDING input loses pages as expected (${missing.length} missing) — proves buildMonths' fix is load-bearing`);
  } else {
    bad('naive earliest under DESCENDING input', 'expected missing pages to demonstrate the precondition failure; got full coverage instead');
  }
}

// The pagerCoverage assertions above prove the invariant, not that
// buildMonths still enforces it — they call recentMonths directly because
// RecapTab.js can't be imported here. That leaves the exact regression
// Sage mutation-tested for (revert buildMonths to `allEntries[0]?.date`)
// invisible to everything above: "check-streaks: 9 passed, 0 failed" against
// a reverted file. Read the real source instead of executing it, so a
// revert has nowhere to hide.
{
  const recapSource = await readFile(path.join(ROOT, 'src/screens/RecapTab.js'), 'utf8');
  const start = recapSource.indexOf('export const buildMonths');
  const rawBody = start === -1 ? '' : recapSource.slice(start, recapSource.indexOf('\n};', start) + 3);
  // Strip comment lines before matching — the function's own comment names
  // `allEntries[0]` in prose to explain why it *isn't* used, which would
  // otherwise trip this check on the fixed code.
  const body = rawBody
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  if (start === -1) {
    bad('buildMonths static check', 'export const buildMonths not found in RecapTab.js — renamed or removed?');
  } else if (/allEntries\[0\]/.test(body)) {
    bad('buildMonths static check', 'reads allEntries[0] directly — the ascending-order precondition is back');
  } else if (!/reduce\(/.test(body)) {
    bad('buildMonths static check', 'no reduce() found — earliest-date computation changed shape, re-verify by hand');
  } else {
    ok('buildMonths static check: still computes earliest date via reduce, not allEntries[0]');
  }
}

console.log(`\ncheck-streaks: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
