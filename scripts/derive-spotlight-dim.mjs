// R6 — spotlightDim retune: derivation and verification.
//   node scripts/derive-spotlight-dim.mjs
//
// NOT a gate — `run-checks.mjs` enumerates `scripts/check-*.mjs` and this is
// deliberately not one. It is the REPRODUCTION for a published table, kept in
// the repo for the reason R10's derivation was not: a citation a reviewer
// cannot open is not evidence, it is a claim wearing a path.
// Every input is read out of src/constants/theme.js's own source. Nothing typed twice.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { over, deltaE00, rgbToLab, contrastRatio, parseColor, calibrate } =
  await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'color.mjs')).href);
console.log(`color.mjs self-calibration: ${calibrate() ? 'GREEN' : 'RED'}\n`);

const src = fs.readFileSync(path.join(ROOT, 'src/constants/theme.js'), 'utf8');
const pig = (n) => {
  const m = new RegExp(`\\b${n}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(src);
  if (!m) throw new Error(`pigment ${n} not found`);
  return m[1];
};
const alphaOf = (key) => Number(new RegExp(`\\b${key}:\\s*withAlpha\\([^,]*(?:\\([^)]*\\))?[^,]*,\\s*([0-9.]+)\\)`).exec(src)[1]);

const P = { ink: pig('ink'), inkSoft: pig('inkSoft'), inkVeil: pig('inkVeil'),
            accentDeep: pig('accentDeep'), accentBurst: pig('accentBurst') };
const SURFACE = '#FFFFFF';                       // the cell face — where the dim is painted
const PAGE = pig('background');                       // the page — where the scrim is painted
const A = (hex, a) => { const [r,g,b] = [1,3,5].map((i) => parseInt(hex.slice(i, i+2), 16)); return `rgba(${r}, ${g}, ${b}, ${a})`; };
const mix = (x, y, t) => { const p = (h) => [0,2,4].map((i) => parseInt(h.slice(1+i, 3+i), 16)); const [a,b] = [p(x), p(y)];
  return '#' + [0,1,2].map((i) => Math.round(a[i] + (b[i]-a[i])*t).toString(16).padStart(2,'0')).join('').toUpperCase(); };

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const L = (c) => rgbToLab(c).L;
const C = (c) => { const { a, b } = rgbToLab(c); return Math.hypot(a, b); };
const H = (c) => { const { a, b } = rgbToLab(c); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };

const SHIPPED = A(P.inkVeil, 0.25);
const RULED = mix(P.accentDeep, P.inkVeil, 0.25);
const LIVE_ALPHA = alphaOf('spotlightDim');
const SCRIM_ALPHA = alphaOf('scrim');
const BLOOM = Number(/bloom:\s*\{\s*shadowOpacity:\s*([0-9.]+)/.exec(src)[1]);
const LIT = over(A(P.accentBurst, BLOOM), SURFACE);   // punch-out keeps the tapped cell undimmed

// 1. Solve the alpha of the ruled pigment that HOLDS the shipped room L* on the cell ground.
const target = L(over(SHIPPED, SURFACE));
let lo = 0, hi = 1;
for (let i = 0; i < 80; i += 1) { const m = (lo + hi) / 2; (L(over(A(RULED, m), SURFACE)) > target) ? (lo = m) : (hi = m); }
const solved = (lo + hi) / 2;
console.log(`mix(accentDeep, inkVeil, 0.25)                  = ${RULED}`);
console.log(`shipped room L* on a cell (inkVeil@0.25)        = ${target.toFixed(2)}`);
console.log(`alpha of ${RULED} holding that L*            = ${solved.toFixed(4)}  -> ${solved.toFixed(2)}`);
console.log(`theme.js LIVE spotlightDim alpha                = ${LIVE_ALPHA}`);
console.log(`scrim alpha ${SCRIM_ALPHA}, glow bloom opacity ${BLOOM}, lit cell ${hex(LIT)} L* ${L(LIT).toFixed(2)}\n`);

// 2. Candidates, measured on the ground each number is actually about.
const scrimPage = over(A(P.inkVeil, SCRIM_ALPHA), PAGE);
const rows = [
  ['inkVeil  @0.25  SHIPPED', A(P.inkVeil, 0.25)],
  [`${RULED} @0.28  spec text`, A(RULED, 0.28)],
  [`${RULED} @${LIVE_ALPHA}  theme.js LIVE`, A(RULED, LIVE_ALPHA)],
];
console.log('candidate                        room(cell)  L*     dL*spot    C*      h    dE00 vs scrim   ink   inkSoft');
for (const [label, css] of rows) {
  const r = over(css, SURFACE);                 // room = dim on a CELL
  const onPage = over(css, PAGE);               // modal-confusion test happens on the PAGE
  console.log(
    `${label.padEnd(30)} ${hex(r)}  ${L(r).toFixed(2).padStart(5)} ${(L(LIT)-L(r)).toFixed(2).padStart(8)} ` +
    `${C(r).toFixed(2).padStart(6)} ${H(r).toFixed(0).padStart(5)} ${deltaE00(onPage, scrimPage).toFixed(2).padStart(13)} ` +
    `${contrastRatio(P.ink, r).toFixed(2).padStart(7)} ${contrastRatio(P.inkSoft, r).toFixed(2).padStart(7)}`
  );
}

// 3. The page-ground spotlight — the figure Sage's gate and theme.js's glow()
//    comment both publish. R6 moves the ground; this is what moves with it.
console.log('\npage ground (#FFF7CC), spotlight(accentBurst @ bloom) - room:');
const litPage = over(A(P.accentBurst, BLOOM), PAGE);
for (const [label, css] of rows) {
  console.log(`  ${label.padEnd(30)} ${(L(litPage) - L(over(css, PAGE))).toFixed(2)}`);
}
