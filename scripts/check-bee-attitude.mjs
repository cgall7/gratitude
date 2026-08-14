// Gate for how the mascot is held while it flies (Sunbeam §17.3 / §19.5).
//
//   npm run check:bee-attitude
//
// WHY THIS EXISTS
//
// `FlyingBee` used to rotate the bee to its heading with nothing bounding
// the result. Two of the cruise loop's four segments have headings past
// vertical, and the timing easing is symmetric about its midpoint, so the
// bee flew belly-up for exactly half of every loop — live on the Hive, for
// months. Nobody saw it because the bee had no face on it: upside-down
// reads as a loop-the-loop when there is nothing to be upside-down. Colin's
// "our mascot flying through the app, motions pristine" is what makes it a
// defect, and the mascot has a face.
//
// So the invariant this file holds is: **no render path may fly the mascot
// at an attitude you cannot read it at.**
//
// WHAT IT ASSERTS, AND WHY IN THIS ORDER
//
// The rows come in two groups, and the split is the whole design.
//
//   A. THE FUNCTION. `bankFor` is sampled across its entire domain — every
//      half-degree of pitch from -90 to +90 — not at the four pitches the
//      cruise loop happens to fly. This is the correction Sage and I
//      arrived at the hard way, twice in one evening:
//
//        "a clamp exists"            — tautological, a clamp cannot fail
//        "rotateOutput within ±22"   — PASSES a saturated clamp perfectly.
//                                      Every live cruise pitch exceeds 22,
//                                      so clamp(±22) emits two latching
//                                      values and the row stays green.
//        "±22 holds by construction" — unfalsifiable a third time, because
//                                      the new formula makes it true of
//                                      any input at all.
//
//      Each replacement was a gate that could not fail on the configuration
//      it was written to police. The escape is to stop asking the *tracks*
//      about the *formula*: four sampled points cannot pin a function, and
//      the function is importable, so sample the function. A clamp
//      reintroduced anywhere in the domain shows up as a flat step; a
//      constant, a latch and a sign inversion all die on the same rows.
//
//   B. THE TRACKS. Everything that depends on a real path in a real box:
//      the rendered bank at every interpolation node, the facing rule, the
//      turn's wall-clock length, the loop seam.
//
//      Every row here names the container it was measured in, because that
//      is the error that produced this file. A fractional coordinate is not
//      a position until you name the box, and *the call site names the box*
//      — `loginArc` is flown inside a 220x100 wordmark anchor, not the
//      screen, and both reviewers resolved it against 393x852 and got a
//      figure that was wrong by 2x. Screen-mounted sites are therefore
//      evaluated on four device boxes, not one, so no row can pass by
//      being measured on a convenient phone.
//
//   C. COMPLETENESS. An unlisted `<FlyingBee>` call site is a FAILURE, not
//      a skip. The call sites are enumerated from disk; the containers are
//      declared here with a reason, because "what box is this mounted in"
//      is a question a human has to answer — but a declared box that can be
//      read back from a stylesheet IS read back and compared. That row is
//      the one that would have caught tonight.
//
// WHAT THIS GATE CANNOT DO. It models the easings by name: it recognises
// the two expressions `FlyingBee.js` actually uses and reimplements them.
// A third easing is a FAILURE here, not a silent pass — a gate that cannot
// tell must not look like a gate that has no objection.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_PATH = path.join(ROOT, 'src/components/beeAttitude.js');
const FLYING_BEE = path.join(ROOT, 'src/components/FlyingBee.js');

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
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

// --- the easings this gate can model -------------------------------------
// Keyed by the source expression in FlyingBee.js, so a change there lands
// here as a named failure rather than as silence.
const bezier = (x1, y1, x2, y2) => {
  const bx = (s) => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
  const by = (s) => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
};
const EASINGS = {
  'Easing.inOut(Easing.ease)': (() => {
    const e = bezier(0.42, 0, 1, 1);
    return (t) => (t < 0.5 ? e(t * 2) / 2 : 1 - e((1 - t) * 2) / 2);
  })(),
  'Easing.out(Easing.cubic)': (t) => 1 - (1 - t) ** 3,
};

// --- the containers, declared with a reason ------------------------------
const DEVICES = [
  { label: '320x568 (SE 1st gen)', width: 320, height: 568 },
  { label: '375x667 (SE 2nd/3rd)', width: 375, height: 667 },
  { label: '393x852 (15/16/17)', width: 393, height: 852 },
  { label: '430x932 (Pro Max)', width: 430, height: 932 },
];

const CALL_SITES = [
  {
    file: 'src/screens/TodayTab.js',
    preset: null,
    reason:
      'mounted directly in a flex:1 tab scene; TabDock is an absoluteFill overlay that takes no layout space, so the measured box is the device',
    containers: DEVICES,
  },
  {
    file: 'src/screens/HoneycombTab.js',
    preset: null,
    reason: 'same flex:1 tab scene as TodayTab',
    containers: DEVICES,
  },
  {
    file: 'src/screens/Onboarding.js',
    preset: 'loginArc',
    reason:
      'mounted inside styles.wordmarkArcAnchor, a fixed 220x100 box sized to the wordmark — NOT the screen. The bee is absolutely positioned, so it fills that anchor and the path resolves against it.',
    anchorStyle: 'wordmarkArcAnchor',
    containers: [{ label: 'wordmarkArcAnchor 220x100', width: 220, height: 100 }],
  },
];

// =========================================================================
// A. THE FUNCTION
// =========================================================================
console.log('\nA. the attitude function, sampled across its whole domain');

const moduleSource = await readFile(MODULE_PATH, 'utf8');
const moduleAst = parseJs(moduleSource);
const moduleImports = moduleAst.program.body.filter((n) => n.type === 'ImportDeclaration');
if (moduleImports.length === 0) {
  ok('beeAttitude.js declares no imports, so this gate can load it as a module');
} else {
  bad(
    'beeAttitude.js declares no imports, so this gate can load it as a module',
    `found ${moduleImports.length}: ${moduleImports.map((n) => n.source.value).join(', ')}. ` +
      'This gate imports the module directly rather than pattern-matching its source; a dependency ' +
      'breaks that and the rows below would have to become string-matching, which is how the defect got here.',
  );
}

const attitude = await import(
  `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`
);
const { buildAttitude, bankFor, pitchFor, facingFor, MAX_BANK_DEG, TURN_MS } = attitude;

{
  const samples = [];
  for (let p = -90; p <= 90; p += 0.5) samples.push({ p, b: bankFor(p) });

  const flats = samples.filter((s, i) => i > 0 && Math.abs(s.b - samples[i - 1].b) < 1e-12);
  if (flats.length === 0) {
    ok(`bankFor is strictly monotonic over pitch -90..90 (${samples.length} samples)`);
  } else {
    bad(
      `bankFor is strictly monotonic over pitch -90..90 (${samples.length} samples)`,
      `${flats.length} flat steps, first at pitch ${flats[0].p}. A flat region means the attitude has ` +
        'stopped tracking the path — a clamp, a latch or a constant. This is the row a saturated ' +
        'clamp(±22) fails and every "within the bound" row passes.',
    );
  }

  const worst = samples.reduce((a, s) => (Math.abs(s.b) > Math.abs(a.b) ? s : a));
  if (Math.abs(worst.b) <= MAX_BANK_DEG + 1e-9) {
    ok(`bankFor stays within ±${MAX_BANK_DEG}° over the whole domain (max ${worst.b.toFixed(2)}° at pitch ${worst.p})`);
  } else {
    bad(
      `bankFor stays within ±${MAX_BANK_DEG}° over the whole domain`,
      `${worst.b.toFixed(2)}° at pitch ${worst.p}`,
    );
  }

  const signOk = samples.every((s) => Math.sign(s.b) === Math.sign(s.p));
  if (signOk && bankFor(0) === 0) {
    ok('bankFor(0) is level and bank keeps the sign of its pitch (no inversion, no offset)');
  } else {
    bad(
      'bankFor(0) is level and bank keeps the sign of its pitch (no inversion, no offset)',
      `bankFor(0) = ${bankFor(0)}; sign agreement ${signOk}. A mirrored bee rotated the wrong way climbs where it should dive.`,
    );
  }

  const foldOk = [
    [120, -50],
    [-30, 80],
    [5, 5],
  ].every(([dx, dy]) => Math.abs(pitchFor(dx, dy) - pitchFor(-dx, dy)) < 1e-9);
  if (foldOk) {
    ok('pitchFor discards the direction of travel and keeps only steepness');
  } else {
    bad(
      'pitchFor discards the direction of travel and keeps only steepness',
      'pitch differs for mirrored travel, so leftward flight would bank the opposite way from rightward',
    );
  }

  // `facingFor` gets the same treatment as `bankFor` and for the same reason:
  // its two live consumers between them supply about six values of dx, and six
  // points say nothing about a rule with a threshold in it. Swept with BOTH
  // incoming facings, because the whole content of the rule is what it does
  // when it declines to decide.
  const SIZE = 32;
  const held = [];
  const turned = [];
  for (const h of [1, -1]) {
    for (let dx = -200; dx <= 200; dx += 0.5) {
      const f = facingFor(dx, SIZE, h);
      (Math.abs(dx) / SIZE >= 1 ? turned : held).push({ dx, h, f });
    }
  }
  const heldWrong = held.filter((s) => s.f !== s.h);
  if (heldWrong.length === 0) {
    ok(`facingFor holds the incoming facing below one body width (${held.length} samples, size ${SIZE})`);
  } else {
    bad(
      `facingFor holds the incoming facing below one body width (${held.length} samples, size ${SIZE})`,
      `${heldWrong.length} samples turned anyway, first at dx ${heldWrong[0].dx} holding ${heldWrong[0].h}. ` +
        'A bare Math.sign fails here and nowhere else — this is the row that separates the rule from the ' +
        'reflex, and loginArc segment 4 (0.80 body widths) is the live fixture.',
    );
  }
  const turnedWrong = turned.filter((s) => s.f !== Math.sign(s.dx));
  if (turnedWrong.length === 0) {
    ok(`facingFor faces its travel at or above one body width (${turned.length} samples, size ${SIZE})`);
  } else {
    bad(
      `facingFor faces its travel at or above one body width (${turned.length} samples, size ${SIZE})`,
      `${turnedWrong.length} samples kept the old facing, first at dx ${turnedWrong[0].dx}`,
    );
  }
  const scalesWithSize = [13, 16, 22, 32, 44, 64].every(
    (s) => facingFor(-s * 0.99, s, 1) === 1 && facingFor(-s * 1.01, s, 1) === -1,
  );
  if (scalesWithSize) {
    ok('facingFor threshold scales with size, not with a screen (checked at every live flight size)');
  } else {
    bad(
      'facingFor threshold scales with size, not with a screen (checked at every live flight size)',
      'the threshold did not track `size`. Whether sideways reads as sideways is a question about the ' +
        "character's own length; a fixed pixel deadband would be tuned against one container.",
    );
  }
}

// =========================================================================
// B/C. THE CALL SITES
// =========================================================================
console.log('\nB. FlyingBee wiring');

const flyingBeeSource = await readFile(FLYING_BEE, 'utf8');
const flyingBeeAst = parseJs(flyingBeeSource);

// The module has to be the file's ONLY source of rotation, or the rows
// above are about a function the render doesn't use.
{
  const importsBuild = flyingBeeAst.program.body.some(
    (n) =>
      n.type === 'ImportDeclaration' &&
      n.source.value.includes('beeAttitude') &&
      n.specifiers.some((s) => s.imported?.name === 'buildAttitude'),
  );
  let otherRotation = 0;
  walk(flyingBeeAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.property?.name === 'atan2') otherRotation += 1;
  });
  if (importsBuild && otherRotation === 0) {
    ok('FlyingBee.js takes its attitude from buildAttitude and computes no angle of its own');
  } else {
    bad(
      'FlyingBee.js takes its attitude from buildAttitude and computes no angle of its own',
      `imports buildAttitude: ${importsBuild}; atan2 call sites in the file: ${otherRotation}`,
    );
  }
}

// Durations and easings are read out of the source, not restated here — a
// track flown for a different length gets a different turn window, and the
// wall-time row below is only meaningful if it uses the real number.
const constants = {};
walk(flyingBeeAst.program, (n) => {
  if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
    if (n.init?.type === 'NumericLiteral') constants[n.id.name] = n.init.value;
    if (n.id.name.endsWith('_EASING')) {
      constants[n.id.name] = flyingBeeSource.slice(n.init.start, n.init.end);
    }
  }
  if (n.type === 'ObjectProperty' && n.key.name === 'duration' && n.value.type === 'NumericLiteral') {
    constants.presetDuration = n.value.value;
  }
});

for (const [name, expected] of [
  ['CRUISE_EASING', 'Easing.inOut(Easing.ease)'],
  ['PRESET_EASING', 'Easing.out(Easing.cubic)'],
]) {
  if (constants[name] === expected) {
    ok(`${name} is an easing this gate models (${expected})`);
  } else {
    bad(
      `${name} is an easing this gate models`,
      `found ${constants[name] ?? '(missing)'}, modelled: ${Object.keys(EASINGS).join(' | ')}. ` +
        'The turn window is specified in wall time and only the easing converts that into `t`, so an ' +
        'unmodelled easing means this gate CANNOT TELL — which is a failure, not a pass.',
    );
  }
}

// --- enumerate the call sites off disk ------------------------------------
const jsFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const found = [];
for (const file of [path.join(ROOT, 'App.js'), ...(await jsFiles(path.join(ROOT, 'src')))]) {
  if (file === FLYING_BEE) continue;
  const src = await readFile(file, 'utf8');
  if (!src.includes('<FlyingBee')) continue;
  walk(parseJs(src).program, (n) => {
    if (n.type !== 'JSXOpeningElement' || n.name.name !== 'FlyingBee') return;
    const props = {};
    n.attributes.forEach((a) => {
      if (a.type !== 'JSXAttribute') return;
      const v = a.value;
      props[a.name.name] =
        v === null ? true : v.type === 'StringLiteral' ? v.value : v.expression?.value;
    });
    found.push({ file: path.relative(ROOT, file), line: n.loc.start.line, props, src });
  });
}

const declared = new Map(CALL_SITES.map((s) => [s.file, s]));
const seen = new Set();
for (const site of found) {
  const entry = declared.get(site.file);
  if (!entry) {
    bad(
      `${site.file}:${site.line} <FlyingBee> is covered by this gate's container table`,
      'no entry for this file. A flight in an undeclared box is exactly the defect this gate exists ' +
        'for — add it to CALL_SITES with the container the call site mounts, and why.',
    );
    continue;
  }
  if (seen.has(site.file)) {
    bad(
      `${site.file}:${site.line} <FlyingBee> is covered by this gate's container table`,
      'a second <FlyingBee> in a file the table describes once — the two mounts may be in different boxes',
    );
    continue;
  }
  seen.add(site.file);
  entry.line = site.line;
  entry.size = site.props.size ?? constants.DEFAULT_SIZE;
  entry.source = site.src;
  if ((site.props.preset ?? null) !== entry.preset) {
    bad(
      `${site.file}:${site.line} flies the preset this gate's table declares`,
      `source says ${site.props.preset ?? 'cruise'}, table says ${entry.preset ?? 'cruise'}`,
    );
  }
}
for (const entry of CALL_SITES) {
  if (!seen.has(entry.file)) {
    bad(
      `${entry.file} still mounts a <FlyingBee>`,
      'the table describes a call site that no longer exists — stale rows make a green run mean less than it looks',
    );
  }
}
ok(`every <FlyingBee> call site on disk is declared here (${found.length} found, ${CALL_SITES.length} declared)`);

console.log('\nC. tracks, in the container the call site mounts');

// A declared box that can be read back from a stylesheet IS read back.
for (const entry of CALL_SITES) {
  if (!entry.anchorStyle || !entry.source) continue;
  const dims = {};
  walk(parseJs(entry.source).program, (n) => {
    if (n.type !== 'ObjectProperty' || n.key.name !== entry.anchorStyle) return;
    n.value.properties?.forEach((p) => {
      if (p.value?.type === 'NumericLiteral') dims[p.key.name] = p.value.value;
    });
  });
  const want = entry.containers[0];
  if (dims.width === want.width && dims.height === want.height) {
    ok(`${entry.file} styles.${entry.anchorStyle} is still ${want.width}x${want.height} (the box the path resolves against)`);
  } else {
    bad(
      `${entry.file} styles.${entry.anchorStyle} is still ${want.width}x${want.height}`,
      `stylesheet says ${dims.width}x${dims.height}. Every figure below for this site is measured in that box; ` +
        'resolving this flight against the screen instead is the error this gate was written after.',
    );
  }
}

const PATHS = {};
walk(flyingBeeAst.program, (n) => {
  if (n.type === 'VariableDeclarator' && n.id.name === 'PATH') {
    PATHS.cruise = JSON.parse(flyingBeeSource.slice(n.init.start, n.init.end).replace(/(\w+):/g, '"$1":').replace(/,(\s*])/g, '$1'));
  }
  if (n.type === 'ObjectProperty' && n.key.name === 'loginArc') {
    walk(n.value, (m) => {
      if (m.type === 'ArrayExpression' && !PATHS.loginArc) {
        PATHS.loginArc = JSON.parse(flyingBeeSource.slice(m.start, m.end).replace(/(\w+):/g, '"$1":').replace(/,(\s*])/g, '$1'));
      }
    });
  }
});

for (const entry of CALL_SITES) {
  if (!entry.source) continue;
  const closed = entry.preset === null;
  const trackPath = closed ? PATHS.cruise : PATHS[entry.preset];
  const easing = EASINGS[closed ? constants.CRUISE_EASING : constants.PRESET_EASING];
  const durationMs = closed ? constants.LOOP_MS : constants.presetDuration;
  const label = `${entry.file}:${entry.line} ${entry.preset ?? 'cruise'} (size ${entry.size})`;

  if (!trackPath || !easing || !durationMs) {
    bad(`${label} is resolvable from source`, `path ${!!trackPath}, easing ${!!easing}, duration ${durationMs}`);
    continue;
  }

  const runs = entry.containers.map((box) => ({
    box,
    a: buildAttitude(trackPath, {
      width: box.width,
      height: box.height,
      size: entry.size,
      closed,
      easing,
      durationMs,
    }),
  }));

  const check = (name, predicate, describe) => {
    const bads = runs.filter((r) => !predicate(r));
    if (bads.length === 0) ok(`${label} — ${name} [${runs.length} container${runs.length > 1 ? 's' : ''}]`);
    else bad(`${label} — ${name}`, bads.map((r) => `${r.box.label}: ${describe(r)}`).join('; '));
  };

  check(
    `rendered bank stays within ±${MAX_BANK_DEG}° at every interpolation node`,
    (r) => Math.max(...r.a.rotateOutput.map(Math.abs)) <= MAX_BANK_DEG + 1e-9,
    (r) => `max ${Math.max(...r.a.rotateOutput.map(Math.abs)).toFixed(2)}°`,
  );

  check(
    'facing only changes on a segment over one body width of horizontal travel',
    (r) =>
      r.a.segments.every(
        (s, i) => i === 0 || s.facing === r.a.segments[i - 1].facing || s.bodyWidths >= 1,
      ),
    (r) => {
      const j = r.a.segments.findIndex(
        (s, i) => i > 0 && s.facing !== r.a.segments[i - 1].facing && s.bodyWidths < 1,
      );
      return `segment ${j + 1} turns on ${r.a.segments[j].bodyWidths.toFixed(2)} body widths`;
    },
  );

  check(
    'segment 1 clears one body width on its own (nothing to hold)',
    (r) => r.a.segments[0].bodyWidths >= 1,
    (r) => `${r.a.segments[0].bodyWidths.toFixed(2)} body widths`,
  );

  check(
    'attitude inputRange is strictly increasing (Animated.interpolate contract)',
    (r) => r.a.inputRange.every((t, i) => i === 0 || t > r.a.inputRange[i - 1]),
    () => 'a turn window collided with a waypoint',
  );

  check(
    'scaleX never exceeds a mirror',
    (r) => r.a.scaleXOutput.every((v) => Math.abs(v) <= 1 + 1e-9),
    (r) => `max |scaleX| ${Math.max(...r.a.scaleXOutput.map(Math.abs)).toFixed(3)}`,
  );

  // The space rule: a turn is specified in wall time, and `t` is eased, so
  // the only way to check it is to convert back through the easing.
  const wallOf = (r, t) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (easing(mid) < t) lo = mid;
      else hi = mid;
    }
    return ((lo + hi) / 2) * durationMs;
  };
  check(
    `each facing change takes ${TURN_MS}ms of wall time, not a fixed slice of t`,
    (r) => r.a.windows.every((w) => Math.abs(wallOf(r, w.tEnd) - wallOf(r, w.tStart) - TURN_MS) < 2),
    (r) =>
      r.a.windows
        .map((w) => `${(wallOf(r, w.tEnd) - wallOf(r, w.tStart)).toFixed(1)}ms (Δt ${(w.tEnd - w.tStart).toFixed(5)})`)
        .join(', '),
  );

  check(
    'rotation levels off exactly where the mirror crosses zero',
    (r) =>
      r.a.windows.every((w) => {
        const i = r.a.inputRange.findIndex((t) => Math.abs(t - w.tMid) < 1e-9);
        return i >= 0 && Math.abs(r.a.rotateOutput[i]) < 1e-9 && Math.abs(r.a.scaleXOutput[i]) < 1e-9;
      }),
    () => 'the bee would swap sides at a visible width, or hold a bank through the swap',
  );

  if (closed) {
    check(
      'attitude at t=1 matches t=0 (the loop seam does not snap)',
      (r) =>
        Math.abs(r.a.rotateOutput[r.a.rotateOutput.length - 1] - r.a.rotateOutput[0]) < 1e-9 &&
        Math.abs(r.a.scaleXOutput[r.a.scaleXOutput.length - 1] - r.a.scaleXOutput[0]) < 1e-9,
      (r) => {
        // Name the channel that actually snapped. Reporting only `rotate` would print
        // two identical numbers on a scaleX-only failure — a true red worded as a broken gate.
        const channels = [
          ['rotate', r.a.rotateOutput],
          ['scaleX', r.a.scaleXOutput],
        ];
        const snapped = channels.filter(([, out]) => Math.abs(out[out.length - 1] - out[0]) >= 1e-9);
        return snapped
          .map(([name, out]) => `${name} ${out[out.length - 1].toFixed(3)} at t=1 vs ${out[0].toFixed(3)} at t=0`)
          .join('; ');
      },
    );
    check(
      'a seam turn lies entirely before t=1',
      (r) => r.a.windows.every((w) => w.tEnd <= 1 + 1e-12),
      () => 'Animated.loop snaps t back to 0, so a straddling window teleports scaleX mid-turn',
    );
  }
}

// =========================================================================
// D. BeeTransition
// =========================================================================
//
// The other thing that flies the mascot. It has no track and no container —
// one stretch of translate, authored in points at the call site — so none of
// section B applies to it, and it was outside this gate entirely until the
// mascot got a face.
//
// What the face exposed: `SHARE_CARRY_PATH` travels 40pt to the LEFT, and the
// component never mirrored. That flight has been running tail-first on the
// Hive for as long as it has existed, invisibly, because the drawing it used
// had no expression to contradict. The row below is the one that catches it,
// and it catches it by asking the same question section B asks — which way is
// this bee pointing, given how far it travels — of the component that had
// never been asked.
console.log('\nD. BeeTransition paths');

const BEE_TRANSITION = path.join(ROOT, 'src/components/BeeTransition.js');
const btSource = await readFile(BEE_TRANSITION, 'utf8');
const btAst = parseJs(btSource);

// A path object as written in source: `{ translateX: [...], rotate: [...] }`.
const readPathObject = (node) => {
  if (node?.type !== 'ObjectExpression') return null;
  const out = {};
  node.properties.forEach((p) => {
    if (p.type !== 'ObjectProperty' || p.value?.type !== 'ArrayExpression') return;
    out[p.key.name] = p.value.elements.map((e) =>
      e.type === 'UnaryExpression' ? -e.argument.value : e.value,
    );
  });
  return out;
};

// The default every caller that passes no `path` flies. Read from the
// component rather than restated here, so the gate cannot disagree with it.
let DEFAULT_BT_PATH = null;
walk(btAst.program, (n) => {
  if (n.type === 'VariableDeclarator' && n.id?.name === 'DEFAULT_PATH') {
    DEFAULT_BT_PATH = readPathObject(n.init);
  }
});

{
  const importsFacing = btAst.program.body.some(
    (n) =>
      n.type === 'ImportDeclaration' &&
      n.source.value.endsWith('beeAttitude') &&
      n.specifiers.some((s) => s.imported?.name === 'facingFor'),
  );
  let ownSign = 0;
  walk(btAst.program, (n) => {
    if (
      n.type === 'MemberExpression' &&
      n.object?.name === 'Math' &&
      n.property?.name === 'sign'
    ) {
      ownSign += 1;
    }
  });
  if (importsFacing && ownSign === 0) {
    ok('BeeTransition takes its facing from facingFor and holds no facing rule of its own');
  } else {
    bad(
      'BeeTransition takes its facing from facingFor and holds no facing rule of its own',
      `imports facingFor: ${importsFacing}; Math.sign call sites in the file: ${ownSign}. Two copies of ` +
        'the one-body-width rule is one copy that can drift, and this is the file where drift is invisible.',
    );
  }

  // scaleX must be the LAST transform entry, in both render paths. RN folds
  // the array left to right onto a row vector, so the last entry is applied
  // first: mirror the drawing, then bank it. The other order banks the drawing
  // and then mirrors the bank, which climbs where it should dive.
  const orders = [];
  walk(btAst.program, (n) => {
    if (n.type !== 'ObjectProperty' || n.key?.name !== 'transform' || n.value?.type !== 'ArrayExpression') return;
    orders.push(
      n.value.elements.map((e) => e?.properties?.[0]?.key?.name ?? '?'),
    );
  });
  const scaleXLast = orders.length > 0 && orders.every((o) => o[o.length - 1] === 'scaleX');
  if (scaleXLast) {
    ok(`scaleX is the last transform entry in all ${orders.length} BeeTransition render paths (applied first)`);
  } else {
    bad(
      `scaleX is the last transform entry in all ${orders.length} BeeTransition render paths (applied first)`,
      orders.map((o) => `[${o.join(', ')}]`).join('; ') || 'no transform arrays found',
    );
  }
}

// Resolve every <BeeTransition> on disk to the path constant it flies and the
// size it flies at. A site whose path cannot be resolved is a FAILURE: this
// gate must not be able to shrug.
{
  const DEFAULT_SIZE = 32;
  const sites = [];
  for (const file of [path.join(ROOT, 'App.js'), ...(await jsFiles(path.join(ROOT, 'src')))]) {
    if (file === BEE_TRANSITION) continue;
    const src = await readFile(file, 'utf8');
    if (!src.includes('<BeeTransition')) continue;
    const ast = parseJs(src);
    const consts = new Map();
    walk(ast.program, (n) => {
      if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier') return;
      const obj = readPathObject(n.init);
      if (obj) consts.set(n.id.name, obj);
    });
    walk(ast.program, (n) => {
      if (n.type !== 'JSXOpeningElement' || n.name.name !== 'BeeTransition') return;
      const props = {};
      n.attributes.forEach((a) => {
        if (a.type !== 'JSXAttribute') return;
        props[a.name.name] = a.value?.expression ?? a.value;
      });
      // Three cases, and keeping them apart is the point. No `path` prop at
      // all means the component's own default, which this gate has read. A
      // named constant resolves in the file that declares it. An inline
      // object resolves directly. Anything else — an import, a call, a
      // ternary — is UNRESOLVED, and unresolved must not fall back to the
      // default: that would check a flight this call site does not fly, and
      // report it as a clean pass. This gate's own header says the place it
      // declines to have an opinion must not look like the place it has one,
      // and the first draft of this block did exactly that.
      let pathName = '(default path)';
      let def = DEFAULT_BT_PATH;
      if (props.path) {
        if (props.path.type === 'Identifier') {
          pathName = props.path.name;
          def = consts.get(pathName) ?? null;
        } else if (props.path.type === 'ObjectExpression') {
          pathName = '(inline)';
          def = readPathObject(props.path);
        } else {
          pathName = `(${props.path.type})`;
          def = null;
        }
      }
      sites.push({ file: path.relative(ROOT, file), line: n.loc.start.line, pathName, def, size: props.size?.value ?? DEFAULT_SIZE });
    });
  }

  const unresolved = sites.filter((s) => !s.def || !Array.isArray(s.def.translateX) || !Array.isArray(s.def.rotate));
  if (unresolved.length === 0) {
    ok(`every <BeeTransition> call site resolves to a path this gate can read (${sites.length} found)`);
  } else {
    bad(
      `every <BeeTransition> call site resolves to a path this gate can read (${sites.length} found)`,
      unresolved.map((s) => `${s.file}:${s.line} path=${s.pathName}`).join('; ') +
        ' — a flight this gate cannot read is a flight it is not checking, and that must not look like a pass.',
    );
  }

  for (const s of sites.filter((x) => x.def?.translateX && x.def?.rotate)) {
    const dx = s.def.translateX[s.def.translateX.length - 1] - s.def.translateX[0];
    const facing = facingFor(dx, s.size, 1);
    const banks = s.def.rotate.map((r) => parseFloat(r) * facing);
    const worst = banks.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
    const label =
      `${s.file}:${s.line} ${s.pathName ?? '(default path)'} @ size ${s.size} — ` +
      `travels ${dx.toFixed(0)}pt (${(Math.abs(dx) / s.size).toFixed(2)} body widths), ` +
      `faces ${facing > 0 ? 'right' : 'left'}, bank within ±${MAX_BANK_DEG}°`;
    if (Math.abs(worst) <= MAX_BANK_DEG + 1e-9) ok(label);
    else bad(label, `worst rendered bank ${worst.toFixed(1)}°`);
  }
}

// =========================================================================
// E. One bee
// =========================================================================
//
// Colin, verbatim: *"never have any other bee than our mascot."* Until this
// section that rule was enforced by a conversation and nothing else — the
// gate above holds the mascot at a readable attitude and says nothing about
// whether the thing being held is the mascot.
//
// The obvious shape is an exemption list: no bee but the mascot, *unless*
// declared here with a reason. I am not writing that, and the reason is a
// rule I have been on the wrong side of before — **an `unless` clause is
// self-issued unless you check who granted it.** A list of permitted
// exceptions is a place for the next exception to go, and the register that
// was going to be its first entry (the keepsake, ink-on-gold, which a raster
// cannot recolour) turned out not to need one: the mascot inverts which
// element carries the form, so undoing that inversion *is* the knockout.
// R83. Both registers are now the same drawing, so the exemption list would
// have been an empty list with a door in it.
//
// So the rule is enforced by absence. There is one drawing of the bee, it
// ships as `mascot-*.png`, and the component that drew the other one does not
// exist. A gate cannot check that a PNG is on-brand, but it can check that no
// second bee has been *drawn* — which is the form every previous non-mascot
// bee took, including the two redraws this project rejected.
console.log('\nE. One bee');

{
  const beeSources = (await jsFiles(path.join(ROOT, 'src'))).concat(path.join(ROOT, 'App.js'));

  // 1. The component that drew the old bee is gone, not deprecated. A file
  //    still on disk is a file an import can find.
  const stripedBee = path.join(ROOT, 'src/components/StripedBee.js');
  if (!existsSync(stripedBee)) {
    ok('src/components/StripedBee.js does not exist (the second drawing is deleted, not deprecated)');
  } else {
    bad(
      'src/components/StripedBee.js does not exist (the second drawing is deleted, not deprecated)',
      'it is still on disk, so an import can still find it',
    );
  }

  // 2. `StripedBee` survives only as prose. Several headers name it to record
  //    why it went — naming a thing to explain its removal is the opposite of
  //    keeping it, and a reader who finds no trace re-derives the same wrong
  //    turn. What must not survive is an *identifier*: an import, a render, a
  //    reference of any kind the parser can see.
  //
  //    The distinction is computed, not declared. An allow-list of files
  //    permitted to mention it would be an exemption list wearing a different
  //    hat, and it would have to be edited every time a header is written.
  const identifiers = [];
  let mentions = 0;
  for (const file of beeSources) {
    const src = await readFile(file, 'utf8');
    if (!src.includes('StripedBee')) continue;
    mentions += 1;
    walk(parseJs(src).program, (n) => {
      const hit =
        (n.type === 'Identifier' && n.name === 'StripedBee') ||
        (n.type === 'JSXIdentifier' && n.name === 'StripedBee');
      if (hit) identifiers.push(`${path.relative(ROOT, file)}:${n.loc.start.line}`);
    });
  }
  if (identifiers.length === 0) {
    ok(`StripedBee survives only in comments (${mentions} files mention it, 0 identifiers)`);
  } else {
    bad(
      'StripedBee survives only in comments',
      `${identifiers.join(', ')} — a live reference to a component that no longer exists`,
    );
  }

  // 3. Every bee actually rendered is one of the two mascot components.
  //    Enumerated off disk, so a third one added tomorrow fails without
  //    anyone remembering this rule — which is the only kind of rule that
  //    survives the thread it was agreed in.
  //    "Is this the mascot" is answered by REACHABILITY, not by a list. The
  //    two components that draw `mascot-*.png` seed the set; anything whose
  //    own file renders a member joins it, to a fixpoint. So a wrapper that
  //    adds a rhythm to the mascot (`WelcomeBee`, the 132pt held pose) passes
  //    by construction, and a new bee that draws its own shapes fails by
  //    construction — neither needs an entry anywhere.
  //
  //    A hardcoded permitted-set is the version of this row that has the hole
  //    it exists to close: the first draft was one, and adding `WelcomeBee` to
  //    it by hand is exactly the edit that makes the next bee's entry routine.
  //
  //    TWO CORRECTIONS, both found by mutating this row rather than reading it:
  //
  //    (a) The seeds were the hardcoded pair `MascotBee`/`KeepsakeBee` — the
  //        same list one level down, since a third register would have to be
  //        added by hand. A seed is now anything that `require`s an
  //        `assets/mascot-*.png`, so a register that draws the shipped asset
  //        joins on its own and one that draws a *different* asset does not.
  //
  //    (b) Membership was EXISTENTIAL where the rule is UNIVERSAL: "renders a
  //        mascot somewhere in its file." A component that draws its own bee
  //        on one branch and delegates to `MascotBee` on another satisfied
  //        that and passed — verified, it goes green. And that is not a
  //        hypothetical shape: it is `WelcomeBee` as it stood this morning,
  //        one `<MascotBee>` away from being invisible to the row written to
  //        find it. So a wrapper joins only if it renders a member AND draws
  //        no vectors of its own. Scope stated plainly: "draws its own" means
  //        it imports `react-native-svg`, which is how every bee this project
  //        has ever drawn was drawn. A bee assembled from rounded `View`s
  //        would still walk through, and no row here claims otherwise.
  const draws = new Map();
  const renders = new Map();
  const seeds = new Set();
  const vector = new Set();
  for (const file of beeSources) {
    const src = await readFile(file, 'utf8');
    if (!src.includes('Bee')) continue;
    const rel = path.relative(ROOT, file);
    if (/require\(\s*['"][^'"]*assets\/mascot-[^'"]*\.png['"]\s*\)/.test(src)) seeds.add(path.basename(rel, '.js'));
    walk(parseJs(src).program, (n) => {
      if (n.type === 'ImportDeclaration' && n.source.value === 'react-native-svg') vector.add(rel);
      if (n.type === 'JSXOpeningElement' && typeof n.name.name === 'string' && /Bee$/.test(n.name.name)) {
        renders.set(`${rel}:${n.loc.start.line}`, n.name.name);
        (draws.get(rel) ?? draws.set(rel, new Set()).get(rel)).add(n.name.name);
      }
    });
  }
  const componentFile = (name) => `src/components/${name}.js`;
  const mascotSet = new Set(seeds);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [rel, children] of draws) {
      const name = path.basename(rel, '.js');
      if (mascotSet.has(name) || rel !== componentFile(name) || vector.has(rel)) continue;
      if ([...children].some((c) => mascotSet.has(c))) {
        mascotSet.add(name);
        grew = true;
      }
    }
  }
  const strangers = [...renders].filter(([, name]) => !mascotSet.has(name));
  if (strangers.length === 0) {
    ok(`every rendered <*Bee> draws the mascot (${mascotSet.size} components reach mascot-*.png: ${[...mascotSet].sort().join(', ')})`);
  } else {
    // The two ways in are different defects and the line has to say which,
    // or a red on the hybrid reads as a red on a missing import.
    bad(
      'every rendered <*Bee> draws the mascot',
      strangers
        .map(([at, name]) =>
          vector.has(componentFile(name))
            ? `${at} <${name}> — renders the mascot but imports react-native-svg, so it also draws a bee of its own`
            : `${at} <${name}> — does not reach mascot-*.png by any render path`)
        .join('; ') + ' — Colin: "never have any other bee than our mascot."',
    );
  }

  // 4. The two registers draw the same character. Not a colour check — the
  //    assets are rasters and this gate cannot see inside them — but they are
  //    exported onto one character box, and `constants/mascot.js` states that
  //    box. Two components sharing one geometry module is what makes a swap
  //    between registers keep its footprint; if one grows its own numbers,
  //    that has silently stopped being true.
  const registers = ['src/components/MascotBee.js', 'src/components/KeepsakeBee.js'];
  const strays = [];
  for (const rel of registers) {
    const src = await readFile(path.join(ROOT, rel), 'utf8');
    if (!/from '\.\.\/constants\/mascot'/.test(src)) strays.push(`${rel} does not import constants/mascot`);
    walk(parseJs(src).program, (n) => {
      if (n.type !== 'VariableDeclarator' || n.init?.type !== 'NumericLiteral') return;
      strays.push(`${rel} declares a bare geometry number ${n.id.name} = ${n.init.value}`);
    });
  }
  if (strays.length === 0) {
    ok('both registers take their geometry from constants/mascot (one character box, so a register swap keeps its footprint)');
  } else {
    bad('both registers take their geometry from constants/mascot', strays.join('; '));
  }
}

console.log(`\ncheck-bee-attitude: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
