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

// =========================================================================
// F. The pollination tap (§28)
// =========================================================================
//
// The beat: you tap a face in your hive and the bee comes over and agrees
// with you. §28.1 makes it decorative by ruling — he is never the
// acknowledgement and never on the critical path — so nothing here is about
// whether the flight looks right. It is about the three ways a decorative
// flight can quietly start asserting something untrue:
//
//   • it lands somewhere other than the face you tapped (§28.2 two boxes,
//     §28.3 a waypoint names a corner);
//   • it keeps flying at a target that stopped being the one you chose
//     (§28.9, and the two corrections underneath it);
//   • a duration or a count stops being derived and becomes a number
//     somebody typed, at which point every figure in §28.5 is a claim about
//     nothing.
//
// The rows follow section A's method rather than section B's wherever they
// can: the flight math lives in `pollinationFlight.js` and the seating and
// hit-test in `combLattice.js`, both dependency-free on purpose, so this
// gate SAMPLES THE FUNCTIONS instead of reading the config they happen to be
// called with. R81, third outing: four live waypoints cannot pin a rule.
console.log('\nF. the pollination tap');

const FLIGHT_MODULE = path.join(ROOT, 'src/components/pollinationFlight.js');
const LATTICE_MODULE = path.join(ROOT, 'src/components/combLattice.js');
const HONEYCOMB_GRID = path.join(ROOT, 'src/components/HoneycombGrid.js');

const flightSource = await readFile(FLIGHT_MODULE, 'utf8');
const latticeSource = await readFile(LATTICE_MODULE, 'utf8');
const gridSource = await readFile(HONEYCOMB_GRID, 'utf8');

// --- F0. both modules are loadable, which is what every row below rests on
for (const [label, src] of [
  ['pollinationFlight.js', flightSource],
  ['combLattice.js', latticeSource],
]) {
  const imports = parseJs(src).program.body.filter((n) => n.type === 'ImportDeclaration');
  if (imports.length === 0) {
    ok(`${label} declares no imports, so this gate can load it as a module`);
  } else {
    bad(
      `${label} declares no imports, so this gate can load it as a module`,
      `found ${imports.length}: ${imports.map((n) => n.source.value).join(', ')}. The rows below ` +
        'import and sample these functions; one dependency and they degrade to string-matching.',
    );
  }
}

const flight = await import(`data:text/javascript;base64,${Buffer.from(flightSource).toString('base64')}`);
const lattice = await import(`data:text/javascript;base64,${Buffer.from(latticeSource).toString('base64')}`);

// --- the module's own numbers, read rather than retyped. Every row below
//     that quotes a figure derives it from these, so the "should pass"
//     mutation §28.7 asks for — move `cellSize` and watch every distance and
//     derived duration move with it — actually exercises the rows instead of
//     sliding past them.
const CRUISE_PATH = (() => {
  const d = flyingBeeAst.program.body
    .flatMap((n) => (n.type === 'VariableDeclaration' ? n.declarations : []))
    .find((x) => x.id?.name === 'PATH');
  return JSON.parse(
    flyingBeeSource.slice(d.init.start, d.init.end).replace(/(\w+):/g, '"$1":').replace(/,\s*]/g, ']'),
  );
})();
const CRUISE_LOOP_MS = (() => {
  const d = flyingBeeAst.program.body
    .flatMap((n) => (n.type === 'VariableDeclaration' ? n.declarations : []))
    .find((x) => x.id?.name === 'LOOP_MS');
  return d?.init?.value ?? null;
})();
// The comb's cell size, from the prop default its only call site relies on.
const CELL_SIZE = (() => {
  const m = gridSource.match(/cellSize\s*=\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
})();
if (CRUISE_PATH?.length && CRUISE_LOOP_MS && CELL_SIZE) {
  ok(`the gate reads its inputs off the source (PATH ${CRUISE_PATH.length} waypoints, LOOP_MS ${CRUISE_LOOP_MS}, cellSize ${CELL_SIZE})`);
} else {
  bad('the gate reads its inputs off the source', `PATH=${JSON.stringify(CRUISE_PATH)} LOOP_MS=${CRUISE_LOOP_MS} cellSize=${CELL_SIZE} — a null here means a row below is about to assert against a default it invented.`);
}

// --- F1. §28.7 row 1 — no pixel constant crosses the two boxes -----------
//
// §28.2: a flight's target is MEASURED in the flight's own box, never
// COMPUTED in the target's. The comb is three containers and a live scroll
// offset away from the bee, so the only honest currency is window
// coordinates. The enforceable form of that is an import check: if
// `FlyingBee` can see the comb's geometry it can be tempted to do the
// arithmetic, and the arithmetic is wrong by construction.
{
  const crossings = [];
  for (const [label, src, forbidden] of [
    ['FlyingBee.js', flyingBeeSource, ['./HoneycombGrid', './combLattice', '../screens/HoneycombTab']],
    ['HoneycombGrid.js', gridSource, ['./FlyingBee']],
  ]) {
    for (const node of parseJs(src).program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      if (forbidden.includes(node.source.value)) crossings.push(`${label} imports ${node.source.value}`);
    }
  }
  // `ringStep` is a measured property of the comb and travels WITH the
  // target for exactly this reason; a bee that knew the comb's cell size
  // would be a bee that knew what it was flying over.
  //
  // Asserted on IDENTIFIERS, not on the source text. The first draft of this
  // row was a regex and it went red on the comment two lines above — which is
  // R51's own rule (a grep overcounts a class; classify the hits, never quote
  // the count) failing inside the row written to enforce a different one.
  // Prose about a variable is not the variable.
  walk(flyingBeeAst.program, (n) => {
    if (n.type === 'Identifier' && n.name === 'cellSize') crossings.push('FlyingBee.js binds cellSize');
  });
  if (crossings.length === 0) {
    ok('no pixel constant crosses between the flight box and the comb box (§28.2)');
  } else {
    bad('no pixel constant crosses between the flight box and the comb box (§28.2)', crossings.join('; '));
  }
}

// --- F2. §28.7 row 2 — the half-box correction, on both axes -------------
//
// `styles.bee` is absolutely positioned with no offsets, so translateX/Y
// place the TOP-LEFT of the bee's box and every waypoint in this app has
// always named a corner. On a decorative loop nobody notices. On a landing
// it is 22.00pt in each axis at size 44 — 0.408 of a seat step, most of the
// way to the neighbour of the face he came to visit.
//
// The correction is half the BOX, not half the character: `MascotBee`
// centres the character inside `size × size`, so the box centre and the
// character centre are the same point. The row asserts the expression, both
// axes, and that no other divisor sneaks in — `size / 2` written once per
// axis is the whole fix and there is nothing else to tune.
{
  const halves = [];
  const others = [];
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'ObjectProperty' || !['x', 'y'].includes(n.key?.name)) return;
    const src = flyingBeeSource.slice(n.start, n.end);
    if (!/originRef/.test(src)) return;
    if (/-\s*size\s*\/\s*2/.test(src)) halves.push(n.key.name);
    else others.push(`${n.key.name}: ${src.replace(/\s+/g, ' ')}`);
  });
  if (halves.length === 2 && halves.includes('x') && halves.includes('y') && others.length === 0) {
    ok('the target is corrected by size / 2 on both axes (§28.3 — the waypoint names a corner, not a bee)');
  } else {
    bad(
      'the target is corrected by size / 2 on both axes (§28.3 — the waypoint names a corner, not a bee)',
      `axes corrected: [${halves.join(', ')}]${others.length ? `; uncorrected: ${others.join(', ')}` : ''}. ` +
        'Uncorrected, the bee lands 0.408 of a seat step down-and-right of the face he came to visit.',
    );
  }
}

// --- F3. §28.7 row 4 — waypoint 0 is read, not assumed -------------------
//
// §28.4: waypoint 0 is where the bee already is, so the break costs no
// teleport. `posRef` already holds the live translated position — the trail
// sampler reads it. A constant here would make the bee jump to the start of
// its own approach, and on the abort path it would jump BACKWARDS to
// wherever the visit began.
{
  const froms = [];
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'CallExpression') return;
    const callee = n.callee?.name;
    if (!['buildPollinationPlan', 'buildReturnPlan'].includes(callee)) return;
    const arg = n.arguments[0];
    const prop = arg?.properties?.find((p) => p.key?.name === 'from');
    froms.push({ callee, src: prop ? flyingBeeSource.slice(prop.start, prop.end).replace(/\s+/g, ' ') : '(absent)' });
  });
  const bad0 = froms.filter((f) => !/posRef\.current/.test(f.src));
  if (froms.length === 2 && bad0.length === 0) {
    ok('both plans take waypoint 0 from the live position ref (§28.4 — the break costs no teleport)');
  } else {
    bad(
      'both plans take waypoint 0 from the live position ref (§28.4 — the break costs no teleport)',
      froms.length !== 2
        ? `expected one visit plan and one return plan, found ${froms.length}`
        : bad0.map((f) => `${f.callee} from: ${f.src}`).join('; '),
    );
  }
}

// --- F4. §28.7 row 3 — the return ends exactly on PATH[0] ----------------
//
// `PATH[0] === PATH[4]`: the cruise track already closes there, so when the
// return finishes `t` restarts at 0 and `Animated.loop` resumes with ZERO
// discontinuity. That is free, and it is the only place a return can end
// without a seam. Compared numerically against the module's own PATH rather
// than against a copy of it here.
{
  const PATH = CRUISE_PATH;
  const box = { width: 393, height: 852 };
  const home = { x: PATH[0].x * box.width, y: PATH[0].y * box.height };
  const plan = flight.buildReturnPlan({
    from: { x: 12, y: 640 },
    home,
    width: box.width,
    height: box.height,
    cruiseSpeedPxS: flight.cruiseSpeedPxS(PATH, box.width, box.height, CRUISE_LOOP_MS),
    easing: (w) => w,
  });
  const last = plan.path[plan.path.length - 1];
  const closes = Math.abs(PATH[0].x - PATH[PATH.length - 1].x) < 1e-12 && Math.abs(PATH[0].y - PATH[PATH.length - 1].y) < 1e-12;
  const lands = Math.abs(last.x - PATH[0].x) < 1e-12 && Math.abs(last.y - PATH[0].y) < 1e-12;
  if (closes && lands) {
    ok('the return leg ends exactly on PATH[0], and PATH closes there (§28.4 — the loop resumes with no seam)');
  } else {
    bad(
      'the return leg ends exactly on PATH[0], and PATH closes there (§28.4 — the loop resumes with no seam)',
      `${closes ? '' : 'PATH[0] !== PATH[last]; '}${lands ? '' : `return ends at ${JSON.stringify(last)}, PATH[0] is ${JSON.stringify(PATH[0])}`}`,
    );
  }
}

// --- F5. §28.7 row 5 — the approach is distance/speed, with no clamp -----
//
// THE ROW THIS GATE EXISTS FOR, and it is R81's lesson applied one beat
// later. A clamp was drafted; sweeping the loop killed it, because sampled
// uniformly in wall time the departure distance runs 41 -> 417px, so any
// clamp pair binds on a large fraction of taps — a guard that fires most of
// the time is the mechanism wearing a guard's name.
//
// Four live waypoints cannot see that. A domain sweep can: a clamp is a flat
// region, a floor is a flat region, and a piecewise "speed up when far" is a
// second-difference spike. All three die on the same rows.
{
  const speed = 375.18;
  const samples = [];
  for (let d = 0; d <= 900; d += 0.25) samples.push({ d, ms: flight.approachDurationMs(d, speed) });

  const flats = samples.filter((s, i) => i > 0 && Math.abs(s.ms - samples[i - 1].ms) < 1e-12 && s.d > 0);
  if (flats.length === 0) {
    ok(`approachDurationMs is strictly monotonic over distance 0..900px (${samples.length} samples, no flat region)`);
  } else {
    bad(
      `approachDurationMs is strictly monotonic over distance 0..900px (${samples.length} samples, no flat region)`,
      `${flats.length} flat steps, first at ${flats[0].d}px. A flat region is a clamp, a floor or a ceiling — ` +
        'at which point the bee no longer moves at one speed and §28.5\'s p05/p50/p95 describe nothing.',
    );
  }

  let worstBend = 0;
  let bendAt = 0;
  for (let i = 1; i < samples.length - 1; i += 1) {
    const bend = Math.abs(samples[i + 1].ms - 2 * samples[i].ms + samples[i - 1].ms);
    if (bend > worstBend) { worstBend = bend; bendAt = samples[i].d; }
  }
  if (worstBend < 1e-9) {
    ok(`approachDurationMs is linear in distance (worst second difference ${worstBend.toExponential(1)}ms) — one speed, by construction`);
  } else {
    bad(
      'approachDurationMs is linear in distance — one speed, by construction',
      `second difference ${worstBend.toExponential(2)}ms at ${bendAt}px. A bend means the speed changes with ` +
        'distance, which is a clamp or an ease-by-length wearing a division.',
    );
  }
}

// --- F6. §28.5 — the approach speed is a RATIO, and the cruise is derived
//
// The published 375 px/s is a consequence of a 393x852 box, not a design
// decision. What reads as "he broke off to come here" is that he is moving
// faster than he was a moment ago, so the ratified quantity is the ratio.
// This row also pins the derivation chain: change the cruise PATH or the
// loop length and every figure in §28.5 moves with it.
{
  const rows = DEVICES.map((d) => {
    const cruise = flight.cruiseSpeedPxS(CRUISE_PATH, d.width, d.height, CRUISE_LOOP_MS);
    return { d, cruise, approach: cruise * flight.APPROACH_SPEED_RATIO };
  });
  const offBy = rows.filter((r) => Math.abs(r.approach / r.cruise - flight.APPROACH_SPEED_RATIO) > 1e-12);
  const shipped = rows.find((r) => r.d.width === 393);
  const cruiseOk = Math.abs(shipped.cruise - 187.59) < 0.01;
  if (offBy.length === 0 && cruiseOk) {
    ok(`approach = ${flight.APPROACH_SPEED_RATIO}x cruise on all ${rows.length} device boxes (cruise 187.59 px/s at 393x852, so approach 375.18)`);
  } else {
    bad(
      `approach = ${flight.APPROACH_SPEED_RATIO}x cruise on all device boxes`,
      cruiseOk ? offBy.map((r) => r.d.label).join(', ') : `cruise at 393x852 is ${shipped.cruise.toFixed(2)} px/s, not the published 187.59 — the PATH or LOOP_MS moved and §28.5 did not`,
    );
  }
}

// --- F7. §28.7 row 6 — the pollen count is derived, not chosen -----------
//
// Six flecks is `pool 12 − ceil(750/160) live trail particles − 1 slack`. A
// literal 6 would silently start overrunning the pool the moment the cap
// drops or the cadence speeds up, and the hard cap is §12.5 Rule 3's answer
// to the #1 low-end perf risk in this app. So the row asserts that the
// number MOVES when its inputs do, not that it currently equals six.
{
  const shipped = flight.pollenCountFor({ poolSize: 12, trailFadeMs: 750, trailIntervalMs: 160 });
  const responses = [
    { label: 'a bigger pool', args: { poolSize: 20, trailFadeMs: 750, trailIntervalMs: 160 } },
    { label: 'a faster trail cadence', args: { poolSize: 12, trailFadeMs: 750, trailIntervalMs: 80 } },
    { label: 'a longer particle life', args: { poolSize: 12, trailFadeMs: 1500, trailIntervalMs: 160 } },
  ].map((c) => ({ ...c, got: flight.pollenCountFor(c.args) }));
  const deaf = responses.filter((r) => r.got === shipped);
  // And the call site must hand it the real inputs, not numbers that happen
  // to match them today.
  const callSite = flyingBeeSource.match(/pollenCountFor\(\{[^}]*\}\)/s)?.[0] ?? '';
  const literals = /:\s*\d/.test(callSite);
  if (shipped === 6 && deaf.length === 0 && !literals && /MAX_TRAIL_PARTICLES/.test(callSite) && /DURATIONS\.trailFade/.test(callSite) && /TRAIL_INTERVAL_MS/.test(callSite)) {
    ok(`pollen count is derived from the pool: 6 today, and it moves under all ${responses.length} input changes (${responses.map((r) => `${r.label} -> ${r.got}`).join(', ')})`);
  } else {
    bad(
      'pollen count is derived from the pool, not literal',
      literals
        ? `pollenCountFor is called with numeric literals: ${callSite.replace(/\s+/g, ' ')}`
        : deaf.length
          ? `${deaf.map((r) => r.label).join(', ')} did not move the count off ${shipped}`
          : `expected 6 at the shipped numbers, got ${shipped}`,
    );
  }
}

// --- F8. §28.9 rows 7 + 8 — the abort predicate --------------------------
//
// §28.9, ratified: **abort when the point the bee is aimed at would no
// longer resolve, under the comb's OWN hit-test, to the PERSON the user
// tapped.** Two corrections got it to that sentence, and both were the same
// mistake — the English was right and the field was wrong:
//
//   correction 1: keyed on SEAT. Re-seating does not move the seat; the
//     lattice is fixed. It moves who is sitting in it, so a seat-keyed check
//     passes while the bee alights on the right hexagon holding the wrong
//     person — the failure the condition exists to catch, passing it.
//   correction 2: keyed on `member.id`, which is a SHARE. The user tapped a
//     face, not a post.
//
// So the fixtures below are not examples of the rule, they ARE the rule.
// **The fixture is what pins the noun.** Fixture 2 goes green only under
// author-keying; fixture 1 goes red under correction 1's predicate; the
// sweep is what stops "abort when it drifts" from being pinned by the two
// or three offsets a fixture happens to use.
{
  const CELL = CELL_SIZE;
  const person = (n) => ({ authorId: `person-${n}`, id: `share-${n}-a`, name: `P${n}` });
  const members = Array.from({ length: 7 }, (_, i) => person(i));
  const layoutOf = (list) => lattice.buildCombLayout(list, CELL, lattice.hexSpiral(1));
  const base = layoutOf(members);
  // Aim at the centre seat: it is the only one with a neighbour on every
  // side, so a vertical sweep crosses a real boundary rather than falling
  // off the cluster.
  const centre = base.cells[0];
  const aim = {
    personId: lattice.personKey(members[0]),
    localX: centre.x + CELL,
    localY: centre.y + CELL,
    scrollY: 0,
  };
  const half = lattice.ringStepFor(CELL) / 2;

  // --- the sweep
  const drifts = [];
  for (let d = -120; d <= 120; d += 0.25) drifts.push({ d, abort: lattice.shouldAbortPollination(base, aim, d) });
  const wrong = drifts.filter(({ d, abort }) => {
    if (Math.abs(d) <= half - 0.2) return abort;       // still inside the seat
    if (Math.abs(d) >= half + 0.2) return !abort;      // past the Voronoi midpoint
    return false;                                       // the boundary itself, unasserted
  });
  if (wrong.length === 0) {
    ok(`abort tracks the comb's own Voronoi boundary over ±120pt of drift (${drifts.length} samples; boundary √3·cellSize/2 = ${half.toFixed(3)}pt)`);
  } else {
    bad(
      `abort tracks the comb's own Voronoi boundary over ±120pt of drift (boundary ${half.toFixed(3)}pt)`,
      `${wrong.length} samples disagree, first at drift ${wrong[0].d}pt (abort=${wrong[0].abort}). A threshold ` +
        'read off anything but the lattice will pass a fixture at 0 and 100 and fail in between.',
    );
  }

  // --- fixture 1: a re-seat with the aim point UNMOVED. Someone else's
  //     share arrives and re-orders feed order, so the person you tapped
  //     moves seat. Must abort. Fails correction 1's seat-keyed predicate,
  //     and no scroll event fires — which is why the trigger set includes
  //     `layout` identity.
  const reseated = layoutOf([person(9), ...members]);
  const f1 = lattice.shouldAbortPollination(reseated, aim, 0);

  // --- fixture 2: a re-share BY THE SAME PERSON. Aim point and seat both
  //     unmoved; only the share id changes. Must NOT abort — §28.1 says he
  //     decorates the source you tapped and the source is a face. This is
  //     the row that pins person over post; it is red under share-keying.
  const resharedList = members.map((m, i) => (i === 0 ? { ...m, id: 'share-0-b' } : m));
  const f2 = lattice.shouldAbortPollination(layoutOf(resharedList), aim, 0);

  // --- fixture 3: the tapped person is pushed off the comb entirely. In
  //     today's build this is the REACHABLE one: the demo set fills all
  //     seven seats, so the first real share of the day evicts the seventh
  //     member and re-seats the rest.
  const evicted = layoutOf([person(9), ...members.slice(0, 6)].filter((m) => m.authorId !== 'person-0'));
  const f3 = lattice.shouldAbortPollination(evicted, aim, 0);

  const fixtures = [
    { label: 'a re-seat with the aim point unmoved aborts', got: f1, want: true },
    { label: 'a re-share by the same person does NOT abort', got: f2, want: false },
    { label: 'the tapped person evicted from the comb aborts', got: f3, want: true },
  ];
  const missed = fixtures.filter((f) => f.got !== f.want);
  if (missed.length === 0) {
    ok('the abort predicate keys on the PERSON: ' + fixtures.map((f) => f.label).join('; '));
  } else {
    bad(
      'the abort predicate keys on the PERSON',
      missed
        .map((f) => `${f.label} — got abort=${f.got}`)
        .join('; ') +
        '. Seat-keying passes fixture 1 while landing on the wrong person; share-keying fails fixture 2 ' +
        'and spends the abort on the one event that is NOT "the wrong person is there."',
    );
  }
}

// --- F9. §28.9 row 8 — the predicate IS the hit-test, not a copy ---------
//
// §17.5's two-utils ruling permits distinct mechanisms for distinct surfaces
// (the comb hit-tests by cube-round, the hive comb by first-containment). It
// does not permit two answers to one question inside one screen. A second
// nearest-cell implementation appearing anywhere under `src/components` or
// `src/screens` fails this row even if it is numerically identical, because
// "identical today" is not a property anything maintains.
{
  const dirs = ['src/components', 'src/screens', 'src/utils'];
  const owners = [];
  for (const dir of dirs) {
    for (const name of await readdir(path.join(ROOT, dir))) {
      if (!name.endsWith('.js')) continue;
      const rel = `${dir}/${name}`;
      const src = await readFile(path.join(ROOT, rel), 'utf8');
      for (const fn of ['axialRound', 'pixelToAxialRaw']) {
        // A definition, not a call: `const axialRound =` / `function axialRound`.
        if (new RegExp(`(const|let|function)\\s+${fn}\\b`).test(src)) owners.push(`${rel}:${fn}`);
      }
    }
  }
  const expected = ['src/components/combLattice.js:axialRound', 'src/components/combLattice.js:pixelToAxialRaw'];
  const extra = owners.filter((o) => !expected.includes(o));
  const usesShared = /shouldAbortPollination/.test(gridSource) && /from '\.\/combLattice'/.test(gridSource);
  if (extra.length === 0 && owners.length === 2 && usesShared) {
    ok('one lattice implementation, and the abort predicate is it (HoneycombGrid imports shouldAbortPollination rather than re-deriving nearest-cell)');
  } else {
    bad(
      'one lattice implementation, and the abort predicate is it',
      extra.length
        ? `a second nearest-cell implementation exists: ${extra.join(', ')}`
        : usesShared
          ? `expected exactly 2 lattice definitions in combLattice.js, found ${owners.length}: ${owners.join(', ')}`
          : 'HoneycombGrid does not use shouldAbortPollination from combLattice — the predicate has been copied out',
    );
  }
}

console.log(`\ncheck-bee-attitude: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
