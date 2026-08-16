// Sunbeam §31 — simulate the idle flight sequencer and report what it does.
//
//   node scripts/simulate-bee-flight.mjs
//
// This is a PROBE, not a gate: it prints a session's behaviour and asserts the
// properties the §31 scope's acceptance test asks for. The durable rows belong
// in `check-bee-attitude` once the choreography lands (R106 — owed).
//
// It exists because "never the same lap twice" and "1 part airborne to 2 parts
// at rest" are properties of a GENERATOR, and the only honest way to assert
// something about a generator is to sweep its seeds. R81: sample the function,
// not the flight.
//
// It loads the modules the way `check-bee-attitude.mjs` does — reading source
// and importing it as a base64 `data:` URL — because that is the only way to
// `import` a `.js` file in a package that is not `type: module`, and because
// the resolution path a probe uses should be the one the gate uses. Note that
// a `data:` module cannot resolve RELATIVE specifiers, which is why
// `flightSequencer.js` takes its plan builders as arguments instead of
// importing them.
//
// One rule this script learned the expensive way, recorded here because it is
// the kind of shortcut that looks free: it used to read
// `MASCOT_WIDTH_FRACTION` out of `mascot.js` with a regex. The constant is
// `16.4 / 24` — an EXPRESSION — so `([\d.]+)` captured `16.4`, a body length
// 24x too large. Every staging point went hundreds of px off-screen and the
// airborne budget failed for a reason that had nothing to do with the design.
// Evaluate the module; never parse a value out of source you can execute.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (rel) => import(
  `data:text/javascript;base64,${Buffer.from(await readFile(`${ROOT}/${rel}`, 'utf8')).toString('base64')}`);

const flight = await load('src/components/pollinationFlight.js');
const seq = await load('src/components/flightSequencer.js');
// Evaluate the module; do NOT regex the constant out of the source. It is
// `16.4 / 24`, an EXPRESSION, and `([\d.]+)` captures `16.4` — a body length
// 24x too large, which pushed every staging point hundreds of px off-screen
// and inflated sortie durations enough to fail the airborne budget. The real
// gate already imports this file; the shortcut was mine.
const mascot = await load('src/constants/mascot.js');
const WIDTH_FRACTION = mascot.MASCOT_WIDTH_FRACTION;

// The two easings FlyingBee already uses, modelled the way the gate models them.
const bezier=(x1,y1,x2,y2)=>{const bx=(s)=>3*(1-s)**2*s*x1+3*(1-s)*s*s*x2+s**3,by=(s)=>3*(1-s)**2*s*y1+3*(1-s)*s*s*y2+s**3;
  return (x)=>{let lo=0,hi=1;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(bx(m)<x)lo=m;else hi=m;}return by((lo+hi)/2);};};
const eb=bezier(0.42,0,1,1);
const inOut=(w)=>(w<0.5?eb(w*2)/2:1-eb((1-w)*2)/2);
const outCubic=(w)=>1-(1-w)**3;

let fails = 0;
const check = (label, pass, detail='') => { console.log(`  ${pass?'  ok':'FAIL'}  ${label}${detail?'  — '+detail:''}`); if(!pass) fails++; };

// ---------------------------------------------------------------- 1
console.log('\n1. composeSegmentEasing subsumes composePhaseEasing (n = 2)');
let worst = 0;
for (const split of [0.05, 0.25, 0.5, 0.734, 0.95]) {
  const a = flight.composePhaseEasing(split, inOut, outCubic);
  const b = flight.composeSegmentEasing([split, 1 - split], [inOut, outCubic]);
  for (let w = 0; w <= 1; w += 0.0005) worst = Math.max(worst, Math.abs(a(w) - b(w)));
}
check('identical across 5 splits x 2001 samples', worst < 1e-12, `max |diff| ${worst.toExponential(2)}`);

console.log('\n2. composeSegmentEasing lands the driven value exactly on i/n');
let wErr = 0;
const durs = [420, 160, 900, 300], eas = [inOut, outCubic, inOut, outCubic];
const E = flight.composeSegmentEasing(durs, eas);
const tot = durs.reduce((a,b)=>a+b,0);
let cum = 0;
for (let i = 0; i < durs.length; i += 1) { cum += durs[i]; wErr = Math.max(wErr, Math.abs(E(cum/tot) - (i+1)/durs.length)); }
check('waypoint boundaries exact (4 segments)', wErr < 1e-9, `max |err| ${wErr.toExponential(2)}`);
let mono = true, prev = -1;
for (let w = 0; w <= 1; w += 0.0002) { const v = E(w); if (v < prev - 1e-12) mono = false; prev = v; }
check('monotone over the domain', mono);

// ---------------------------------------------------------------- 3
console.log('\n3. Sixty seconds of idle, simulated (393x852, size 44)');
const W = 393, H = 852, SIZE = 44, BODY = WIDTH_FRACTION * SIZE;
const G = seq.STUB_GRAMMAR;
const builders = { buildPollinationPlan: flight.buildPollinationPlan, composeSegmentEasing: flight.composeSegmentEasing };
const easings = { dart: inOut, settle: outCubic, hover: inOut };
// Stub anchors — Deezine's storyboard replaces these with real declarations.
const anchors = [
  { key: 'card-tl', x: 40, y: 210 }, { key: 'card-br', x: 330, y: 300 },
  { key: 'fab',     x: 320, y: 700 }, { key: 'header',  x: 90,  y: 120 },
  { key: 'streak',  x: 200, y: 470 },
];

const runSession = (seed, forMs, GG = G) => {
  const rng = seq.makeRng(seed);
  let state = 'perch', recent = [], at = { x: anchors[0].x, y: anchors[0].y }, clock = 0;
  const beats = [];
  while (clock < forMs) {
    const beat = seq.nextBeat({ state, recent, anchors, rng, grammar: GG });
    const plan = seq.resolveBeat({ beat, from: at, width: W, height: H, bodyLengthPx: BODY, grammar: GG, easings, builders, heldFacing: 1 });
    if (!plan) break;
    if (beat.state === 'sortie') { at = { ...plan.landing }; recent = [...recent, beat.anchor.key].slice(-8); }
    beats.push({ state: beat.state, ms: plan.durationMs, key: beat.anchor?.key ?? null, plan });
    clock += plan.durationMs; state = beat.state;
  }
  return beats;
};

const beats = runSession(0xC0FFEE, 60000);
const totalMs = beats.reduce((a, b) => a + b.ms, 0);
const byState = (s) => beats.filter(b => b.state === s).reduce((a, b) => a + b.ms, 0);
const airborne = byState('sortie'), atRest = byState('hover') + byState('perch');
console.log(`   ${beats.length} beats over ${(totalMs/1000).toFixed(1)}s: ` +
  `${beats.filter(b=>b.state==='sortie').length} sorties, ${beats.filter(b=>b.state==='hover').length} hovers, ${beats.filter(b=>b.state==='perch').length} perches`);
check(`airborne fraction <= 40%`, airborne/totalMs <= 0.40,
      `${(airborne/totalMs*100).toFixed(1)}% airborne, ${(atRest/totalMs*100).toFixed(1)}% at rest (ratio 1:${(atRest/airborne).toFixed(2)})`);

// no anchor twice in a row, and no repeated window of 3
const keys = beats.filter(b=>b.key).map(b=>b.key);
let immediate = 0;
for (let i=1;i<keys.length;i++) if (keys[i]===keys[i-1]) immediate++;
check('never the same anchor twice running', immediate === 0, `${keys.length} sorties`);
const wins = new Map(); let dupWin = 0;
for (let i=0;i+3<=keys.length;i++){ const k=keys.slice(i,i+3).join('>'); if(wins.has(k)) dupWin++; wins.set(k,1); }
console.log(`         (3-anchor sequences: ${wins.size} distinct of ${Math.max(0,keys.length-2)}, ${dupWin} repeats — a repeat here is a coincidence, not a period)`);

// the loop it replaces, for contrast
check('no exact beat-sequence period', (() => {
  const sig = beats.map(b => `${b.state}:${Math.round(b.ms/50)}:${b.key??''}`);
  for (let p = 1; p <= Math.floor(sig.length/2); p += 1) {
    let all = true;
    for (let i = 0; i + p < sig.length; i += 1) if (sig[i] !== sig[i+p]) { all = false; break; }
    if (all) return false;
  }
  return true;
})(), 'checked every period up to half the session');

// ---------------------------------------------------------------- 4
console.log('\n4. Speed is banded, and the bands compare like with like');
const dEase=(f,w)=>{const h=1e-6,a=Math.max(0,w-h),b=Math.min(1,w+h);return (f(b)-f(a))/(b-a);};
const speedSamples = [], dartSamples = [], settleSamples = [];
for (const b of beats) {
  const { path, durationMs, easing } = b.plan;
  const n = path.length - 1;
  const segLen = [];
  for (let i=0;i<n;i++) segLen.push(Math.hypot((path[i+1].x-path[i].x)*W,(path[i+1].y-path[i].y)*H));
  for (let ms = 0; ms < durationMs; ms += 1000/240) {
    const w = ms/durationMs, t = easing(w)*n, i = Math.min(n-1, Math.max(0, Math.floor(t)));
    const v = segLen[i]*n*dEase(easing,w)/durationMs*1000;
    speedSamples.push(v);
    // A sortie is dart (segment 0) then the §28.5 settle (segment 1). They are
    // DIFFERENT VERBS and must not be pooled into one "cruise speed" — that is
    // the mean-vs-peak conflation R106 found in §28.5, one layer down.
    if (b.state === 'sortie') (i === 0 ? dartSamples : settleSamples).push(v);
  }
}
const ref = seq.referenceSpeedPxS(W,H);
const bands = [['still (<10% ref)',0,0.1],['hover (10-60%)',0.1,0.6],['dart (60-200%)',0.6,2.0],['settle flourish (>200%)',2.0,Infinity]];
for (const [lab,lo,hi] of bands) {
  const nS = speedSamples.filter(v=>v>=ref*lo&&v<ref*hi).length;
  console.log(`   ${lab.padEnd(24)} ${(nS/speedSamples.length*100).toFixed(1).padStart(5)}%`);
}
const dartPeak = Math.max(...dartSamples), settlePeak = Math.max(...settleSamples);
const approachPeak = ref * 2 * 1.7237;
console.log(`   reference ${ref.toFixed(1)} px/s | dart peak ${dartPeak.toFixed(1)} | settle peak ${settlePeak.toFixed(1)} | §28.5 approach peak ${approachPeak.toFixed(1)}`);
check('dart peak stays below the §28.5 approach PEAK (like for like)',
      dartPeak < approachPeak, `${dartPeak.toFixed(1)} vs ${approachPeak.toFixed(1)} px/s — ratio ${(approachPeak/dartPeak).toFixed(2)}x`);
console.log(`         (the settle peaks at ${settlePeak.toFixed(0)} px/s and always has: Easing.out(cubic) has slope 3 at w=0,`);
console.log(`          so §28.5's 30.07pt-in-160ms gesture is 188 px/s MEAN and ~564 px/s peak. Ratified, unchanged, not travel.)`);

// ---------------------------------------------------------------- 5
console.log('\n4b. What dwell hits the scope\'s 1:2?');
for (const scale of [1.0, 1.3, 1.6, 1.9, 2.2]) {
  const G2 = { ...G, perchMs: G.perchMs.map(v=>v*scale), hoverMs: G.hoverMs.map(v=>v*scale) };
  const bs = runSession(0xC0FFEE, 60000, G2);
  const tot = bs.reduce((a,b)=>a+b.ms,0);
  const air = bs.filter(b=>b.state==='sortie').reduce((a,b)=>a+b.ms,0);
  console.log(`   dwell x${scale.toFixed(1)}  perch ${G2.perchMs.map(v=>Math.round(v)).join('-')}ms  hover ${G2.hoverMs.map(v=>Math.round(v)).join('-')}ms  ->  airborne ${(air/tot*100).toFixed(1)}%  (1:${((tot-air)/air).toFixed(2)})`);
}

console.log('\n5. Two sessions with different seeds do not agree');
const a1 = runSession(1, 30000).map(b=>`${b.state}${b.key??''}`).join(',');
const a2 = runSession(2, 30000).map(b=>`${b.state}${b.key??''}`).join(',');
check('seed 1 != seed 2', a1 !== a2);
check('same seed reproduces exactly', runSession(7, 20000).map(b=>b.ms.toFixed(3)).join() === runSession(7, 20000).map(b=>b.ms.toFixed(3)).join());

console.log(`\n${fails === 0 ? 'all checks passed' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
