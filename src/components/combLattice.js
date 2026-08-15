// The comb's geometry, and the one question everything asks of it: which
// person is at this point?
//
// Extracted from `HoneycombGrid` for the same reason `beeAttitude.js` and
// `pollinationFlight.js` are dependency-free — no React, no react-native, no
// theme — so `scripts/check-bee-attitude.mjs` can **import and sample** the
// hit-test rather than pattern-match the source of a component it cannot
// load. §28.9 gate row 8 asserts that the pollination abort predicate IS the
// comb's own hit-test and not a copy of it; that row is only meaningful if
// there is exactly one implementation and it is importable.
//
// §17.5's two-utils ruling permits distinct mechanisms for distinct surfaces
// (the comb hit-tests by first-containment, the hive by cube-round). It does
// not permit two answers to one question inside one screen.

// Cube-direction walk around a hex ring, center-out — gives the classic
// "spiral" fill order (1, 6, 12, 18…) a honeycomb actually grows in, and
// doubles as the stagger order for the zoom-in animation.
const AXIAL_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexSpiral = (maxRadius) => {
  const out = [{ q: 0, r: 0 }];
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let q = AXIAL_DIRS[4].q * radius;
    let r = AXIAL_DIRS[4].r * radius;
    for (let side = 0; side < 6; side += 1) {
      for (let step = 0; step < radius; step += 1) {
        out.push({ q, r });
        q += AXIAL_DIRS[side].q;
        r += AXIAL_DIRS[side].r;
      }
    }
  }
  return out;
};

// Flat-top axial -> pixel, matching the flat-top polygon points in HexShape.
export const axialToPixel = (q, r, size) => ({
  x: size * 1.5 * q,
  y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
});

// Inverse of axialToPixel (flat-top), pre-round — see Red Blob Games'
// pixel_to_hex.
export const pixelToAxialRaw = (x, y, size) => ({
  q: ((2 / 3) * x) / size,
  r: ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size,
});

// Cube rounding: nearest-hex-center is exact for a tessellation (the Voronoi
// region of a hex center is the hexagon itself), so this is the correct
// hit-test, not an approximation.
export const axialRound = (q, r) => {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
};

// One lattice step: the distance between two neighbouring seat centres.
// `hexPoints` puts vertices at 60°·i from the centre at radius `size`, so a
// cell is 2·size across corners and √3·size across flats — and √3·size is
// also the seat step, and half of it (38.105pt at 44) is the Voronoi boundary
// where an aim point crosses into the neighbouring seat. Read off the real
// generator, not assumed from an orientation label.
export const ringStepFor = (cellSize) => Math.sqrt(3) * cellSize;

// The comb's identity for a grid member: WHO, not WHICH POST (§28.9
// correction 2). `id` is the share, and a share is a thing a person can
// replace; the face in the seat is what the user pointed at. One expression,
// shared by everything that has to answer "still the same person" — the
// partition's one-seat-per-person filter, the selection ring, the reveal card
// and the pollination abort — because three copies of a key is three chances
// for them to disagree.
//
// The fallback is not a fallback, it is the same key. Demo shares carry no
// author field anywhere in `demoHive.js`, and `demo-${index}` indexes a
// constant where one row is one person, so this resolves to a person key for
// both populations rather than to a person key with a share-shaped hole.
export const personKey = (member) => member?.authorId ?? member?.id ?? null;

/**
 * Seat a list of members and return the cells, the cluster's size, and the
 * hit-test. Members fill the spiral centre-out; the rest of the seats stay
 * empty rather than being padded with people who don't exist.
 */
export const buildCombLayout = (seated, cellSize, spiral = hexSpiral(1)) => {
  const positions = spiral.map((axial) => axialToPixel(axial.q, axial.r, cellSize));
  const minX = Math.min(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const width = Math.max(...positions.map((p) => p.x)) - minX + cellSize * 2;
  const height = Math.max(...positions.map((p) => p.y)) - minY + cellSize * 2;

  const byAxial = new Map();
  const cells = spiral.map((axial, index) => {
    const member = seated[index] ?? null;
    byAxial.set(`${axial.q},${axial.r}`, member);
    return {
      key: member?.id ?? `empty-${axial.q},${axial.r}`,
      member,
      x: positions[index].x - minX,
      y: positions[index].y - minY,
      index,
    };
  });

  // Single hit-test for the whole cluster (R25/R34): a tap lands on the
  // hexagon whose centre it is nearest to, not on whichever cell's box
  // happened to paint last. Cell centres sit at (x + cellSize, y + cellSize)
  // in this same cluster space, so undo that offset before inverting. A point
  // outside the seven slots returns null.
  const hitTest = (x, y) => {
    const raw = pixelToAxialRaw(x + minX - cellSize, y + minY - cellSize, cellSize);
    const { q, r } = axialRound(raw.q, raw.r);
    const key = `${q},${r}`;
    return byAxial.has(key) ? { seat: key, member: byAxial.get(key) } : null;
  };

  return { cells, width, height, hitTest };
};

/**
 * §28.9 — the pollination abort predicate, whole.
 *
 * **Abort when the point the bee is aimed at would no longer resolve, under
 * the comb's own hit-test, to the PERSON the user tapped.**
 *
 * Not the seat: re-seating does not move the seat — the lattice is fixed — it
 * moves who is sitting in it, so a seat-keyed check passes while the bee
 * alights on the right hexagon holding the wrong person. Not the share
 * either: `id` is a post, and the user tapped a face.
 *
 * This is `hitTest` run FORWARD instead of backward. The tap picked a person
 * by nearest centre; the abort asks whether the landing point still picks the
 * same one. One criterion, two directions, one implementation.
 *
 * @param layout   the live layout — seating included, which is what makes a
 *                 re-seat with an unmoved aim point abort
 * @param aim      { personId, localX, localY, scrollY } captured at the tap
 * @param scrollY  the live scroll offset, read by value
 */
export const shouldAbortPollination = (layout, aim, scrollY) => {
  if (!layout || !aim) return true;
  // Scrolling down by Δ moves content up, so a point fixed in window space
  // maps to a cluster point Δ further down. Vertical only: the Hive does not
  // scroll sideways.
  const drift = scrollY - aim.scrollY;
  const hit = layout.hitTest(aim.localX, aim.localY + drift);
  return personKey(hit?.member) !== aim.personId;
};
