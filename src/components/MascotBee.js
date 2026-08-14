import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import {
  HINGE,
  MASCOT_ASPECT,
  MASCOT_WIDTH_FRACTION,
  WING_BEAT_DEG,
  WING_BEAT_MS,
} from '../constants/mascot';

// §19.5 / R79 — **the mascot itself, flying.** Colin: "never have any other
// bee than our mascot." A redraw cannot satisfy that by construction — the
// best flat cousin is still a likeness — so the character in flight is the
// ratified 3D render, split into two layers so it can still beat its wings.
//
// **Why a split raster has parts.** R70 concluded it doesn't, off the render's
// alpha: 89% fully opaque, no second population. That measured a *material*
// property when separability is a *geometric* one — the only thing you cannot
// recover is what something else is painted over. The wings sit entirely
// behind and to the left of the body; body pixels straddle the wing span in 22
// of 1254 rows, and those rows are legs, which belong to the body layer
// anyway. So a mask splits it and nothing has to be painted back in.
//
// **The cutout does not use R70's luma key.** That recipe took alpha from
// luminance against the black plate, which is right for the wings — genuinely
// translucent, and bright enough that luma tracks their opacity — and wrong by
// construction wherever the subject is dark. The mascot's dark pixels are its
// bands, eyes, brows and antennae: every feature that carries the character.
// Measured on the first split, the bands recomposited at median max-channel
// 117 against the source's 42, because their alpha averaged 0.752 and the
// cream ground came through. The yellow body reproduced exactly, which is why
// the recipe looked solved — it had been validated on the pixels that could
// not fail it. Alpha now comes from a filled subject mask (a dark band is
// interior, whatever its luma) and the luma ramp survives only inside the wing
// region. Bands rebuild at 17.0 against the source's 17.0.
// Pipeline: `.scratch/r82-mascot-flight/build_layers.py`.
//
// **The character is not levelled.** Its body axis is drawn climbing (−45.6°
// abdomen-to-head, −55.3° by thickness-weighted PCA — two measurements that
// agree on a quantity which turns out not to decide anything). Rotating the
// body level tips the *head*, because the head is already drawn upright: what
// a viewer reads as the character's attitude is set by the face, not the body
// axis. Rendered side by side at the four real cruise attitudes, the drawn
// pose reads upright and airborne at every one and the levelled pose reads as
// a face-plant. So the drawn pose IS the flight pose, and `bank` tips it from
// there. Sheet: `.scratch/r82-mascot-flight/flight_attitudes.png`.
//
// Sizing is a drop-in for `StripedBee`: `size` is the box side, and the
// character is drawn at `MASCOT_WIDTH_FRACTION` of it — the same fraction of
// its box that StripedBee's drawing occupies (0.683), so every anchored call
// site keeps its footprint. It comes out taller (0.708 vs 0.47 of the box),
// which is the head and the trailing abdomen that StripedBee doesn't have.
const WING = require('../../assets/mascot-wing.png');
const BODY = require('../../assets/mascot-body.png');

// `beat` lets a caller drive the wing itself with an Animated.Value in [0,1].
// The component owns the beat's GEOMETRY — where the hinge is, how far the
// wing swings — and the caller may own its RHYTHM, which is the same split
// §12.5.1b makes for springs: a named curve fixes shape, not duration. The
// hero pose needs it: a held bee flicks twice and rests, and a bee that
// buzzes continuously at 148pt reads like a loading spinner rather than a
// character. `flutter` is the built-in loop for everything that is in transit.
export const MascotBee = ({ size = 44, flutter = false, beat: driven, wingStyle }) => {
  const own = useRef(new Animated.Value(0)).current;
  const beat = driven ?? own;

  useEffect(() => {
    if (!flutter || driven) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(own, { toValue: 1, duration: WING_BEAT_MS, useNativeDriver: true }),
        Animated.timing(own, { toValue: 0, duration: WING_BEAT_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flutter, driven, own]);

  const width = size * MASCOT_WIDTH_FRACTION;
  const height = width / MASCOT_ASPECT;

  // The wing pivots at its root, which is at (0.427, 0.505) of the character
  // box and so *not* at the view's centre — RN rotates about the centre, so
  // the pivot is composed by hand. R81's transform-order fact decides the
  // order: RN folds the array left to right onto a row vector, so the last
  // entry is applied first. Reading right to left this is
  // `translate(−offset) → rotate → translate(+offset)`, i.e. rotation about
  // the root. `transformOrigin` would express the same thing in one line;
  // this way carries no assumption about how it is plumbed on either platform.
  const offsetX = (HINGE.x - 0.5) * width;
  const offsetY = (HINGE.y - 0.5) * height;
  const beatStyle = flutter || driven
    ? {
        transform: [
          { translateX: offsetX },
          { translateY: offsetY },
          {
            rotate: beat.interpolate({
              inputRange: [0, 1],
              outputRange: [`-${WING_BEAT_DEG / 2}deg`, `${WING_BEAT_DEG / 2}deg`],
            }),
          },
          { translateX: -offsetX },
          { translateY: -offsetY },
        ],
      }
    : null;

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width, height }}>
        {/* Wings first: they are behind the body in the render, and that is
            the whole reason the split is lossless. */}
        <Animated.View style={[StyleSheet.absoluteFill, beatStyle, wingStyle]}>
          <Image source={WING} style={{ width, height }} resizeMode="contain" />
        </Animated.View>
        <Image source={BODY} style={{ width, height }} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
};
