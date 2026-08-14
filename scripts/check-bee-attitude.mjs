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
const { buildAttitude, bankFor, pitchFor, MAX_BANK_DEG, TURN_MS } = attitude;

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

console.log(`\ncheck-bee-attitude: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
