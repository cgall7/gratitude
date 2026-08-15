// Measured geometry of the ratified mascot render, kept apart from the
// component that draws it so a gate can import the numbers. Every figure here
// is produced by `.scratch/r82-mascot-flight/export.py` from
// `GUIDES/assets/final-mascot-2026-08-12.png`; re-run it if the render is ever
// re-exported, because all four are properties of that specific drawing.

// Character box: the union of the two layers' bounding boxes, 1013 x 1049px.
// Both PNGs are cropped to it, so they stack by being the same size in the
// same place and need no per-layer offsets.
export const MASCOT_ASPECT = 1013 / 1049;

// The character is drawn at this fraction of the `size` box. It is
// `StripedBee`'s own drawn width fraction — its content spans x 5.2..21.6 of a
// 24-unit viewBox — so a call site that swaps one for the other keeps its
// footprint. Height follows from the aspect and comes out at 0.708 of the box
// against StripedBee's 0.47: the mascot has a head and a trailing abdomen.
export const MASCOT_WIDTH_FRACTION = 16.4 / 24;

// Wing root, as a fraction of the character box. This is the pivot for the
// beat; it is not the box centre, which is why `MascotBee` composes the pivot
// by hand. Measured as the mean of the 2% of wing pixels with the largest x —
// the wing mass lies left of the body, so its head-most end is where it meets
// the thorax. R79 estimated (0.438, 0.492) off the unsplit render; the split
// layers put it at (0.427, 0.505).
export const HINGE = { x: 0.4273, y: 0.5050 };

// Full sweep of one wing beat, R79's figure. The flap radius — root to the
// farthest wing pixel — is 0.411 of the box height, so 18 degrees moves the
// tip 0.128 box-heights: 4.0pt at size 44, 1.2pt at size 13. R79 quoted 6.60pt
// at 44 assuming the character filled its box; at `MASCOT_WIDTH_FRACTION` it
// doesn't, and 4.0pt is the figure that ships.
export const WING_BEAT_DEG = 18;

// §17.3's ratified half-cycle, unchanged. `StripedBee` beat 1 -> 0.55 in this
// time and the mascot rotates instead, because a scaleY about a root hinge
// barely moves a wing that extends horizontally away from it — the ratified
// quantity was always the beat, and scaleY was a guess at how to drive one.
export const WING_BEAT_MS = 80;
