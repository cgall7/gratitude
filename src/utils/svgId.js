import { useRef } from 'react';

// Stable, unique id for an SVG `<Defs>` entry (gradient, pattern, clip path).
//
// Two instances of the same component on one screen must not share a
// `<Defs>` id — whether react-native-svg scopes ids per `<Svg>` root is
// version-dependent and not worth betting a rendering bug on, so every
// definition gets its own name. One counter, one idiom, everywhere we put
// something in `<Defs>`.
let sequence = 0;

export const useSvgId = (prefix) => useRef(`${prefix}${(sequence += 1)}`).current;
