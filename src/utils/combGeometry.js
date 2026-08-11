// Pure geometry for the Recap month comb (§17.5). No React, no
// react-native — so it can be exercised directly, which matters for a
// module whose defects are all off-by-a-fraction-of-a-cell.

// Seven columns across the month.
export const COLS = 7;
// height / width of a regular pointy-top hexagon.
export const HEX_ASPECT = 2 / Math.sqrt(3); // 1.1547
// Rows overlap by 0.25h — that overlap IS the interlock, and it's why the
// comb is shorter than the old gapped grid while its cells are bigger.
export const ROW_PITCH_RATIO = 0.75;

// A pointy-top hexagon that FILLS its `w × h` box.
//
// The generator this replaces built points from two radii on a circle —
// `w/2 + (w/2)·cos θ` — which inscribes the hexagon in an *ellipse*, making
// the drawn shape only `cos 30° = 86.6%` of the box width. At a column
// pitch of `w` the cells then never touch (6.56pt of gap at w=49), which is
// the exact defect the comb exists to remove. Changing the box ratio can't
// fix that: the box was never the hexagon. Vertices are stated directly so
// the polygon and the lattice are derived from the same `w`.
export const hexPoints = (w, h) =>
  [
    [w / 2, 0],
    [w, h / 4],
    [w, (h * 3) / 4],
    [w / 2, h],
    [0, (h * 3) / 4],
    [0, h / 4],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

// One cell per day, left to right, wrapped by row.
//
// R32: ROW PARITY decides a row's origin; fill state never does. Even rows
// start at 0 and hold 7, odd rows start half a cell in and hold 6. The last
// row is just a row that ran out of days, so 28 / 29 / 30 / 31 all fall out
// of the same two lines with no partial-row branch. Restating this as
// "short rows start half a cell in" reintroduces a bug in 5 months of 12 —
// the rule is parity, not fullness.
export const combLayout = (daysInMonth, w, h) => {
  const pitch = h * ROW_PITCH_RATIO;
  const cells = [];
  let day = 1;
  let row = 0;
  while (day <= daysInMonth) {
    const capacity = row % 2 === 0 ? COLS : COLS - 1;
    const originX = (row % 2) * (w / 2);
    for (let col = 0; col < capacity && day <= daysInMonth; col += 1) {
      cells.push({ day, x: originX + col * w, y: row * pitch });
      day += 1;
    }
    row += 1;
  }
  // Rows overlap, so the comb is one full cell tall plus a pitch per extra row.
  return { cells, height: (row - 1) * pitch + h };
};

// R33: hit-test the hexagon, not the box.
//
// Row pitch is 0.75h but every cell's box is h tall, so consecutive rows'
// bounding boxes overlap by 0.25h. Stacked per-cell Pressables would hand
// each hex's visible bottom point to the day below it — systematically,
// because the offset row's top points sit exactly in the seams above. One
// overlay asks the geometry instead.
//
// Hexagons tile without overlapping, so the first hexagon containing the
// point is the only one: exact, not nearest-neighbour. A point in no
// hexagon (past a short row's end, below February's stub) returns null so
// the caller can no-op rather than clamp to a neighbour.
export const hexAt = (px, py, cells, w, h) => {
  for (const cell of cells) {
    const dx = Math.abs(px - (cell.x + w / 2));
    const dy = Math.abs(py - (cell.y + h / 2));
    // Vertical edges first (cheap reject), then the four slanted ones: off
    // centre, the upper-right edge runs from (0, h/2) to (w/2, h/4).
    if (dx > w / 2) continue;
    if (dy <= h / 2 - (h * dx) / (2 * w)) return cell;
  }
  return null;
};
