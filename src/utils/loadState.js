// §23.1 — EMPTY IS A POSITIVE CLAIM, as a function instead of a habit.
//
// WHY THIS IS A UTIL AND NOT PART OF LoadState.js.
//
// It started inside the component and moved out the moment I tried to gate it:
// LoadState.js is JSX, so it cannot be loaded without a renderer, and this repo
// has none. That is the tell rather than the inconvenience. This function is
// the rule the whole of §23 turns on — it decides whether a screen is allowed
// to tell a user they have no friends — and a rule that can only be checked by
// reading it is a rule nobody checks. Same split as `seedDraft.js`: the
// decision is plain JS in `utils/`, the pixels are in `components/`.
//
// `LoadState.js` re-exports both of these, so consumers still have one import.

export const LOAD_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  STALE: 'stale',
  UNKNOWN: 'unknown',
};

/** Derive which of the five states to RENDER from how the last read ENDED plus
 *  how many rows are actually in hand.
 *
 *  A screen tracks only the read outcome (`loading` / `ready` / `unknown`). It
 *  never picks the view at the call site, because picking it at the call site
 *  is how `empty` came to mean `failed` in three shipped screens.
 *
 *  Two properties are the whole point, and `check-load-state.mjs` asserts them
 *  over the entire (readState x count) product rather than trusting this prose:
 *
 *    1. `EMPTY` is returned only when `readState === READY`. Emptiness is a
 *       claim about the user's data, so it requires a read that returned.
 *    2. Holding rows is never blanked by a later failure (§23.1a) — a failed
 *       re-read over kept content is `STALE`, and `STALE` is a line above the
 *       content, not a takeover of it.
 *
 *  It also removes the reason a screen needed a ref: the failure branch does
 *  not have to know how many rows it is holding, because it no longer decides.
 */
export const resolveListView = (readState, count) => {
  const holding = count > 0;
  // A refresh in flight over content is not a spinner — §23.1a again. The
  // takeover spinner is only for the load that has nothing behind it.
  if (readState === LOAD_STATES.LOADING) return holding ? LOAD_STATES.READY : LOAD_STATES.LOADING;
  // READY is named rather than left as the fallthrough, and that is the whole
  // point of the line. It used to be `return holding ? READY : EMPTY`, so ANY
  // value that was not exactly LOADING or UNKNOWN asserted emptiness — a typo
  // in a setter, or a sixth read outcome added later and not handled here, and
  // the screen tells the user they have no friends on the strength of a read
  // whose outcome it does not know. Exactly the defect this function exists to
  // make unreachable, sitting in its own default branch. Found by writing the
  // gate, not by reading the code.
  if (readState === LOAD_STATES.READY) return holding ? LOAD_STATES.READY : LOAD_STATES.EMPTY;
  // Everything else, UNKNOWN included, fails safe. `unknown` is by construction
  // the state that claims nothing about the user's data, so it is the only
  // honest landing place for "I do not know how that read ended."
  return holding ? LOAD_STATES.STALE : LOAD_STATES.UNKNOWN;
};
