import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { resolvePerchPoint } from './flightSequencer';

// Sunbeam §32.2 — where the bee is allowed to land, declared by the screen.
//
// §32's whole argument is that a flight needs DESTINATIONS rather than
// waypoints, and a destination the bee invents is a waypoint wearing a better
// name. So the screen names them, and it names them by wrapping the thing
// itself: `<PerchAnchor>` around the streak card says "the streak card is
// somewhere worth landing on", and the coordinates are whatever that card
// turns out to occupy tonight.
//
// **THE ANCHOR SET IS NOT A TABLE, IT IS THE RENDER TREE.** This is the one
// design decision in this file and everything else follows from it.
//
// Deezine's choreography guide states the anchor count per RENDER STATE —
// TodayTab blank is 3, written is 4, HoneycombTab's week view is 1 and
// therefore gets no bee. A literal table of that shape is a second copy of the
// screen's own conditionals, kept in sync by whoever remembers it exists, and
// Sage found the first drift in it before a line of this was written (the
// write-CTA anchor lives inside the empty-state arm, so it vanishes the moment
// the user writes). A `<PerchAnchor>` inside that arm cannot drift: it
// registers when the arm renders and unregisters when it stops. The count per
// state is then a CONSEQUENCE of the JSX rather than an assertion about it,
// and `check-bee-attitude` section K reads the same JSX to enumerate states.
//
// **Measure-on-use, not cache-on-layout — and here it dissolves a defect
// rather than merely avoiding one.** The guide flags TodayTab's scrolling
// content as a latent constraint: static anchor coordinates go stale when the
// user scrolls and the bee flies to where a card used to be. `read()` calls
// `measureInWindow` at the moment the sequencer chooses, so there is no
// coordinate to go stale — no scroll handler, no throttle, no re-render per
// frame, and no state to keep. `FlyingBee.readOrigin` already established both
// the technique and its failure mode (synchronous on this stack; if it ever
// stops being, the write lands late and the previous value is returned, which
// is exactly cache-on-layout — never worse).
//
// What it does NOT survive is the one thing nothing here survives: a
// natively-driven ancestor transform is invisible to `measureInWindow`
// (§28.13). That is the same structural guarantee the pollinate mount already
// depends on, stated once in `FlyingBee`.
//
// AND THIS SCREEN HAS A LIVE INSTANCE OF IT, so it is named here rather than
// rediscovered as a bug (Sage, 2026-08-17). Every TodayTab anchor sits inside
// a `StaggeredItem`, whose `Animated.View` drives `translateY` with
// `useNativeDriver: true` — exactly the case above. It is BOUNDED BY
// CONSTRUCTION rather than by luck: the entrance runs `Animated.timing` to a
// terminal of `translateY: 0` (`StaggeredItem.js:115-118`, outputRange
// `[14, 0]`), so the discrepancy is at most 14pt, only downward, and only
// while the cascade is in flight — 380ms per item, and with `count`
// defaulting to 1 the delays are `index * 50`, so the last of four items has
// settled by 530ms from mount. Any sortie chosen after that aims at the
// settled frame, and one chosen during it aims at most 14pt off a card that
// is still visibly arriving. `pop` would swap `translateY` for `scale` and
// change that bound; neither perch host passes it.
//
// Window coordinates cross the boundary, §28.2 unchanged — the same currency
// `pollinate` already uses, converted once inside the flight's own box.

const PerchContext = createContext(null);

/**
 * The screen's side of the contract: hold the declared anchors, hand the
 * flight a live reader.
 *
 * Returns a value that is stable except when MEMBERSHIP changes — a card
 * appearing or an arm of a ternary swapping. Coordinates moving do not change
 * it, because coordinates are not stored: `read` measures. That is what keeps
 * a scroll from re-rendering the tree, and it is why `keys` rather than points
 * is the piece held in state.
 */
export const usePerchSet = () => {
  const nodes = useRef(new Map()).current;
  const cache = useRef(new Map()).current;
  const [keys, setKeys] = useState([]);

  const register = useCallback(
    (key, entry) => {
      if (entry) {
        nodes.set(key, entry);
      } else {
        nodes.delete(key);
        cache.delete(key);
      }
      // Membership, in declaration order. Sorting would be a second ordering
      // for the reader to reconcile with the screen's own; `chooseAnchor` is
      // seeded and does not care about order, so the honest one is the order
      // the screen wrote them in.
      setKeys((prev) => {
        const next = [...nodes.keys()];
        return prev.length === next.length && prev.every((k, i) => k === next[i]) ? prev : next;
      });
    },
    [nodes, cache],
  );

  // Measure now. The cached value is a FALLBACK for the frame the measurement
  // lands late on, never the answer — see the file header.
  const read = useCallback(
    (key) => {
      const entry = nodes.get(key);
      if (!entry) return null;
      entry.node?.measureInWindow?.((x, y, width, height) => {
        if ([x, y, width, height].every((v) => Number.isFinite(v)) && width > 0 && height > 0) {
          cache.set(key, resolvePerchPoint({ x, y, width, height }, entry.on, entry.at));
        }
      });
      return cache.get(key) ?? null;
    },
    [nodes, cache],
  );

  return useMemo(() => ({ keys, read, register }), [keys, read, register]);
};

/**
 * Provide the set to everything below it.
 *
 * Separate from `usePerchSet` because the screen needs the value in two
 * places — down the tree to the anchors, and across to `<FlyingBee perches>`
 * — and a provider that also owned the state could only give it to one.
 */
export const PerchField = ({ perches, children }) => (
  <PerchContext.Provider value={perches}>{children}</PerchContext.Provider>
);

/**
 * Declare one anchor, by wrapping the thing it is an anchor ON.
 *
 * @param id  stable within the screen; `chooseAnchor`'s anti-repeat memory is
 *            keyed on it, so an id that changes per render is a bee that has
 *            forgotten where it just was
 * @param on  'left' | 'right' — §32/R122. TodayTab's anchors are full-width
 *            blocks in one 24pt column, so a set that puts them all on the
 *            same side has zero x-extent and the bee never turns around.
 *            Alternate them; `check-bee-attitude` row K4 ("the set is not a
 *            column") measures the result against the declarations below.
 *            J6/J7 derive the one-body-width threshold K4 reuses; they sweep
 *            synthetic sets and read nothing this file declares.
 * @param at  0..1 along that side, top to bottom
 *
 * `collapsable={false}` is load-bearing on Android: a View with no drawing
 * props of its own is eligible to be collapsed out of the native hierarchy,
 * and a collapsed view measures as nothing.
 */
export const PerchAnchor = ({ id, on = 'left', at = 0.5, children, style }) => {
  const perches = useContext(PerchContext);
  const ref = useRef(null);

  const setNode = useCallback(
    (node) => {
      ref.current = node;
      perches?.register(id, node ? { node, on, at } : null);
    },
    [perches, id, on, at],
  );

  return (
    <View ref={setNode} collapsable={false} style={style}>
      {children}
    </View>
  );
};
