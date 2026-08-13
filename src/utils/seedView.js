// §22.1 and §22.2 as functions instead of as prose a screen is trusted to obey.
//
// Same split as `loadState.js` and `seedDraft.js`, for the same reason: this
// file has ZERO imports, so `check-seed-view.mjs` executes it rather than
// reading it. `hasBloomed` used to live in `SeedsStore.js`, which imports
// `./supabase` and therefore React Native — so the one rule that decides
// whether a seal opens could only be checked through a resolve-time stub. It
// is pure derivation and it belongs where it can be run. `SeedsStore` still
// exports it, so no caller changed.

/** True once a seed's bloom date has passed. Derived, never stored — see the
 *  seeds migration for why there is no `status` column to read instead.
 *
 *  `at` is the DEVICE clock and the policy compares against Postgres `now()`.
 *  Those disagree, and `resolveSeedView` below is where that disagreement is
 *  resolved in the server's favour. */
export const hasBloomed = (seed, at = Date.now()) =>
  !!seed?.bloom_at && new Date(seed.bloom_at).getTime() <= at;

export const SEED_VIEWS = {
  SEALED: 'sealed',
  BLOOMED: 'bloomed',
};

/** How a single seed should RENDER, plus whether the screen owes it a refetch.
 *
 *  Three inputs collapse to two views, and the third row is the whole point:
 *
 *  | bloom_at | content | view      | refetch |
 *  |----------|---------|-----------|---------|
 *  | future   | any     | `sealed`  | no      |
 *  | past     | present | `bloomed` | no      |
 *  | past     | null    | `sealed`  | **yes** |
 *
 *  Row 3 is §22.1's tripwire. `hasBloomed && content == null` has no
 *  legitimate meaning: it is a clock disagreement or a broken embed, and
 *  BOTH are answered by rendering sealed and asking again. Never an error
 *  — the user did nothing — and never an opened seal over nothing, which is
 *  the one outcome that would make the product lie about the thing it exists
 *  to do.
 *
 *  Note what is NOT here: `direction`. A seed you sent returns its text while
 *  still sealed (`seed_contents_select_after_bloom` names `sender_id` with no
 *  bloom condition), so a sent seed is routinely `sealed` WITH content in
 *  hand. The view and the availability of text are independent — that is
 *  §22.1's ruling in its most literal form — so the row decides what to show
 *  from `direction`, and the seal decides only whether it has opened. */
export const resolveSeedView = (seed, at = Date.now()) => {
  if (!hasBloomed(seed, at)) return { view: SEED_VIEWS.SEALED, needsRefetch: false };
  if (seed?.content == null) return { view: SEED_VIEWS.SEALED, needsRefetch: true };
  return { view: SEED_VIEWS.BLOOMED, needsRefetch: false };
};

// How long to wait before asking again about a seed whose date has passed but
// whose text has not arrived. Long enough that a device minutes ahead of the
// server does not hammer PostgREST, short enough that the reveal still feels
// like it happened when it happened.
export const SEAL_RETRY_MS = 15000;

// Past this, do not hold a timer at all — let `useFocusEffect` do it.
//
// A seed planted for Christmas is months out, and a months-long timer is not
// a plan, it is a leak with a date on it: the screen unmounts, and iOS does
// not run JS timers in the background regardless. The reveal is a refetch
// (§22.2), and focusing the screen IS a refetch, so a bloom beyond the horizon
// is already covered by the thing that covers every other stale read.
//
// One hour, because the horizon only has to outlast a single sitting.
export const WAKE_HORIZON_MS = 60 * 60 * 1000;

// Checked, and it does NOT apply here — recorded so nobody "fixes" it later:
// in Node, `setTimeout(fn, 2**31)` fires after 1ms (TimeoutOverflowWarning,
// reproduced). React Native does not share that clamp — `JSTimers` hands the
// duration straight to native (`JSTimers.js:220`), and iOS takes it as an
// `NSTimeInterval` double into `dateWithTimeIntervalSinceNow`
// (`RCTTiming.mm:386-393`, RN 0.86.2 as installed). So the 24.8-day overflow
// is a Node fact, not an app fact. The horizon above exists for the unmount
// and background reasons, which are real on device — not for an overflow that
// isn't.

/** When the screen should next re-read, as a DELAY in ms, or null for "don't
 *  hold a timer."
 *
 *  Two things can want a wake, and the sooner one wins:
 *    - a seed whose `bloom_at` is still ahead of us — wake exactly then
 *    - a seed in the tripwire — wake in `SEAL_RETRY_MS`
 *
 *  Deliberately no skew margin on the bloom wake. A device running fast wakes
 *  early, the refetch returns a seed the server still seals, and that lands on
 *  the tripwire — which retries. The early wake is self-correcting, so paying
 *  for it with a fixed margin would only make every honest device late. */
export const nextWakeDelay = (seeds, at = Date.now()) => {
  let soonest = null;
  const consider = (t) => {
    if (t != null && (soonest == null || t < soonest)) soonest = t;
  };

  for (const seed of seeds ?? []) {
    const { needsRefetch } = resolveSeedView(seed, at);
    if (needsRefetch) {
      consider(at + SEAL_RETRY_MS);
      continue;
    }
    const bloom = seed?.bloom_at ? new Date(seed.bloom_at).getTime() : NaN;
    if (!Number.isNaN(bloom) && bloom > at) consider(bloom);
  }

  if (soonest == null) return null;
  const delay = soonest - at;
  if (delay > WAKE_HORIZON_MS) return null;
  // No clamp here, and that is the second thing I had to take back on this
  // file. I wrote `Math.max(delay, 0)` with a comment about "a bloom that
  // landed between the read and this call" — and that case cannot reach this
  // line. Every candidate is strictly after `at` by construction: one branch
  // guards on `bloom > at`, the other adds `SEAL_RETRY_MS`, and `at` is read
  // once and never re-read. So `delay` is always positive and the clamp was
  // inert.
  //
  // Inert is not free. A guard on an unreachable case is a hazard asserted
  // rather than found, and it reads to the next person as evidence that
  // negative delays happen here. `check-seed-view.mjs` asserts the invariant
  // over the whole input product instead, which is the difference between
  // claiming it and knowing it.
  return delay;
};
