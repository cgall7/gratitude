// Sunbeam §31 — the reveal sequencer.
//
// ┌─ NOT WIRED YET, AND HERE IS HOW TO TELL THAT FROM ORPHANED ─────────┐
// │ This module has NO importer in `src/` or `App.js`. That is the      │
// │ engine half of a two-owner piece of work landing first, not a call  │
// │ site somebody deleted.                                              │
// │                                                                     │
// │   consumers  8b.4 Trip Down Memory Lane (author reviews a hive)     │
// │              and 8b.6 package-open (recipient opens what was sent). │
// │              ONE engine, two mount points — Colin's ruling of       │
// │              2026-08-17, `PLANS/Pollinate_The_Ruling.md` amendment. │
// │   owner      Pixel (engine, this file) / Deezine (choreography —    │
// │              the bloom itself, the date's typography and its        │
// │              entrance, what an early tap feels like, `paceMs`)      │
// │   plan       `PLANS/Pollinate_Delivery_Slices.md` Project 8b        │
// │   exercised  `scripts/check-reveal-pacing.mjs` — sampled and run    │
// │              today, just not from the app                           │
// │                                                                     │
// │ THE FALSIFIER, because a name and an owner both decay: if Project   │
// │ 8b has shipped a reveal that does not import this file, this module │
// │ is dead and should be deleted, not maintained. Grep for the import, │
// │ not for the word "reveal".                                          │
// └─────────────────────────────────────────────────────────────────────┘
//
// THE ACCEPTANCE BAR IS PACING, NOT PARTICLE EFFECTS (the ruling, verbatim):
// entries surface one at a time, dates visible, one tap per memory, and the
// recipient cannot skim. If a tester screenshots it or cries it passes; if
// they scroll it like a feed it fails, whatever it looks like.
//
// That bar is the reason this file exists at all. "One tap per memory" is a
// property a bare `<Pressable onPress={next}>` satisfies while still letting
// someone rapid-tap through a 47-entry hive in seven seconds — the same skim
// the ruling bans, entered with a different finger. `PollinateWrapped.js`
// ships exactly that shape today (`nextSlide`, a whole-screen `onPress` with
// no floor of any kind, plus a last-tap fallback that wraps back to slide 0).
// The reveal may inherit neither half.
//
// So the pacing lives in a state machine rather than in an animation, and the
// state machine is a pure function of (state, time, tap) so that a gate can
// SAMPLE it instead of pattern-matching source it cannot run. R81: sample the
// function, not the flight. A sequencer is a generator of sessions, so the
// only honest way to gate one is to sweep its inputs.
//
// **Zero imports, and that is stricter than "no react-native".**
// `check-reveal-pacing.mjs` loads this file by reading the source and
// importing it as a base64 `data:` URL — the only way to `import` a `.js`
// file in a package that is not `type: module`. A `data:` URL has no base to
// resolve against, so a RELATIVE specifier fails there too
// (ERR_UNSUPPORTED_RESOLVE_REQUEST). The moment this file imports React,
// React Native, the theme or `motion.js`, that gate degrades to string
// matching — which is precisely the failure the rule was written to prevent.
// Anything this file needs from elsewhere arrives as an argument.

// --- the four rulings this file encodes (R117) ----------------------------
//
// 1. THE FLOOR IS THE ARRIVAL PLUS THE READ. **AMENDED — R118, and the
//    sentence it replaces was mine:** *"the floor IS the arrival, and nothing
//    longer… so there is no `MIN_DWELL_MS` in this file."* Deezine adopted
//    that literally (`PRIVATE_HIVE_REVEAL_CHOREOGRAPHY.md` §1) and it does not
//    survive its own arithmetic, because of what §2 of that same spec says
//    about when an entry becomes readable:
//
//      "The entry becomes readable (fully opaque, fully scaled/positioned,
//       text rendered) AT THE END of the bloom."
//
//    Compose the two and the tap unlocks at the exact instant the words first
//    become legible. The floor buys ZERO reading time — it protects the
//    animation and nothing else. Measured against the corpus this app
//    actually produces (`scripts/check-reveal-pacing.mjs` recomputes it):
//    `demoSeed`'s 26 sample lines run 9-17 words (mean 11.2) and the 72
//    composed `prompts.js` sparks run 6-12 (mean 9.0). At 300 wpm — a FAST
//    silent rate, deliberately the fast one, see `readWpm` — that is 1.8-2.2s
//    of reading, against a bloom of 0.8-1.2s that has already ended.
//
//    What survives is the REASON, not the letter: **no lockout may be
//    invisible.** A tap that does nothing has to be visibly refused or it is a
//    dead button. The letter said the arrival was the only thing that could do
//    the refusing — but Deezine's §5/§6 had already invented a second carrier
//    (the progress rail) and scoped it to Reduce Motion, where the arrival is
//    over long before the floor is. That situation is now the GENERAL one, so
//    the rail is mandatory in BOTH registers and RM stops being a special
//    case. See ruling 3, which this simplifies rather than complicates.
//
//    The floor is therefore per-step, because the read is: `dwellMs(grammar,
//    step)` = the bloom plus that entry's own words at the fast rate. A
//    six-word memory and a forty-word one do not deserve the same hold, and
//    a single number for both is a number chosen against neither.
//
// 2. AN EARLY TAP IS DROPPED, NEVER QUEUED. A buffered tap is a skim path
//    with a delay — pre-tap five times during entry 1 and you have spent
//    your taps on entries 2 through 6. Encoded as REFERENTIAL IDENTITY:
//    `tapReveal(s, ...) === s` when the tap is refused. There is nowhere for
//    a queued tap to accumulate because there is no new object.
//
// 3. REDUCE MOTION SUBSTITUTES THE ARRIVAL, NEVER THE PACE. RM is vestibular
//    safety, not a request for speed. If the bloom collapses to a crossfade
//    and the floor collapses with it, RM users are handed the exact skim path
//    ruling 1 exists to close. So `dwellMs` does not take a `reduced`
//    argument and cannot vary with the register; `arrivalMs` does and must.
//    Note which bloom the floor is built from: `grammar.bloomMs`, the FULL
//    one, never `arrivalMs(grammar, reduced)`. Sourcing the floor from the
//    resolved arrival would let RM shorten the pace through the back door,
//    which is this ruling's whole content.
//
//    Under R118 this ruling gets simpler rather than harder. It used to carry
//    a special case — "under RM the arrival ends early, so the rail has to
//    carry the beat there" — and after the amendment the arrival ends early in
//    EVERY register, so the rail is unconditional and RM is no longer
//    exceptional in this file at all. It differs in one number.
//
// 4. THE BAN IS ON A GESTURE THAT CHANGES WHICH ENTRY IS SHOWING — NOT ON
//    SCROLLING. A long memory that overflows one screen must still be
//    readable, and scrolling WITHIN an entry skims nothing. A blanket "no
//    scroll" would delete the only recovery path for the longest entries,
//    which are the ones most worth reading. Nothing in this file can enforce
//    that; it is a call-site rule and `check-reveal-pacing.mjs` asserts it
//    there.
//
// And two smaller ones, both visible in what is NOT below:
//
// 5. NO AUTHOR/RECIPIENT MODE. Memory Lane and package-open differ in what
//    feeds the sequence and in what happens at the end. Both are call-site
//    facts. A `mode` parameter here would be the two mount points quietly
//    becoming two engines.
//
// 6. AN UNDATED STEP IS A DEFECT, NOT A DEGRADED RENDER. Time is the material
//    of the gift — *March 12… April 3…* is the point of the sequence, not its
//    caption. `buildRevealSequence` refuses to build rather than let a step
//    reach the screen with nothing to say about when it happened.

// --- the grammar ----------------------------------------------------------
//
// PLACEHOLDER. Both fields are Deezine's under the §12.5 ownership split;
// these values exist so the engine can be built, sampled and gated before the
// choreography spec lands, and they are NOT a design. Replacing this object
// is the whole of the hand-off — no engine change should be needed to accept
// a timing table.
export const STUB_GRAMMAR = {
  // THE BLOOM. Deezine's, and R118 hands it back unchanged: the choreography
  // spec's §2 range is 800-1200ms and 900 is its own worked example. What the
  // amendment removes from this number is a JOB it could not do — it is the
  // arrival, it is no longer the pace, and Deezine's range needs no revision
  // to stop being one.
  bloomMs: 900,
  // The Reduce Motion arrival — a crossfade, not a bloom. `DURATIONS
  // .reducedMotionFade` in `src/constants/motion.js` is 200 today; it is
  // copied rather than imported for the reason in the header, and the consumer
  // passes the live one in. (The choreography spec §5 says 400-600 — that is a
  // number to reconcile with the token the rest of the app already fades at,
  // and it is Deezine's call which moves. Nothing here depends on which.)
  // Ruling 3: this shortens the ARRIVAL. It does not appear in `dwellMs`.
  reducedFadeMs: 200,

  // THE READ RATE, and it is the one number in this table that is NOT a taste
  // decision — which is why it is mine and the bloom is Deezine's. Deezine
  // asked me to pick the bloom duration; the honest answer is that the bloom
  // was never the pacing lever, and the lever that replaced it is a
  // measurement rather than a preference.
  //
  // 300 wpm is deliberately a FAST silent reading rate, not an average one
  // (adult silent reading of ordinary prose centres near 240; 300 is the upper
  // end of comfortable). The floor is a MINIMUM, so it should be set where we
  // are confident nobody has read the line — not where the median reader
  // finishes. Setting it at the average would leave the fast reader holding a
  // dead button, which is exactly the failure ruling 1 was written about, and
  // the slow reader is not harmed by a floor they were never going to hit.
  readWpm: 300,
  // Word counts are a proxy for reading time and they degrade at both ends, so
  // the proxy is bounded rather than trusted.
  //
  // FLOOR: 1200ms, the shortest thing the app's own corpus produces (the
  // 6-word minimum over 72 composed sparks, at `readWpm`). An entry shorter
  // than that — one word, or an image with no text at all — is not evidence
  // that a glance is enough, only that the word count stopped measuring.
  //
  // CAP: 12000ms, 60 words at `readWpm`. Three and a half times the longest
  // line this app has ever generated (17 words). Past that point the floor is
  // no longer what stops a skim — a reader still on the same memory after
  // twelve seconds is reading voluntarily — and an unbounded floor turns a
  // pasted essay into a frozen screen.
  readFloorMs: 1200,
  readCapMs: 12000,
};

// --- building the sequence ------------------------------------------------

// 'YYYY-MM-DD', the shape `entries.entry_date` has and `EntryStore.toEntry`
// hands on as `date`. Parsed by hand rather than with `new Date(s)`, which
// silently rolls '2026-02-31' forward to March 3 and would let an impossible
// date through as a plausible one.
const parseCalendarDate = (value) => {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // The round trip is the validation: Date.UTC normalises out-of-range parts,
  // so a date that does not come back unchanged never existed.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return t;
};

// Whitespace runs, which is the standard convention a wpm figure is quoted
// against. Not characters/5 — that estimator exists for typing speed and
// under-counts short words, which is the whole of this corpus.
const countWords = (text) => {
  if (typeof text !== 'string') return 0;
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
};

// Chronological, oldest first — the hive read in the order it was lived,
// which is what makes the dates accumulate into a year rather than list one.
//
// Ties are real and have to break deterministically: `entries_one_journal_per_day`
// is `where hive_id is null`, so a hive may hold several entries on one date
// (20260815000001's closing note says so in as many words). `savedAt` then
// `id` is a total order over rows that exist, and an unstable sort here would
// mean the same hive reveals in a different order on the author's phone and
// the recipient's.
export const buildRevealSequence = (entries) => {
  if (!Array.isArray(entries)) throw new Error('buildRevealSequence needs an array of entries');
  const steps = entries.map((entry, i) => {
    const at = parseCalendarDate(entry && entry.date);
    // Ruling 6. Loud, at build time, naming the offender — not a step that
    // renders with a blank where the date goes.
    if (at === null) {
      throw new Error(
        `Reveal step ${i} (entry ${entry && entry.id}) has no usable date: ${JSON.stringify(entry && entry.date)}`
      );
    }
    // `savedAt` rides along because it is what breaks the tie below — a step
    // carries the keys that ordered it, rather than the comparator reaching
    // back into the input array for them. `words` rides along for the same
    // shape of reason: R118 makes the floor a function of the entry's own
    // length, so the quantity the floor is computed from is a property OF THE
    // STEP, counted once here, rather than re-derived from `text` on every
    // frame the rail redraws.
    return {
      id: entry.id,
      at,
      date: entry.date,
      text: entry.text,
      words: countWords(entry.text),
      savedAt: entry.savedAt,
    };
  });
  return steps.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    const sa = String(a.savedAt || '');
    const sb = String(b.savedAt || '');
    if (sa !== sb) return sa < sb ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
};

// --- the machine ----------------------------------------------------------
//
// Three fields and no more. `index` is which memory is showing, `arrivedAtMs`
// is when it started arriving (the clock the floor is measured against), and
// `done` is the terminal flag the CALL SITE reads to decide what an ending is.
// The engine has no opinion about the ending, which is ruling 5 doing its job:
// the author returns to the hive, the recipient meets a reply surface that
// does not exist until Slice 1.1, and neither of those is pacing.
export const startReveal = (nowMs) => ({ index: 0, arrivedAtMs: nowMs, done: false });

// The read, bounded. Separate from `dwellMs` so a gate can sweep it over word
// counts without constructing a grammar around each one, and so the two bounds
// are assertable as the distinct claims they are.
export const readMs = (step, grammar) => {
  const raw = ((step && step.words) || 0) * (60000 / grammar.readWpm);
  return Math.max(grammar.readFloorMs, Math.min(grammar.readCapMs, raw));
};

// Ruling 1, as amended by R118: the floor is the arrival PLUS the read, and it
// is per-step because the read is. Ruling 3: still no `reduced` parameter, and
// adding one is still the regression — note it composes `grammar.bloomMs` and
// not `arrivalMs(grammar, reduced)`, which is the same rule stated as code.
export const dwellMs = (grammar, step) => grammar.bloomMs + readMs(step, grammar);

// Ruling 3: this one does take the register, because the register is exactly
// what it is about.
export const arrivalMs = (grammar, reduced) => (reduced ? grammar.reducedFadeMs : grammar.bloomMs);

export const canAdvance = (state, nowMs, sequence, grammar) =>
  !state.done && nowMs - state.arrivedAtMs >= dwellMs(grammar, sequence[state.index]);

// What the screen shows while it is refusing a tap. 0..1 over the floor.
//
// R118 promotes this from an RM affordance to THE instrument. The floor now
// outlives the arrival in every register — by ~2.2s at the corpus mean with a
// 900ms bloom, by ~2.9s under RM — so for most of every beat the bloom has
// finished, the screen is still, and this number is the only thing on it that
// says "not yet". The rail it drives is therefore mandatory unconditionally,
// which is ruling 1's surviving half: no lockout may be invisible.
export const dwellProgress = (state, nowMs, sequence, grammar) => {
  const d = dwellMs(grammar, sequence[state.index]);
  if (!(d > 0)) return 1;
  return Math.max(0, Math.min(1, (nowMs - state.arrivedAtMs) / d));
};

// --- what the rail is, since this module now requires one (R118) -----------
//
// The choreography spec's §6 describes the rail twice and the two descriptions
// are different instruments: "47 segments, current entry as a filled segment,
// remaining entries unfilled" is POSITION IN THE SEQUENCE, and "the fill
// animates during the bloom… on next tap the rail resets to 0%" is THE DWELL.
// A position indicator does not reset. Ruled: **it is the dwell**, on three
// counts, and the engine backs that by exporting `dwellProgress` and no index
// fraction at all.
//
//   * ROLE. What the rail was made mandatory FOR is the refused tap. Only the
//     dwell answers "why did nothing happen"; position answers a question
//     nobody asked at that moment.
//   * THE GATE. "If they scroll it like a feed, it fails." A visible *35 to
//     go* is a countdown, and a countdown is the thing a feed's scrollbar
//     does to reading — it makes the remainder a quantity to get through. The
//     one piece of chrome we are adding should not re-import the posture the
//     ruling bans.
//   * IT DOES NOT SCALE, MEASURED. In 353pt of usable width (393 less 2x20)
//     with 2pt gaps, 47 segments are 5.55pt each — fine. But §24 already sized
//     a hive's own year at 365 cells, and 365 segments is -1.03pt: the layout
//     is impossible, not merely cramped. It crosses 1pt (3px at @3x) at 118
//     entries. A hive is a thing you add to for a year; an instrument that
//     dies partway up its own range is not the instrument.
//
// COLOUR, and this one is not a preference either. §23.11 already ruled this
// exact component — a progress track on `background` — after shipping it at
// `rgba(34,27,3,0.15)`: the 3:1 floor for `ink` there is alpha 0.4717 and the
// ruled value is 0.5 (3.25:1), with "A PROGRESS INDICATOR IS A FRACTION;
// WITHOUT THE DENOMINATOR IT IS A DIFFERENT COMPONENT" as the reason. §6's
// "ink at 12%" is BELOW the 0.15 that was ruled a defect.
//
// The fill is the sharper problem. §6 puts `accent` in it, and marigold on
// cream is a CHROMA difference, not a luminance one (§20.7: WCAG is
// luminance-only and Sunbeam is one hue):
//
//     accent #FFD200 vs background #FFF7CC .... 1.3426   (and the token is
//                                                #FFD200 — §6 says #FFC300)
//     accent fill vs ink@0.12 track ........... 1.0573   invisible
//     accent fill vs ink@0.50 track ........... 2.4190   still under 3:1
//     ink fill vs ink@0.50 track .............. 4.8699   §23.11's own pair
//
// So the rail is `ink` on `ink` at 0.5 — §23.11's ratified pair reused
// unchanged, not a new design. Accent cannot carry a fraction on cream; that
// is why §23.11's rail survived contrast in the first place.

// 0..1 over the arrival, for the bloom itself. Separate from `dwellProgress`
// on purpose: they are the same number in the default register and they are
// NOT the same number under Reduce Motion, and collapsing them is how the
// pace would quietly follow the animation.
export const arrivalProgress = (state, nowMs, grammar, reduced) => {
  const a = arrivalMs(grammar, reduced);
  if (!(a > 0)) return 1;
  return Math.max(0, Math.min(1, (nowMs - state.arrivedAtMs) / a));
};

// THE tap. Ruling 2 is the `return state` on both refusal branches: the caller
// gets back the object it passed in, so `setState` sees no change, nothing
// accumulates, and a gate can assert the drop by identity rather than by
// inspecting fields that a future queue would be added alongside.
export const tapReveal = (state, nowMs, sequence, grammar) => {
  if (state.done) return state;
  if (!canAdvance(state, nowMs, sequence, grammar)) return state;
  const next = state.index + 1;
  // The last memory does not give way to a wrap-around, a replay prompt or a
  // blank — it stays on screen and `done` goes true. `PollinateWrapped.js:196`
  // wraps to slide 0 when its call site passes no `onComplete`, which spends
  // the ending on a repeat; a reveal that loops has no ending to spend.
  if (next >= sequence.length) return { index: state.index, arrivedAtMs: state.arrivedAtMs, done: true };
  return { index: next, arrivedAtMs: nowMs, done: false };
};

// Going BACK is deliberately absent, and this note is the falsifier for that
// absence: it is not an oversight and it is not settled forever. A back step
// is not itself a skim — re-advancing still pays the floor — but it is the
// first half of a scrub, and a scrub is what the ruling means by a feed. If
// testers mis-tap past a memory and say so, that is the evidence that opens
// this, and the shape it should take is a back step that RE-ARMS the floor.
