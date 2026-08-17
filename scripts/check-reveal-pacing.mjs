// Gate for the reveal sequencer's pacing (Sunbeam §32, `src/components/revealSequencer.js`).
//
//   npm run check:reveal-pacing
//
// WHY THIS EXISTS
//
// The acceptance bar for the reveal is a sentence, not a screenshot: *"if a
// tester screenshots it or cries, it passes; if they scroll it like a feed, it
// fails, whatever it looks like."* Every clause of that is about PACING, and
// pacing is the one property a design review cannot see — a still frame of a
// reveal that can be rapid-tapped in seven seconds is indistinguishable from a
// still frame of one that cannot. `PollinateWrapped.js` is the proof: it has
// looked correct in every screenshot anyone has taken of it while shipping a
// whole-screen `onPress` with no floor at all.
//
// So the floor gets a gate, and the gate SAMPLES THE FUNCTION rather than
// checking that a constant exists (R81). A sequencer is a generator of
// sessions; four sampled points cannot pin one, and the module is importable,
// so the rows below sweep its domain — every word count from 0 to 200, every
// tap offset around each floor boundary, and a full adversarial session
// against a sequence built out of the app's own corpus.
//
// R118 IS THE ROW THAT MATTERS MOST HERE, and it is a correction to my own
// earlier ruling. The engine used to derive its floor from the bloom duration
// alone ("the floor IS the arrival, and nothing longer"). Composed with the
// choreography spec's §2 — "the entry becomes readable AT THE END of the
// bloom" — that floor unlocked the tap at the instant the words first became
// legible and bought zero reading time. Section B row 4 is that defect written
// as an assertion: it goes red on the engine as it stood this morning, and it
// is the only row here that would have.
//
// WHAT THIS GATE CANNOT SEE, said plainly (§0: an absence claim inherits the
// scope of the probe that produced it). It cannot see the bloom, the rail's
// pixels, the haptic, or whether anybody cried. It asserts that the machine
// behind those refuses to be skimmed. The rail's COLOUR is checked in section
// D, but only as token arithmetic — no frame has been rendered.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = path.join(ROOT, 'src/components/revealSequencer.js');
const SEED_MODULE = path.join(ROOT, 'src/utils/demoSeed.js');
const PROMPTS_MODULE = path.join(ROOT, 'src/constants/prompts.js');
const THEME_MODULE = path.join(ROOT, 'src/constants/theme.js');
const SRC = path.join(ROOT, 'src');

let pass = 0;
let fail = 0;
let pending = 0;
const failures = [];
const pendingRows = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok      ${label}`);
};
const bad = (label, detail) => {
  fail += 1;
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL    ${label} — ${detail}`);
};
const pend = (label, detail) => {
  pending += 1;
  pendingRows.push(`${label} — ${detail}`);
  console.log(`  PENDING ${label} — ${detail}`);
};

const parseJs = (src) => parse(src, { sourceType: 'module', plugins: ['jsx'] });
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key.endsWith('Comments')) continue;
    walk(node[key], visit);
  }
};
const jsFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const moduleSource = await readFile(MODULE, 'utf8');
const moduleAst = parseJs(moduleSource);

// ===========================================================================
console.log('\nA. the module is sampleable at all');
// ===========================================================================
//
// This row is load-bearing for every row after it. The import below is a
// base64 `data:` URL — the only way to `import` a `.js` file in a package that
// is not `type: module` — and a `data:` URL has no base to resolve against, so
// a relative specifier fails there too (ERR_UNSUPPORTED_RESOLVE_REQUEST). The
// moment this module imports React, the theme or `motion.js`, sections B and C
// cannot run and the likely repair is to make them string-match the source,
// which is exactly the degradation the dependency-free rule prevents.
{
  const imports = moduleAst.program.body.filter(
    (n) => n.type === 'ImportDeclaration' || (n.type === 'ExportNamedDeclaration' && n.source),
  );
  if (imports.length === 0) {
    ok('revealSequencer.js declares no imports, so this gate can load and sample it');
  } else {
    bad(
      'revealSequencer.js declares no imports, so this gate can load and sample it',
      `found ${imports.length}: ${imports.map((n) => n.source.value).join(', ')}. Sections B and C ` +
        'import and sample this module; one dependency and they degrade to string-matching.',
    );
  }
}

const seq = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const {
  STUB_GRAMMAR: G,
  buildRevealSequence,
  startReveal,
  readMs,
  dwellMs,
  arrivalMs,
  canAdvance,
  dwellProgress,
  arrivalProgress,
  tapReveal,
} = seq;

// A step, as `buildRevealSequence` would produce it. Built through the real
// builder rather than hand-written, so a change to the step shape reaches
// these rows instead of sliding past them.
const stepOf = (words) =>
  buildRevealSequence([
    { id: 'w', date: '2026-03-12', text: Array.from({ length: words }).fill('word').join(' ') },
  ])[0];

// ===========================================================================
console.log('\nB. the floor, swept over its whole domain');
// ===========================================================================

// 1. Monotone in length. Catches the two ways a per-step floor degrades back
//    into a constant: a literal, and a latch that saturates early.
{
  const lo = Math.ceil((G.readFloorMs * G.readWpm) / 60000);
  const hi = Math.floor((G.readCapMs * G.readWpm) / 60000);
  const bad_ = [];
  for (let w = lo; w < hi; w += 1) {
    if (!(dwellMs(G, stepOf(w + 1)) > dwellMs(G, stepOf(w)))) bad_.push(w);
  }
  if (bad_.length === 0) {
    ok(`dwellMs is strictly increasing in word count across the unsaturated range (${lo}..${hi} words)`);
  } else {
    bad(
      `dwellMs is strictly increasing in word count across the unsaturated range (${lo}..${hi} words)`,
      `flat or decreasing at ${bad_.length} word counts, first at ${bad_[0]}. A per-step floor that ` +
        'does not move with the step is a constant wearing a function signature.',
    );
  }
}

// 2. Both bounds are REACHED. A bound nothing saturates is not a bound; it is
//    a number in a table that no input has ever tested.
{
  const floorHit = readMs(stepOf(0), G) === G.readFloorMs;
  const capHit = readMs(stepOf(10000), G) === G.readCapMs;
  if (floorHit && capHit) {
    ok(`readMs saturates at both bounds (floor ${G.readFloorMs}ms at 0 words, cap ${G.readCapMs}ms at 10000)`);
  } else {
    bad(
      'readMs saturates at both bounds',
      `floor reached: ${floorHit}, cap reached: ${capHit}. An unreachable bound is untested arithmetic.`,
    );
  }
}

// 3. THE R118 ROW. The floor must outlive the arrival by at least the read
//    floor, at every length — that is the whole content of the amendment, and
//    the pre-amendment engine (`dwellMs = () => grammar.paceMs`, with the same
//    number serving as the bloom) fails it at every sample.
{
  const arrival = arrivalMs(G, false);
  const worst = [];
  for (let w = 0; w <= 200; w += 1) {
    const slack = dwellMs(G, stepOf(w)) - arrival;
    if (slack < G.readFloorMs) worst.push({ w, slack });
  }
  if (worst.length === 0) {
    ok(
      `the floor buys reading time at every length: dwellMs - arrival >= readFloorMs ` +
        `(${G.readFloorMs}ms) across 0..200 words`,
    );
  } else {
    bad(
      'the floor buys reading time at every length: dwellMs - arrival >= readFloorMs',
      `${worst.length} lengths leave less, worst ${worst[0].slack}ms at ${worst[0].w} words. The entry ` +
        'is only readable when the bloom ends (choreography §2), so a floor that does not exceed the ' +
        'arrival unlocks the tap at the instant the words first become legible.',
    );
  }
}

// 4. Ruling 3, structurally: Reduce Motion may not reach the floor. Asserted
//    on the AST rather than by sampling, because the failure it guards is a
//    future edit threading `reduced` through — and a sampled row cannot see a
//    parameter that has not been added yet.
{
  const fnRange = (name) => {
    let found = null;
    walk(moduleAst.program, (n) => {
      if (n.type === 'VariableDeclarator' && n.id?.name === name && n.init) {
        found = [n.init.start, n.init.end];
      }
    });
    return found;
  };
  const dwellRange = fnRange('dwellMs');
  const readRange = fnRange('readMs');
  const arrivalRange = fnRange('arrivalMs');
  if (!dwellRange || !readRange || !arrivalRange) {
    bad('reducedFadeMs is referenced only by arrivalMs', 'could not locate all three declarators');
  } else {
    // The DECLARATION is not a reference. `STUB_GRAMMAR`'s own
    // `reducedFadeMs: 200` key is an Identifier named `reducedFadeMs` sitting
    // outside `arrivalMs`, and counting it turns this row into a false red
    // that fires on the correct engine — caught by running the gate rather
    // than by reading it. A non-computed MemberExpression property
    // (`grammar.reducedFadeMs`) is emphatically NOT excluded: that is the
    // exact node this row exists to find.
    const declKeys = new Set();
    walk(moduleAst.program, (n) => {
      if ((n.type === 'ObjectProperty' || n.type === 'ObjectMethod') && !n.computed && n.key) {
        declKeys.add(n.key.start);
      }
    });
    const hits = [];
    walk(moduleAst.program, (n) => {
      if (n.type !== 'Identifier' || n.name !== 'reducedFadeMs') return;
      if (declKeys.has(n.start)) return;
      const inArrival = n.start >= arrivalRange[0] && n.end <= arrivalRange[1];
      if (!inArrival) hits.push(n.start);
      if (
        (n.start >= dwellRange[0] && n.end <= dwellRange[1]) ||
        (n.start >= readRange[0] && n.end <= readRange[1])
      ) {
        hits.push(n.start);
      }
    });
    // The same structural claim from the other side: dwellMs must compose the
    // full bloom, not the resolved arrival.
    const callsArrival = [];
    walk(moduleAst.program, (n) => {
      if (
        n.type === 'CallExpression' &&
        n.callee?.name === 'arrivalMs' &&
        n.start >= dwellRange[0] &&
        n.end <= dwellRange[1]
      ) {
        callsArrival.push(n.start);
      }
    });
    if (hits.length === 0 && callsArrival.length === 0) {
      ok('the floor cannot see the register: reducedFadeMs is confined to arrivalMs, and dwellMs does not call it');
    } else {
      bad(
        'the floor cannot see the register: reducedFadeMs is confined to arrivalMs, and dwellMs does not call it',
        `reducedFadeMs outside arrivalMs at ${hits.length} site(s); dwellMs calls arrivalMs at ` +
          `${callsArrival.length}. Reduce Motion substitutes the arrival, never the pace — routing the ` +
          'floor through the resolved arrival lets RM shorten it through the back door.',
      );
    }
  }
}

// 5. The bounds bracket the corpus this app actually produces, so neither is
//    silently binding on ordinary content. Re-derived from the two source
//    files every run: add a 90-word sample line and this row goes red rather
//    than the cap quietly starting to truncate real entries.
{
  const strings = (src) => {
    const out = [];
    walk(parseJs(src).program, (n) => {
      if (n.type === 'StringLiteral') out.push(n.value);
    });
    return out;
  };
  const seedLines = strings(await readFile(SEED_MODULE, 'utf8')).filter((s) => s.startsWith('I am grateful'));
  const sparks = strings(await readFile(PROMPTS_MODULE, 'utf8'))
    .filter((s) => /^[a-z]/.test(s) && s.length > 3 && !s.includes('.'))
    .map((s) => `I am grateful for ${s}.`);
  const corpus = [...seedLines, ...sparks];
  const counts = corpus.map((s) => s.trim().split(/\s+/).length).sort((a, b) => a - b);
  const [min, max] = [counts[0], counts[counts.length - 1]];
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const raw = (w) => w * (60000 / G.readWpm);
  if (corpus.length < 50) {
    bad('the read bounds bracket the app corpus', `only found ${corpus.length} corpus lines; the extractor has drifted`);
  } else if (raw(min) >= G.readFloorMs && raw(max) <= G.readCapMs) {
    ok(
      `the read bounds bracket the app corpus: ${corpus.length} lines, ${min}..${max} words ` +
        `(mean ${mean.toFixed(1)}) => ${raw(min).toFixed(0)}..${raw(max).toFixed(0)}ms, inside ` +
        `[${G.readFloorMs}, ${G.readCapMs}]`,
    );
  } else {
    bad(
      'the read bounds bracket the app corpus',
      `${min}..${max} words => ${raw(min).toFixed(0)}..${raw(max).toFixed(0)}ms against bounds ` +
        `[${G.readFloorMs}, ${G.readCapMs}]. A bound that clips ordinary entries is no longer a guard ` +
        'on the pathological case; it is the pace.',
    );
  }
  // Reported, not asserted: the figure the amendment was argued from.
  console.log(
    `          (corpus mean ${mean.toFixed(1)} words = ${raw(mean).toFixed(0)}ms read at ${G.readWpm} wpm; ` +
      `floor for a mean entry ${dwellMs(G, stepOf(Math.round(mean)))}ms)`,
  );
}

// ===========================================================================
console.log('\nC. the machine, swept as a session');
// ===========================================================================

const corpusSequence = (n) =>
  buildRevealSequence(
    Array.from({ length: n }).map((_, i) => ({
      id: `e${i}`,
      date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      savedAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      text: Array.from({ length: 6 + (i % 8) }).fill('word').join(' '),
    })),
  );

// 6. An early tap is dropped by REFERENTIAL IDENTITY, swept across the whole
//    pre-floor interval. Identity rather than field equality: there is nowhere
//    for a queued tap to accumulate because there is no new object.
{
  const sequence = corpusSequence(12);
  const s0 = startReveal(0);
  const floor = dwellMs(G, sequence[0]);
  const leaks = [];
  for (let t = 0; t < floor; t += 13) {
    if (tapReveal(s0, t, sequence, G) !== s0) leaks.push(t);
  }
  if (leaks.length === 0) {
    ok(`every tap before the floor returns the identical state object (${Math.ceil(floor / 13)} offsets, 0..${floor}ms)`);
  } else {
    bad(
      'every tap before the floor returns the identical state object',
      `advanced or allocated at ${leaks.length} offsets, first ${leaks[0]}ms of a ${floor}ms floor.`,
    );
  }
}

// 7. And it does advance at the boundary. Without this the row above passes on
//    a machine that never advances at all.
{
  const sequence = corpusSequence(12);
  const s0 = startReveal(0);
  const floor = dwellMs(G, sequence[0]);
  const atFloor = tapReveal(s0, floor, sequence, G);
  const justBefore = tapReveal(s0, floor - 1, sequence, G);
  if (atFloor.index === 1 && justBefore === s0) {
    ok(`the tap advances exactly at the floor (${floor}ms) and not 1ms before it`);
  } else {
    bad(
      'the tap advances exactly at the floor and not 1ms before it',
      `at ${floor}ms index=${atFloor.index}; at ${floor - 1}ms advanced=${justBefore !== s0}.`,
    );
  }
}

// 8. THE SKIM ROW. The acceptance criterion as a number: an adversarial
//    rapid-tapper, one tap every 16ms (a 60fps finger, faster than any human),
//    cannot walk a 47-entry hive faster than the sum of its own floors.
{
  const sequence = corpusSequence(47);
  const floors = sequence.map((s) => dwellMs(G, s));
  const total = floors.reduce((a, b) => a + b, 0);
  let state = startReveal(0);
  let t = 0;
  let taps = 0;
  while (!state.done && t < 10 * 60 * 1000) {
    t += 16;
    taps += 1;
    state = tapReveal(state, t, sequence, G);
  }
  if (state.done && t >= total) {
    ok(
      `a 16ms-cadence rapid-tapper needs ${(t / 1000).toFixed(1)}s and ${taps} taps to reach the end of a ` +
        `47-entry hive (sum of floors ${(total / 1000).toFixed(1)}s)`,
    );
  } else {
    bad(
      'a rapid-tapper cannot beat the sum of the floors on a 47-entry hive',
      `finished=${state.done} at ${(t / 1000).toFixed(1)}s against a floor sum of ${(total / 1000).toFixed(1)}s.`,
    );
  }
}

// 9. No queue, stated separately from row 6 because it is the property row 6
//    exists to protect: pre-tapping during entry 1 must not spend taps on 2..6.
{
  const sequence = corpusSequence(12);
  let state = startReveal(0);
  for (let i = 0; i < 40; i += 1) state = tapReveal(state, 5, sequence, G);
  const after = tapReveal(state, dwellMs(G, sequence[0]), sequence, G);
  if (after.index === 1) {
    ok('40 pre-taps during entry 1 then one legal tap advances exactly one step');
  } else {
    bad('40 pre-taps during entry 1 then one legal tap advances exactly one step', `landed on index ${after.index}.`);
  }
}

// 10. The ending is an ending. `PollinateWrapped.js` wraps to slide 0 when its
//     call site passes no `onComplete`; a reveal that loops has no ending to
//     spend, and the ruling's "finishing a letter" is the whole beat.
{
  const sequence = corpusSequence(4);
  let state = startReveal(0);
  let t = 0;
  for (let i = 0; i < 4; i += 1) {
    t += dwellMs(G, sequence[state.index]);
    state = tapReveal(state, t, sequence, G);
  }
  const beyond = tapReveal(state, t + 100000, sequence, G);
  if (state.done && state.index === 3 && beyond === state) {
    ok('the last memory stays on screen, done goes true, and further taps are inert (no wrap-around)');
  } else {
    bad(
      'the last memory stays on screen, done goes true, and further taps are inert (no wrap-around)',
      `done=${state.done} index=${state.index} (expected 3); a further tap ${beyond === state ? 'was inert' : `moved to ${beyond.index}`}.`,
    );
  }
}

// 11. Ruling 6: an undated step is a defect, not a degraded render. Swept over
//     the shapes a missing date actually arrives in, including the one
//     `new Date()` would have accepted.
{
  const cases = [undefined, null, '', 'March 12', '2026-2-3', '2026-02-31', '2026-13-01'];
  const leaked = cases.filter((date) => {
    try {
      buildRevealSequence([{ id: 'x', date, text: 'a' }]);
      return true;
    } catch {
      return false;
    }
  });
  if (leaked.length === 0) {
    ok(`buildRevealSequence refuses all ${cases.length} undated/invalid date shapes, including 2026-02-31`);
  } else {
    bad(
      'buildRevealSequence refuses every undated or invalid date shape',
      `accepted ${JSON.stringify(leaked)}. new Date('2026-02-31') rolls forward to March 3, which is how ` +
        'an impossible date reaches a screen looking plausible.',
    );
  }
}

// 12. Order is total and stable. The author's phone and the recipient's must
//     reveal the same hive in the same order, and a hive may hold several
//     entries on one date (`entries_one_journal_per_day` is scoped
//     `where hive_id is null`).
{
  const rows = [
    { id: 'c', date: '2026-03-12', savedAt: '2026-03-12T09:00:00Z', text: 'c' },
    { id: 'a', date: '2026-01-04', savedAt: '2026-01-04T09:00:00Z', text: 'a' },
    { id: 'b2', date: '2026-03-12', savedAt: '2026-03-12T08:00:00Z', text: 'b' },
    { id: 'd', date: '2026-03-12', savedAt: '2026-03-12T09:00:00Z', text: 'd' },
  ];
  const key = (s) => s.map((x) => x.id).join(',');
  const base = key(buildRevealSequence(rows));
  const shuffles = [];
  for (let i = 0; i < 50; i += 1) {
    const copy = rows.slice().sort(() => Math.random() - 0.5);
    shuffles.push(key(buildRevealSequence(copy)));
  }
  const stable = shuffles.every((s) => s === base);
  const chronological = base.startsWith('a,');
  if (stable && chronological) {
    ok(`the order is total and input-independent across 50 shuffles (${base}), oldest first, ties broken by savedAt then id`);
  } else {
    bad(
      'the order is total and input-independent, oldest first',
      `stable=${stable} chronological=${chronological}; got ${base}, ${new Set(shuffles).size} distinct orders.`,
    );
  }
}

// ===========================================================================
console.log('\nD. the rail, and what this gate cannot reach');
// ===========================================================================

// 13. The rail is the DWELL, not the position. Asserted as an absence over the
//     module's whole export surface — an index fraction is the thing a call
//     site would reach for to build the 47-segment version the choreography
//     spec's §6 also describes, and the engine declining to publish one is
//     what makes the ruling enforceable rather than merely written down.
{
  const exported = Object.keys(seq).sort();
  const positional = exported.filter((n) => /position|index(Progress|Fraction)|remaining|percent/i.test(n));
  if (positional.length === 0 && exported.includes('dwellProgress')) {
    ok(`the module exports dwellProgress and no position fraction (${exported.length} exports: ${exported.join(', ')})`);
  } else {
    bad(
      'the module exports dwellProgress and no position fraction',
      `found ${JSON.stringify(positional)}. §6 describes the rail twice — 47 segments (position) and ` +
        '"resets to 0% on the next tap" (dwell) — and only the dwell answers the refused tap.',
    );
  }
}

// 14. `dwellProgress` actually spans 0..1 over the floor, and reaches 1 at the
//     same instant the tap unlocks. A rail that finishes early or late is
//     lying about when the button works, which is the one thing it is for.
{
  const sequence = corpusSequence(9);
  const s0 = startReveal(0);
  const floor = dwellMs(G, sequence[0]);
  const at0 = dwellProgress(s0, 0, sequence, G);
  const atFloor = dwellProgress(s0, floor, sequence, G);
  const mismatches = [];
  for (let t = 0; t <= floor; t += 17) {
    const full = dwellProgress(s0, t, sequence, G) >= 1;
    if (full !== canAdvance(s0, t, sequence, G)) mismatches.push(t);
  }
  if (at0 === 0 && atFloor === 1 && mismatches.length === 0) {
    ok(`dwellProgress runs 0 -> 1 over the floor and reaches 1 exactly when canAdvance flips (${floor}ms, 0 mismatches)`);
  } else {
    bad(
      'dwellProgress runs 0 -> 1 over the floor and reaches 1 exactly when canAdvance flips',
      `at 0: ${at0}, at floor: ${atFloor}, ${mismatches.length} offsets where the rail and the gate disagree.`,
    );
  }
}

// 15. The rail's colour pair, as token arithmetic. §23.11 ruled this exact
//     component — a progress track on `background` — and the pair it ratified
//     is `ink` on `ink@0.5`. This row is a tripwire on the tokens, not on a
//     frame: if `ink` or `background` is retuned, the rail ruling gets
//     re-derived instead of inherited.
{
  const themeSrc = await readFile(THEME_MODULE, 'utf8');
  const tok = (name) => {
    const m = new RegExp(`\\b${name}: '(#[0-9A-Fa-f]{6})'`).exec(themeSrc);
    return m ? m[1] : null;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const L = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
  const ink = tok('ink');
  const background = tok('background');
  const accent = tok('accent');
  if (!ink || !background || !accent) {
    bad('the rail pair clears §23.11', `could not read tokens from theme.js (ink=${ink} background=${background})`);
  } else {
    const TRACK_ALPHA = 0.5;
    const track = over(hex(ink), TRACK_ALPHA, hex(background));
    const trackVsGround = ratio(track, hex(background));
    const fillVsTrack = ratio(hex(ink), track);
    const accentVsTrack = ratio(hex(accent), track);
    if (trackVsGround >= 3 && fillVsTrack >= 3) {
      ok(
        `the ruled rail pair clears: ink@${TRACK_ALPHA} track vs background ${trackVsGround.toFixed(4)}:1, ` +
          `ink fill vs track ${fillVsTrack.toFixed(4)}:1 (accent as the fill would be ${accentVsTrack.toFixed(4)}:1 — ` +
          'why the fill is ink)',
      );
    } else {
      bad(
        'the ruled rail pair clears §23.11',
        `track vs ground ${trackVsGround.toFixed(4)}:1, fill vs track ${fillVsTrack.toFixed(4)}:1 — one is under 3:1. ` +
          'A progress indicator is a fraction; without a visible denominator it is a different component.',
      );
    }
  }
}

// 16. The engine half has no importer yet, and that is the plan rather than a
//     defect — reported as PENDING so it is counted in neither tally. This row
//     is also the falsifier in the module header made executable: once 8b.4 or
//     8b.6 mounts a reveal, an importer must appear here or the module is
//     dead and should be deleted rather than maintained.
{
  const files = (await jsFiles(SRC)).filter((f) => f !== MODULE);
  files.push(path.join(ROOT, 'App.js'));
  const importers = [];
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    if (/from\s+['"][^'"]*revealSequencer['"]/.test(src)) importers.push(path.relative(ROOT, f));
  }
  if (importers.length === 0) {
    pend(
      'revealSequencer has a call site',
      'no importer in src/ or App.js. Expected while the engine half lands ahead of 8b.4 (Memory Lane) ' +
        'and 8b.6 (package-open) — but if Project 8b has shipped a reveal that does not import this ' +
        'module, this module is dead.',
    );
  } else {
    ok(`revealSequencer is imported by ${importers.join(', ')}`);
  }
}

// `N passed, M failed` verbatim, and the wording is not cosmetic:
// `run-checks.mjs:204` recovers this gate's assertion count with
// `/(\d+) passed, (\d+) failed/`, and its rule 3 treats a gate that exits 0
// having asserted nothing as RED. The first draft of this line printed
// "16 passed, 1 pending" — the regex found nothing, and 16 real assertions
// were reported to the suite as an empty universe. `check-daily-nudge.mjs`'s
// footer already carries this warning; reading it after the fact is not the
// same as applying it, so it is restated here where the mistake is made.
console.log(`\n${pass} passed, ${fail} failed (${pending} pending)`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
}
if (pending > 0) {
  console.log('\nPending (not counted as pass or fail — see reason):');
  pendingRows.forEach((p) => console.log(`  - ${p}`));
}
process.exit(fail > 0 ? 1 : 0);
