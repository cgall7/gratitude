// Colour measurement, one implementation.
//
// theme.js quotes ΔE00 figures in four places and no gate could check any of
// them; check-reveal-pacing.mjs row 15 grew its own hex/luminance/ratio/alpha
// helpers inline because there was nowhere to import them from. This module is
// that place. Anything that needs to measure a colour pair imports from here
// rather than growing a second copy — two implementations of CIEDE2000 that
// disagree in the third decimal is a worse problem than having none.
//
// WHICH METRIC. §20.7's rule, and it is not a preference:
//   - ink-on-ground (text, icons, a fill on a track) -> `contrastRatio`. WCAG
//     is luminance-only, which is the right question for legibility.
//   - ground-on-ground (a cover against a page, two washes meeting) -> `deltaE00`.
//     Sunbeam is one hue, so two grounds can sit 1.05:1 apart in luminance and
//     be plainly different colours, or sit far apart in ratio and still be the
//     same wash. Contrast ratio answers the wrong question for a ground pair.
//
// ALPHA IS NOT A COLOUR. `contrastRatio` throws on a translucent input rather
// than guessing a ground, because "ink at 40%" has no contrast until you say
// what it is over. Composite first with `over`, then measure.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Accepts '#RGB', '#RRGGBB', '#RRGGBBAA', 'rgb(r,g,b)', 'rgba(r,g,b,a)'.
// Whitespace inside the functional forms is free-form on purpose: the shipped
// source carries both `rgba(34, 27, 3, 0.5)` and `rgba(255,255,255,0.4)`, and a
// parser keyed on one spacing convention silently sees half the codebase.
export const parseColor = (input) => {
  if (Array.isArray(input)) {
    const [r, g, b, a = 1] = input;
    return { r, g, b, a };
  }
  if (input && typeof input === 'object' && 'r' in input) {
    return { r: input.r, g: input.g, b: input.b, a: input.a ?? 1 };
  }
  const s = String(input).trim();

  const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    const p = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: p(0), g: p(2), b: p(4), a: h.length === 8 ? p(6) / 255 : 1 };
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(s);
  if (fn) {
    const parts = fn[1].split(',').map((x) => Number(x.trim()));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) {
      throw new Error(`unparseable colour: ${s}`);
    }
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  throw new Error(`unparseable colour: ${s}`);
};

// Source-over compositing. `bg` must be opaque — a translucent thing over
// another translucent thing has no single answer, and every real call site
// here bottoms out on a page colour.
export const over = (fg, bg) => {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (b.a !== 1) throw new Error(`over(): background must be opaque, got alpha ${b.a}`);
  const a = clamp01(f.a);
  return {
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
    a: 1,
  };
};

const linearize = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color) => {
  const c = parseColor(color);
  if (c.a !== 1) throw new Error('relativeLuminance(): colour must be opaque — composite with over() first');
  return 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
};

// WCAG 2.x. For ink-on-ground only — see the header.
export const contrastRatio = (a, b) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// sRGB -> CIE XYZ (D65) -> CIE L*a*b*.
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

export const rgbToLab = (color) => {
  const c = parseColor(color);
  if (c.a !== 1) throw new Error('rgbToLab(): colour must be opaque — composite with over() first');
  const r = linearize(c.r) * 100;
  const g = linearize(c.g) * 100;
  const b = linearize(c.b) * 100;

  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;

  const eps = (6 / 29) ** 3;
  const kappa = (1 / 3) * (29 / 6) ** 2;
  const f = (t) => (t > eps ? Math.cbrt(t) : kappa * t + 4 / 29);

  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
};

const deg = (rad) => (rad * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

// CIEDE2000. Sharma/Wu/Dalal formulation.
export const deltaE00 = (colorA, colorB, { kL = 1, kC = 1, kH = 1 } = {}) => {
  const lab1 = 'L' in Object(colorA) ? colorA : rgbToLab(colorA);
  const lab2 = 'L' in Object(colorB) ? colorB : rgbToLab(colorB);

  const C1 = Math.hypot(lab1.a, lab1.b);
  const C2 = Math.hypot(lab2.a, lab2.b);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * lab1.a;
  const a2p = (1 + G) * lab2.a;

  const C1p = Math.hypot(a1p, lab1.b);
  const C2p = Math.hypot(a2p, lab2.b);
  const Cbarp = (C1p + C2p) / 2;

  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0;
    const h = deg(Math.atan2(b, ap));
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(lab1.b, a1p);
  const h2p = hp(lab2.b, a2p);

  const dLp = lab2.L - lab1.L;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (lab1.L + lab2.L) / 2;

  let Hbarp;
  if (C1p * C2p === 0) Hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) Hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) Hbarp = (h1p + h2p + 360) / 2;
  else Hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(Hbarp - 30)) +
    0.24 * Math.cos(rad(2 * Hbarp)) +
    0.32 * Math.cos(rad(3 * Hbarp + 6)) -
    0.2 * Math.cos(rad(4 * Hbarp - 63));

  const dTheta = 30 * Math.exp(-(((Hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;

  const tL = dLp / (kL * SL);
  const tC = dCp / (kC * SC);
  const tH = dHp / (kH * SH);

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
};

// Chroma. Opaque-only, same convention as rgbToLab — composite first.
export const chroma = (color) => {
  const lab = 'L' in Object(color) ? color : rgbToLab(color);
  return Math.sqrt(lab.a ** 2 + lab.b ** 2);
};

// theme.js's own three self-reported goldField figures (§29.2), used as the
// calibration fixture. An implementation that cannot reproduce numbers the
// design system already published is not measuring the same thing the design
// system is — and a checker's reds are worth nothing until the checker has
// been run against something known-correct. Exported so any gate that depends
// on this module can assert it before trusting its own output.
export const CALIBRATION = [
  { pair: ['#F0C023', '#FFF7CC'], expected: 21.14, label: 'goldField vs background' },
  { pair: ['#F0C023', '#FFFFFF'], expected: 30.82, label: 'goldField vs surface' },
  { pair: ['#F0C023', '#FFF3C4'], expected: 19.63, label: 'goldField vs washYellow' },
];

export const calibrate = (tolerance = 0.005) =>
  CALIBRATION.map(({ pair, expected, label }) => {
    const actual = deltaE00(pair[0], pair[1]);
    return { label, expected, actual, ok: Math.abs(actual - expected) <= tolerance };
  });
