import React from 'react';
import { Image, View } from 'react-native';
import { MASCOT_ASPECT, MASCOT_WIDTH_FRACTION } from '../constants/mascot';

// §17.3 / R83 — **the mascot in the keepsake register.**
//
// R51 ruled that register follows provenance: a bee that flew in wears the
// painted flight register, and a bee that never flew — a keepsake, standing on
// a card — wears the knockout, ink body with the band cut out so the card's
// own gold shows through. `MascotBee` serves the first. This serves the second.
//
// **Why this is not a redraw.** R79 priced the knockout as a loss, on the
// ground that a raster cannot recolour: `fieldColor` goes inert the moment the
// character is a PNG, and the rendered body sits at ΔE00 8.05 from `goldField`
// against ink-on-gold's 69.19. That arithmetic is right and the conclusion
// didn't follow. The mascot **inverts which element carries the form** —
// yellow body, ink bands, where `StripedBee` is ink body and knocked-out bands
// — so undoing that inversion *is* the knockout. Every feature of the
// character is partitioned by the same one chroma split, so a two-tone map
// preserves the partition by construction: nothing is redrawn, nothing is
// dropped, and the result is the same drawing rather than a likeness of it.
//
// The cut is carried by **alpha, not by gold**, so the asset is field-agnostic
// and this component takes no colour prop at all. 66.5% of the covered pixels
// are at full alpha, which is to say they are literally `ink` — the register is
// restored at 10.01:1 against `goldField`, not approximated. The ink features
// (bands, eyes, brows, antennae) are 21.5% of the body and become holes.
// Pipeline: `.scratch/r83-keepsake/build.py`, exported by `export.py` onto the
// same character box as the flight layers, so `constants/mascot.js` transfers
// unchanged and a call site swapping between registers keeps its footprint.
//
// No wing beat: a keepsake bee is standing still. That is the whole difference
// between the two registers, and it is why they are two components rather than
// one with a flag.
const KEEPSAKE = require('../../assets/mascot-keepsake.png');

export const KeepsakeBee = ({ size = 44 }) => {
  const width = size * MASCOT_WIDTH_FRACTION;
  const height = width / MASCOT_ASPECT;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={KEEPSAKE} style={{ width, height }} resizeMode="contain" />
    </View>
  );
};
