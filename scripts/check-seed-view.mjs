// §22.1's seal rule and §22.2's wake, EXECUTED.
//
// `check-seeds-contract.mjs` already pins what `SeedsStore` returns. This pins
// what a screen is allowed to conclude from it — the layer where the error I
// published this morning actually lived. The rule was right in the store and
// wrong in my head, and prose in a header does not stop the next person
// reaching the same wrong conclusion.
//
// NO STUBS, NO POSTGRES, NO SKIP PATH — by construction, not by discipline:
// `src/utils/seedView.js` has zero imports, so there is nothing here that can
// be absent and silently turn this file green. That is the failure mode Sage
// caught in `check-seeds-rls` this morning, and the reason `hasBloomed` had to
// leave `SeedsStore.js` (which drags in Supabase and therefore React Native).

import {
  hasBloomed,
  resolveSeedView,
  nextWakeDelay,
  SEED_VIEWS,
  SEAL_RETRY_MS,
  WAKE_HORIZON_MS,
} from '../src/utils/seedView.js';

let passed = 0;
let failed = 0;

const ok = (label) => {
  console.log(`  ok   ${label}`);
  passed += 1;
};
const bad = (label, got, want) => {
  console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`);
  failed += 1;
};
const eq = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) ok(label);
  else bad(label, got, want);
};

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const seed = (over = {}) => ({
  id: 's1',
  bloom_at: iso(NOW + DAY),
  content: null,
  ...over,
});

console.log('\n  hasBloomed — the boundary, and what it refuses to throw on');
eq('past -> bloomed', hasBloomed({ bloom_at: iso(NOW - 1) }, NOW), true);
eq('future -> sealed', hasBloomed({ bloom_at: iso(NOW + 1) }, NOW), false);
eq('exactly now -> bloomed (<=)', hasBloomed({ bloom_at: iso(NOW) }, NOW), true);
eq('no bloom_at -> false, no throw', hasBloomed({}, NOW), false);
eq('null seed -> false, no throw', hasBloomed(null, NOW), false);
eq('unparseable bloom_at -> false, no throw', hasBloomed({ bloom_at: 'not a date' }, NOW), false);

console.log('\n  resolveSeedView — the three rows of §22.1, over every content value');
// Row 1: sealed by date. Content is IRRELEVANT here, and asserting that over
// both values is the point: a sent seed carries its text while sealed.
for (const [label, content] of [['without text', null], ['WITH text (a seed you sent)', 'I am grateful for you']]) {
  eq(
    `future bloom ${label} -> sealed, no refetch`,
    resolveSeedView(seed({ bloom_at: iso(NOW + DAY), content }), NOW),
    { view: SEED_VIEWS.SEALED, needsRefetch: false }
  );
}

// Row 2: bloomed with text.
eq(
  'past bloom with text -> bloomed',
  resolveSeedView(seed({ bloom_at: iso(NOW - DAY), content: 'a seed I planted' }), NOW),
  { view: SEED_VIEWS.BLOOMED, needsRefetch: false }
);

// Row 3: THE TRIPWIRE. This is the assertion the whole file exists for.
eq(
  'past bloom with NO text -> sealed AND refetch (the tripwire)',
  resolveSeedView(seed({ bloom_at: iso(NOW - MIN), content: null }), NOW),
  { view: SEED_VIEWS.SEALED, needsRefetch: true }
);
eq(
  'undefined content is the tripwire too, not a third case',
  resolveSeedView({ bloom_at: iso(NOW - MIN) }, NOW),
  { view: SEED_VIEWS.SEALED, needsRefetch: true }
);

// The negative property, stated as a property rather than as three examples:
// there is NO input on which a seal opens over nothing.
{
  let opened = 0;
  for (const bloom of [NOW - DAY, NOW - 1, NOW, NOW + 1, NOW + DAY]) {
    for (const content of [null, undefined, '', 'text']) {
      const { view } = resolveSeedView({ bloom_at: iso(bloom), content }, NOW);
      if (view === SEED_VIEWS.BLOOMED && content == null) opened += 1;
    }
  }
  eq('over the whole (bloom x content) product: never bloomed-with-no-text', opened, 0);
}

// An empty string is text. It is a seed someone chose to send, and the compose
// screen already refuses to plant one — so if it exists, it is not our place to
// re-seal it.
eq(
  'empty-string content is BLOOMED, not the tripwire',
  resolveSeedView({ bloom_at: iso(NOW - DAY), content: '' }, NOW).view,
  SEED_VIEWS.BLOOMED
);

console.log('\n  nextWakeDelay — §22.2, and the two ways it must not fire');
eq('no seeds -> no timer', nextWakeDelay([], NOW), null);
eq('null list -> no timer, no throw', nextWakeDelay(null, NOW), null);

eq(
  'a bloom 10 minutes out -> wake exactly then',
  nextWakeDelay([seed({ bloom_at: iso(NOW + 10 * MIN) })], NOW),
  10 * MIN
);
eq(
  'the soonest of several wins',
  nextWakeDelay(
    [
      seed({ id: 'a', bloom_at: iso(NOW + 5 * HOUR) }),
      seed({ id: 'b', bloom_at: iso(NOW + 3 * MIN) }),
      seed({ id: 'c', bloom_at: iso(NOW + 20 * MIN) }),
    ],
    NOW
  ),
  3 * MIN
);
eq(
  'a tripwire seed -> retry, not an immediate hammer',
  nextWakeDelay([seed({ bloom_at: iso(NOW - MIN), content: null })], NOW),
  SEAL_RETRY_MS
);
eq(
  'a tripwire beats a later bloom',
  nextWakeDelay(
    [seed({ id: 'a', bloom_at: iso(NOW - MIN), content: null }), seed({ id: 'b', bloom_at: iso(NOW + HOUR / 2) })],
    NOW
  ),
  SEAL_RETRY_MS
);
eq(
  'an already-bloomed seed WITH text wants nothing',
  nextWakeDelay([seed({ bloom_at: iso(NOW - DAY), content: 'here' })], NOW),
  null
);

// The horizon. Colin's stated use case is a seed planted for Christmas, so the
// months-out case is the main path, not an edge.
eq(
  'a bloom past the horizon -> NO timer (focus covers it)',
  nextWakeDelay([seed({ bloom_at: iso(NOW + WAKE_HORIZON_MS + 1) })], NOW),
  null
);
eq('a bloom exactly at the horizon -> still scheduled', nextWakeDelay([seed({ bloom_at: iso(NOW + WAKE_HORIZON_MS) })], NOW), WAKE_HORIZON_MS);
eq(
  'a seed four months out -> no timer, and NOT a zero delay',
  nextWakeDelay([seed({ bloom_at: iso(NOW + 120 * DAY) })], NOW),
  null
);

// THE ONE THAT MATTERS MOST, and the reason the horizon returns null rather
// than a clamped number: a returned 0 would refetch immediately, get the same
// still-sealed row back, and schedule another 0 — a request loop against
// PostgREST for as long as the screen is open. Assert no input produces one
// unless a bloom has genuinely already landed.
{
  const offenders = [];
  for (const offset of [1, MIN, HOUR, DAY, 30 * DAY, 120 * DAY, 365 * DAY, 10 * 365 * DAY]) {
    const d = nextWakeDelay([seed({ bloom_at: iso(NOW + offset) })], NOW);
    if (d === 0) offenders.push(offset);
  }
  eq('no future bloom, however distant, ever schedules a 0ms wake', offenders, []);
}
eq(
  'a bloomed-with-text seed contributes nothing; the tripwire beside it still wins',
  nextWakeDelay([seed({ bloom_at: iso(NOW - 5 * MIN), content: 'text' }), seed({ id: 'b', bloom_at: iso(NOW - 1) })], NOW),
  SEAL_RETRY_MS
);

// The invariant that REPLACED the clamp in `nextWakeDelay`, asserted rather
// than defended. I had a `Math.max(delay, 0)` there guarding a case that
// cannot occur — every candidate wake is strictly after `at` by construction —
// so the guard was inert and its comment described a hazard that isn't real.
// Deleting a guard is only safe if the property it pretended to hold is
// actually checked, so: over the whole (bloom offset x content) product,
// including blooms well in the past, no returned delay is ever <= 0.
{
  const offenders = [];
  const offsets = [-365 * DAY, -DAY, -HOUR, -MIN, -1, 0, 1, MIN, HOUR, DAY, 30 * DAY, 365 * DAY];
  for (const offset of offsets) {
    for (const content of [null, undefined, '', 'text']) {
      const d = nextWakeDelay([{ id: 'x', bloom_at: iso(NOW + offset), content }], NOW);
      if (d != null && d <= 0) offenders.push([offset, content]);
    }
  }
  eq('no input schedules a wake at or before now (the clamp was unreachable)', offenders, []);
}

// A malformed row must not take the timer down with it.
eq('a seed with no bloom_at is ignored, not thrown on', nextWakeDelay([{ id: 'x' }], NOW), null);
eq(
  'a malformed row alongside a good one does not lose the good one',
  nextWakeDelay([{ id: 'x' }, seed({ bloom_at: iso(NOW + 7 * MIN) })], NOW),
  7 * MIN
);

console.log(`\ncheck-seed-view: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
