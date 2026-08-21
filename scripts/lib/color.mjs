// Colour maths for the token gates. Two instruments, and they are not
// interchangeable — §20.7: ΔE00 for ground-on-ground, WCAG contrast for
// ink-on-ground.
//
// WCAG contrast models the legibility of TEXT against a field. Handed two
// backgrounds it answers a question nobody asked: #FFF7CC vs #FFFBEB is
// 1.06:1, which sounds catastrophic and means nothing, because neither is
// text. Perceptual separation between two grounds is ΔE00's job.
//
// CIEDE2000 is transcribed from Sharma, Wu & Dalal (2005). It is easy to get
// subtly wrong — the hue-mean branch and the RT rotation term especially — so
// `check-color-grounds.mjs` calibrates this implementation against the three
// ΔE00 figures theme.js has asserted in prose since §29.2, computed by a
// different author with different code, before it trusts any number it
// produces. An uncalibrated instrument's reds are not evidence.

const hex2rgb = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

const linearize = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(linearize);
  return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
};

// WCAG 2.x contrast ratio. For TEXT on a ground only.
export const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// CIE L*a*b*, D65, 2-degree observer.
export const lab = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(linearize);
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  const d = 6 / 29;
  const f = (t) => (t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29);
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.0);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

// Hue angle in degrees — used to keep a colour ladder on one hue.
export const hueAngle = (hex) => {
  const [, a, b] = lab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

export const lightness = (hex) => lab(hex)[0];

// CIEDE2000. kL = kC = kH = 1 (graphic-arts default).
export const deltaE00 = (hex1, hex2) => {
  const [L1, a1, b1] = lab(hex1);
  const [L2, a2, b2] = lab(hex2);
  const rad = Math.PI / 180;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));

  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);

  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0;
    const h = (Math.atan2(b, ap) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);

  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;

  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * rad) / 2);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;

  // The branch that is most often transcribed wrong: when the two hues
  // straddle 0/360, the arithmetic mean is 180 degrees away from the truth.
  let hbp;
  if (Cp1 * Cp2 === 0) {
    hbp = hp1 + hp2;
  } else {
    const sum = hp1 + hp2;
    hbp = Math.abs(hp1 - hp2) <= 180 ? sum / 2 : sum < 360 ? (sum + 360) / 2 : (sum - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.20 * Math.cos((4 * hbp - 63) * rad);

  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;

  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
};

// `rgba(r, g, b, a)` / `rgb(r, g, b)` -> `#RRGGBB`, dropping alpha. Used to
// reason about a token's hue when it is authored with transparency.
export const rgbaToHex = (value) => {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!m) return null;
  return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
};
