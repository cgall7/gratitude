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

// §32.2 — `CRUISE_EASING` is deleted with the loop it eased. What replaced it
// is `BEAT_EASINGS`, the three curves a sequenced beat is flown on, and the
// row below enumerates that object off the AST rather than naming its members
// here: a fourth beat curve added later has to be one this gate models, and a
// hand-written list of three would let it in silently.
const BEAT_EASINGS = {};
walk(flyingBeeAst.program, (n) => {
  if (n.type !== 'VariableDeclarator' || n.id?.name !== 'BEAT_EASINGS') return;
  (n.init?.properties ?? []).forEach((prop) => {
    BEAT_EASINGS[prop.key.name] = flyingBeeSource.slice(prop.value.start, prop.value.end);
  });
});

const EASING_ROWS = [
  ['PRESET_EASING', constants.PRESET_EASING],
  ...Object.entries(BEAT_EASINGS).map(([k, v]) => [`BEAT_EASINGS.${k}`, v]),
];
if (Object.keys(BEAT_EASINGS).length === 0) {
  bad(
    'the beat easings are readable off the source',
    'no `BEAT_EASINGS` object in FlyingBee.js. Every sequenced beat is flown on one of these, and a ' +
      'gate that cannot read them cannot tell you what turn window any of them produces.',
  );
}
for (const [name, found] of EASING_ROWS) {
  if (EASINGS[found]) {
    ok(`${name} is an easing this gate models (${found})`);
  } else {
    bad(
      `${name} is an easing this gate models`,
      `found ${found ?? '(missing)'}, modelled: ${Object.keys(EASINGS).join(' | ')}. ` +
        'The turn window is specified in wall time and only the easing converts that into `t`, so an ' +
        'unmodelled easing means this gate CANNOT TELL — which is a failure, not a pass.',
    );
  }
}

// §32.2 / §28.5 — A SORTIE IS A POLLINATION VISIT WITHOUT THE POLLEN, so it
// must be flown on the SAME approach and descent curves the tap uses, not on a
// second pair that reads the same today. Both are handed to the builders from
// one object; this row is what stops someone "tuning the idle flight" and
// silently splitting the two beats that §28.5 argues are the same gesture.
{
  const visitCall = flyingBeeSource.match(/buildPollinationPlan\(\{[\s\S]*?\}\)/)?.[0] ?? '';
  const approach = visitCall.match(/easeApproach:\s*([^,\n]+)/)?.[1]?.trim();
  const descent = visitCall.match(/easeDescent:\s*([^,\n]+)/)?.[1]?.trim();
  const dartMatches = approach === BEAT_EASINGS.dart || approach === 'BEAT_EASINGS.dart';
  const settleMatches = descent === BEAT_EASINGS.settle || descent === 'BEAT_EASINGS.settle';
  if (dartMatches && settleMatches) {
    ok(`a sortie and a visit are flown on the same two curves (approach ${approach}, descent ${descent})`);
  } else {
    bad(
      'a sortie and a visit are flown on the same two curves',
      `visit approach ${approach ?? '(unread)'} vs BEAT_EASINGS.dart ${BEAT_EASINGS.dart ?? '(unread)'}; ` +
        `visit descent ${descent ?? '(unread)'} vs BEAT_EASINGS.settle ${BEAT_EASINGS.settle ?? '(unread)'}. ` +
        '§28.5 argues the break-off reads as a break-off because it is the same landing gesture at a ' +
        'different speed — two curves and that argument is about nothing.',
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
  // §32.2 — whether the mount is handed an anchor set at all. Presence of the
  // prop, not its value: the value is a conditional expression at both cruise
  // sites (that IS the suppression mechanism) and no static read can say what
  // it evaluates to. What this gate can say is that the mount is WIRED, and
  // section K checks the sets it is wired to.
  entry.hasPerches = Object.prototype.hasOwnProperty.call(site.props, 'perches');
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
  // §32.2 — a cruise mount HAS no static path any more, so there is nothing
  // here to resolve and this section does not pretend otherwise. It is a
  // hand-off, not a skip, and the difference is asserted rather than assumed:
  // an unsequenced cruise mount is a bee with nowhere to go, and the one thing
  // that must never happen quietly is for it to fall through this section
  // green. R82's own mutation found exactly this shape — a row that resolved
  // an unreadable path to a default and reported a flight nobody flies. The
  // attitude of a sequenced flight is checked in section K, against the plans
  // the anchors actually produce.
  if (entry.preset === null) {
    if (entry.hasPerches) {
      ok(`${entry.file}:${entry.line} cruise is sequenced — no static path to resolve here (attitude in section K)`);
    } else {
      bad(
        `${entry.file}:${entry.line} cruise is sequenced`,
        'this <FlyingBee> takes no `perches` prop. `PATH` was deleted rather than kept as a fallback ' +
          '(§32.2), so an unsequenced cruise mount is a bee with nowhere to land — it renders nothing, ' +
          'silently, on whichever screen forgot. Declare anchors with <PerchAnchor> and pass the set.',
      );
    }
    continue;
  }
  const trackPath = PATHS[entry.preset];
  const easing = EASINGS[constants.PRESET_EASING];
  const durationMs = constants.presetDuration;
  const label = `${entry.file}:${entry.line} ${entry.preset} (size ${entry.size})`;

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
      closed: false,
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

  // The loop-seam rows lived here and are deleted with the loop (§32.2). They
  // asserted that attitude at t=1 matched t=0 and that a seam turn finished
  // before t=1 — both properties of `Animated.loop` restarting `t` on a closed
  // track. No sequenced beat repeats and no preset closes, so `closed` is now
  // false at every call site: these rows could only ever have been vacuously
  // green, and a vacuously green row is worse than no row.
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
const MASCOT_CONSTANTS = path.join(ROOT, 'src/constants/mascot.js');

const SEQUENCER_MODULE = path.join(ROOT, 'src/components/flightSequencer.js');

const flightSource = await readFile(FLIGHT_MODULE, 'utf8');
const latticeSource = await readFile(LATTICE_MODULE, 'utf8');
const gridSource = await readFile(HONEYCOMB_GRID, 'utf8');
const mascotSource = await readFile(MASCOT_CONSTANTS, 'utf8');
const sequencerSource = await readFile(SEQUENCER_MODULE, 'utf8');

// --- F0. both modules are loadable, which is what every row below rests on
for (const [label, src] of [
  ['pollinationFlight.js', flightSource],
  ['combLattice.js', latticeSource],
  ['constants/mascot.js', mascotSource],
  ['flightSequencer.js', sequencerSource],
]) {
  const imports = parseJs(src).program.body.filter((n) => n.type === 'ImportDeclaration');
  if (imports.length === 0) {
    ok(`${label} declares no imports, so this gate can load it as a module`);
  } else {
    bad(
      `${label} declares no imports, so this gate can load it as a module`,
      `found ${imports.length}: ${imports.map((n) => n.source.value).join(', ')}. The rows below ` +
        'import and sample these modules; one dependency and they degrade to string-matching.',
    );
  }
}

const flight = await import(`data:text/javascript;base64,${Buffer.from(flightSource).toString('base64')}`);
const lattice = await import(`data:text/javascript;base64,${Buffer.from(latticeSource).toString('base64')}`);
const mascot = await import(`data:text/javascript;base64,${Buffer.from(mascotSource).toString('base64')}`);
const sequencer = await import(`data:text/javascript;base64,${Buffer.from(sequencerSource).toString('base64')}`);

// --- the module's own numbers, read rather than retyped. Every row below
//     that quotes a figure derives it from these, so the "should pass"
//     mutation §28.7 asks for — move `cellSize` and watch every distance and
//     derived duration move with it — actually exercises the rows instead of
//     sliding past them.
// §32.1 — the reference speed replaces `cruiseSpeedPxS(PATH, …, LOOP_MS)` as
// the number every §28.5 figure is defined against, and it is read off the
// sequencer module rather than retyped for the same reason everything else
// here is. `CRUISE_DIAG_PER_S` is the whole of it: a speed per container
// diagonal, so the rows below still move together when it moves.
const CRUISE_DIAG_PER_S = sequencer.CRUISE_DIAG_PER_S ?? null;
// The comb's cell size, from the prop default its only call site relies on.
const CELL_SIZE = (() => {
  const m = gridSource.match(/cellSize\s*=\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
})();
// The bee's own box, from the prop default the pollination call site relies
// on. Paired with `MASCOT_WIDTH_FRACTION` off the constants module, this is
// the C′ staging offset's whole input, and both halves are read rather than
// retyped for the same reason `CELL_SIZE` is.
const BEE_SIZE = (() => {
  const d = flyingBeeAst.program.body
    .flatMap((n) => (n.type === 'VariableDeclaration' ? n.declarations : []))
    .find((x) => x.id?.name === 'DEFAULT_SIZE');
  return d?.init?.value ?? null;
})();
if (CRUISE_DIAG_PER_S && CELL_SIZE && BEE_SIZE) {
  ok(`the gate reads its inputs off the source (CRUISE_DIAG_PER_S ${CRUISE_DIAG_PER_S}, cellSize ${CELL_SIZE}, beeSize ${BEE_SIZE})`);
} else {
  bad('the gate reads its inputs off the source', `CRUISE_DIAG_PER_S=${CRUISE_DIAG_PER_S} cellSize=${CELL_SIZE} beeSize=${BEE_SIZE} — a null here means a row below is about to assert against a default it invented.`);
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
//
// Located by ROLE. The first version of this row found the two properties by
// grepping their source for `originRef`, and R91 renamed that term to
// `boxOrigin` for reasons that had nothing to do with the half-box — so the
// row went red on a file where the correction was still present, on both
// axes, unchanged. A locator built out of an identifier that merely happens
// to appear inside the expression fails correct trees, and a row that fails
// correct trees is a row people learn to edit. `const target = { … }` is what
// this row is actually about, so that is what it looks for.
const pollinationTarget = (() => {
  let found = null;
  walk(flyingBeeAst.program, (n) => {
    if (found || n.type !== 'VariableDeclarator' || n.id?.name !== 'target') return;
    if (n.init?.type !== 'ObjectExpression') return;
    found = n.init;
  });
  return found;
})();
const targetAxisProp = (axis) =>
  pollinationTarget?.properties?.find(
    (p) => p.type === 'ObjectProperty' && p.key?.name === axis,
  ) ?? null;
{
  const NAME = 'the target is corrected by size / 2 on both axes (§28.3 — the waypoint names a corner, not a bee)';
  if (!pollinationTarget) {
    bad(NAME, 'no `const target = { … }` object literal in FlyingBee.js, so this row could not find the expression it is about — CANNOT TELL, which is a fail.');
  } else {
    const halves = [];
    const others = [];
    for (const axis of ['x', 'y']) {
      const prop = targetAxisProp(axis);
      if (!prop) {
        others.push(`${axis}: absent from the target literal`);
        continue;
      }
      const src = flyingBeeSource.slice(prop.start, prop.end).replace(/\s+/g, ' ');
      if (/-\s*size\s*\/\s*2/.test(src)) halves.push(axis);
      else others.push(`${axis}: ${src}`);
    }
    if (halves.length === 2 && others.length === 0) {
      ok(NAME);
    } else {
      bad(
        NAME,
        `axes corrected: [${halves.join(', ')}]${others.length ? `; uncorrected: ${others.join('; ')}` : ''}. ` +
          'Uncorrected, the bee lands 0.408 of a seat step down-and-right of the face he came to visit.',
      );
    }
  }
}

// --- F2b. §28.2 — the origin is measured at the moment of use ------------
//
// The other term in that same expression, and the one with no signature when
// it goes wrong. `originRef` used to be filled once from `onLayout` and then
// held. That is sound only if the box can move by nothing but a layout pass,
// and it can: `onLayout` is emitted from `affectedLayoutableNodes`
// (`ShadowTree.cpp:571-574`), which is filled only under
// `getHasNewLayout()` (`YogaLayoutableShadowNode.cpp:701`), and Yoga does not
// handle transforms at all (`YGNode.h:279`). A container moved by an ancestor
// transform leaves the cached origin stale, silently, by an amount with no
// sign to spot it by.
//
// So the row asserts the TRIGGER, not the call: `measureInWindow` was already
// in the file — it was simply invoked from the one event a transform does not
// produce. F3 below has the same shape of history and it is worth stating the
// pair, because they are the same lesson twice: F3 asked whether the source
// NAMES the live ref and nothing asked whether the ref was LIVE; this asks
// whether the origin is measured, and the thing that must be checked is WHEN.
//
// What it does not cover, stated so nobody reads coverage into it: a
// natively-driven ancestor transform is invisible to `measureInWindow` too
// (it reads the shadow tree — `DOM.cpp:536-539` — and the native driver
// writes the layer directly, `RCTMountingManager.mm:316-324`; measured, 18
// samples of y = 0 while the view slid 200pt). Measure-on-use widens the
// coverage from "layout only" to "layout + JS-driven transform". It does not
// close the class, and no row here claims it does.
{
  const NAME = 'the window origin is measured when the flight is planned, not cached at layout (§28.2)';
  // A function whose body measures the bee's OWN container. §28.2's whole
  // point is that the flight's box is the one measured, never the target's,
  // so the receiver is part of what makes a callee count.
  const measuresOwnBox = (fnNode) => {
    let hit = false;
    walk(fnNode, (n) => {
      if (hit) return;
      if (n.type !== 'CallExpression' && n.type !== 'OptionalCallExpression') return;
      const callee = n.callee;
      if (callee?.property?.name !== 'measureInWindow') return;
      let o = callee.object;
      while (o && (o.type === 'MemberExpression' || o.type === 'OptionalMemberExpression')) o = o.object;
      if (o?.type === 'Identifier' && o.name === 'containerRef') hit = true;
    });
    return hit;
  };
  const findFn = (name) => {
    let found = null;
    walk(flyingBeeAst.program, (n) => {
      if (found) return;
      if (n.type === 'FunctionDeclaration' && n.id?.name === name) found = n;
      if (
        n.type === 'VariableDeclarator' &&
        n.id?.name === name &&
        (n.init?.type === 'ArrowFunctionExpression' || n.init?.type === 'FunctionExpression')
      ) found = n.init;
    });
    return found;
  };
  // Names bound in this file to the RESULT OF CALLING a function that
  // measures the container. Resolving through the declarator is what makes
  // the row about freshness rather than about spelling: `readOrigin()` and
  // `originRef.current` are one character apart at the call site and are the
  // whole difference between measure-on-use and the defect.
  const freshNames = new Set();
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier') return;
    const init = n.init;
    if (init?.type !== 'CallExpression' && init?.type !== 'OptionalCallExpression') return;
    if (init.callee?.type !== 'Identifier') return;
    const fn = findFn(init.callee.name);
    if (fn && measuresOwnBox(fn)) freshNames.add(n.id.name);
  });
  const axisUses = {};
  for (const axis of ['x', 'y']) {
    const prop = targetAxisProp(axis);
    axisUses[axis] = new Set();
    walk(prop?.value, (n) => {
      if (n.type === 'Identifier' && freshNames.has(n.name)) axisUses[axis].add(n.name);
    });
  }
  const shared = [...axisUses.x].filter((n) => axisUses.y.has(n));
  const staleAxes = ['x', 'y'].filter((axis) => {
    const prop = targetAxisProp(axis);
    return prop && /originRef\s*\.\s*current/.test(flyingBeeSource.slice(prop.start, prop.end));
  });
  // Order matters here, and it is the R73 rule rather than taste. Reading the
  // cache directly implies "no binding of a measure call", so a freshness-first
  // ordering reports the general symptom for the one defect this row exists to
  // catch, and the specific line — the one that names `originRef.current` —
  // becomes unreachable exactly when it is true. Most specific cause first.
  if (!pollinationTarget) {
    bad(NAME, 'no `const target = { … }` object literal in FlyingBee.js — CANNOT TELL, which is a fail.');
  } else if (staleAxes.length) {
    bad(
      NAME,
      `the target reads \`originRef.current\` directly on [${staleAxes.join(', ')}]. That is the origin as of the last layout pass — correct until an ancestor transform moves this box without one, and then wrong by the whole delta with nothing to see.`,
    );
  } else if (freshNames.size === 0) {
    bad(
      NAME,
      'nothing in this file binds the result of a call that runs `containerRef…measureInWindow`. Either the measure moved off the container the flight is drawn in, or the origin is being read from a cache again.',
    );
  } else if (shared.length === 0) {
    bad(
      NAME,
      `the target subtracts no freshly measured origin on both axes (x: [${[...axisUses.x].join(', ') || 'none'}], y: [${[...axisUses.y].join(', ') || 'none'}]).`,
    );
  } else {
    ok(`${NAME} — both axes subtract \`${shared.join('`, `')}\`, bound to a call that measures containerRef`);
  }
}

// --- F3. §28.7 row 4 — waypoint 0 is read, not assumed -------------------
//
// §28.4: waypoint 0 is where the bee already is, so the break costs no
// teleport. `posRef` already holds the live translated position — the trail
// sampler reads it. A constant here would make the bee jump to the start of
// its own approach, and on the abort path it would jump BACKWARDS to
// wherever the visit began.
//
// §32.2 SPLIT THIS ROW'S SUBJECT AND THE ROW CAUGHT IT — correctly, and as a
// false red, which is the more useful of the two outcomes to write down. The
// sequencer solves its dwell against `sortieDurationFor(hop)`, which calls
// `buildPollinationPlan` with a SYNTHETIC `from` of the origin and a target
// one hop away, purely to ask how long that flight would take. That call is
// not a flight and must not read `posRef`: it is measuring a distance, and
// seeding it from wherever the bee happens to be would make the solved dwell
// depend on where he was standing when the anchors last changed.
//
// So the row now classifies by USE rather than by callee, which is the honest
// question anyway: A CALL THAT PRODUCES A PLAN MUST START WHERE THE BEE IS; A
// CALL WHOSE RESULT IS A NUMBER IS ASKING, NOT FLYING. A `buildPollinationPlan(…)`
// whose result is immediately member-accessed (`.durationMs`) is a
// measurement; anything else becomes a plan and is held to §28.4.
{
  // Measurement calls, found first so the flight pass can exclude them by
  // POSITION rather than by name. A name-based exemption would be a door: any
  // future helper called `measureSomething` would walk through it.
  const measurements = new Set();
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'MemberExpression') return;
    const o = n.object;
    if (o?.type === 'CallExpression' && ['buildPollinationPlan', 'buildReturnPlan'].includes(o.callee?.name)) {
      measurements.add(o.start);
    }
  });

  const froms = [];
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'CallExpression') return;
    const callee = n.callee?.name;
    if (!['buildPollinationPlan', 'buildReturnPlan'].includes(callee)) return;
    if (measurements.has(n.start)) return;
    const arg = n.arguments[0];
    const prop = arg?.properties?.find((p) => p.key?.name === 'from');
    froms.push({ callee, src: prop ? flyingBeeSource.slice(prop.start, prop.end).replace(/\s+/g, ' ') : '(absent)' });
  });
  const bad0 = froms.filter((f) => !/posRef\.current/.test(f.src));
  // One flight-producing call site: the pollination visit. The sortie's own
  // plan is built inside `resolveBeat`, in the sequencer, from a `from` this
  // component passes it — asserted separately in section K, because the module
  // is importable and the call site is here. Zero would mean the beat stopped
  // being built at all.
  if (froms.length === 1 && bad0.length === 0 && measurements.size === 1) {
    ok(`the plan-producing call takes waypoint 0 from the live position ref (§28.4 — the break costs no teleport; ${measurements.size} measurement call excluded by use, not by name)`);
  } else {
    bad(
      'the plan-producing call takes waypoint 0 from the live position ref (§28.4 — the break costs no teleport)',
      froms.length !== 1
        ? `expected exactly one flight-producing call, found ${froms.length}: ${froms.map((f) => `${f.callee} from: ${f.src}`).join('; ')}`
        : measurements.size !== 1
          ? `expected exactly one measurement call (the dwell solver's), found ${measurements.size} — a second one is either a duplicate solve or a flight that lost its plan`
          : bad0.map((f) => `${f.callee} from: ${f.src}`).join('; '),
    );
  }
}

// --- F4. §28.4 / §32.2 — the return leg has no fixed destination -------
//
// THIS ROW REPLACES ITS OWN PREDECESSOR RATHER THAN RELAXING IT. What used to
// be here asserted that the return leg ends exactly on `PATH[0]`, and that
// `PATH` closes there, so `Animated.loop` resumed with no discontinuity. Both
// halves of that are now unsatisfiable BY CONSTRUCTION: there is no loop and
// no `PATH`. Keeping the old row and softening it would have left a green tick
// standing over a property that no longer exists.
//
// What survives is the invariant underneath it, which was never really about
// waypoint zero: A FLIGHT MUST HAND OFF TO THE NEXT BEAT, NEVER TO A FIXED
// POINT. The seam existed because the destination was fixed; delete the fixed
// destination and the seam has nothing to close. So the row asserts the
// deletion is total — that no home coordinate survives anywhere in the
// component, and that both the landing path and the abort path advance the
// machine instead of flying somewhere named.
{
  const banned = ['PATH', 'LOOP_MS', 'CRUISE', 'homePx', 'returnFromHere', 'buildReturnPlan'];
  const live = new Set();
  walk(flyingBeeAst.program, (n) => {
    if (n.type === 'Identifier' && banned.includes(n.name)) live.add(n.name);
  });
  // Identifiers, never a text search: every one of these names is discussed by
  // name in the comments that explain the deletion, and a grep would report
  // the explanation as the defect. R85, second outing: PROSE ABOUT A VARIABLE
  // IS NOT THE VARIABLE.
  const advances = [...flyingBeeSource.matchAll(/advance\(/g)].length;
  const clean = live.size === 0;
  // Two call sites must advance the machine: the completion callback (any
  // landing, including a pollination visit) and the abort branch. `start` is
  // a third, and it is the opening beat rather than a hand-off.
  const wired = advances >= 3;

  if (clean && wired) {
    ok(`the cruise has no fixed destination left (§32.2 — 0 of ${banned.length} loop identifiers survive, ${advances} hand-offs to the sequencer)`);
  } else {
    bad(
      'the cruise has no fixed destination left (§32.2)',
      `${clean ? '' : `these loop identifiers are still live in FlyingBee: ${[...live].join(', ')}. ` +
        'A fallback lap survives on whichever screen forgets to declare anchors, which is the screen ' +
        'nobody looks at until Colin does. '}` +
        `${wired ? '' : `only ${advances} \`advance(\` call sites — the landing path and the abort path must both ` +
          'hand off to the next beat, or a flight ends with the bee parked wherever it stopped'}`,
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

// --- F5b. §28.11 / C′ — the staging point is on the face he came to -------
//
// R87's defect, and the row that would have caught it. The staging point was
// ONE RING STEP above the cell, and a ring step is the lattice's own pitch,
// so "one step above the cell" IS "the seat above it": four of seven seats
// staged on another member's face, and the approach eases out into the phase
// split, so the one moment the bee is stationary in the whole beat happened
// over the wrong person.
//
// The assertion is not "the offset is 30.07". It is **run the comb's own
// hit-test on the staging point of every seat and get that seat's own member
// back** — the same forward/backward pair F8 uses for the abort. A number can
// be re-picked; this cannot be satisfied by picking one.
//
// And the point it hit-tests is read back out of a REAL PLAN, not recomputed
// from `stagingOffsetFor`. A first draft did recompute it, and mutation 1 —
// revert `buildPollinationPlan` to `target.y - ringStep`, the exact R87
// defect — left this row GREEN, because a row that calls the offset function
// itself is true of the offset function whatever the plan does with it. R85,
// the same hole this gate has now grown twice: **a gate asserts a property of
// whatever it can import, and the defect lives at the call site it couldn't.**
// `buildPollinationPlan` is importable, so the call site is reachable, so the
// row has no excuse for asserting one step short of it.
//
// Second half of the row: the DESCENT leg is that offset. `DESCENT_MS` is the
// duration of a distance, and §28.5 quotes a speed — if the plan's last leg
// and `stagingOffsetFor` ever disagree, that published speed is fiction.
{
  const CELL = CELL_SIZE;
  const FRACTION = mascot.MASCOT_WIDTH_FRACTION;
  const BODY = FRACTION * BEE_SIZE;
  const person = (n) => ({ authorId: `person-${n}`, id: `share-${n}`, name: `P${n}` });
  const members = Array.from({ length: 7 }, (_, i) => person(i));
  const layout = lattice.buildCombLayout(members, CELL, lattice.hexSpiral(1));
  const offset = flight.stagingOffsetFor({ bodyLengthPx: BODY, ringStep: lattice.ringStepFor(CELL) });

  if (!(FRACTION > 0) || !(BEE_SIZE > 0) || !(CELL > 0)) {
    bad(
      'every seat stages inside its own hexagon',
      `cannot tell: MASCOT_WIDTH_FRACTION=${FRACTION}, beeSize=${BEE_SIZE}, cellSize=${CELL}. One of the ` +
        'three inputs did not resolve, so this row has no fixture — not a clean pass.',
    );
  } else {
    // One plan per seat, flown in the cluster's own box so the plan's
    // fractions invert back to the coordinates the hit-test speaks.
    const planFor = (centre) =>
      flight.buildPollinationPlan({
        from: { x: 0, y: 0 },
        target: centre,
        ringStep: lattice.ringStepFor(CELL),
        bodyLengthPx: BODY,
        width: layout.width,
        height: layout.height,
        approachSpeedPxS: 375.18,
        easeApproach: (w) => w,
        easeDescent: (w) => w,
      });

    const strays = [];
    for (const cell of layout.cells) {
      // Cell centres sit at (x + cellSize, y + cellSize) in cluster space.
      const centre = { x: cell.x + CELL, y: cell.y + CELL };
      const wp = planFor(centre).path[1];
      const staging = { x: wp.x * layout.width, y: wp.y * layout.height };
      const hit = layout.hitTest(staging.x, staging.y);
      const who = lattice.personKey(hit?.member) ?? 'off-comb';
      // State what the plan did, never why. A message that names a cause
      // invents one: the first draft's read "the offset crosses the apothem",
      // which is false under the mutation that matters — there the offset is
      // fine and the PLAN is not using it.
      if (who !== lattice.personKey(cell.member)) {
        strays.push(`${cell.member.name} stages ${Math.hypot(staging.x - centre.x, staging.y - centre.y).toFixed(2)}pt away, on ${who}`);
      }
    }
    if (strays.length === 0) {
      ok(`every seat stages inside its own hexagon (${layout.cells.length}/${layout.cells.length}; offset ${offset.toFixed(2)}pt against an apothem of ${(lattice.ringStepFor(CELL) / 2).toFixed(3)}pt)`);
    } else {
      bad(
        'every seat stages inside its own hexagon',
        `${strays.length} of ${layout.cells.length} do not: ${strays.join('; ')}. stagingOffsetFor says ` +
          `${offset.toFixed(2)}pt against an apothem of ${(lattice.ringStepFor(CELL) / 2).toFixed(3)}pt. ` +
          "The bee's one stationary moment is spent hovering over somebody the user did not tap.",
      );
    }

    const plan = planFor({ x: layout.width / 2, y: layout.height / 2 });
    const legPx = Math.hypot(
      (plan.path[2].x - plan.path[1].x) * layout.width,
      (plan.path[2].y - plan.path[1].y) * layout.height,
    );
    if (Math.abs(legPx - offset) < 1e-9) {
      ok(`the descent leg IS the staging offset (${legPx.toFixed(2)}pt in ${plan.descentMs}ms = ${((legPx / plan.descentMs) * 1000).toFixed(1)} px/s)`);
    } else {
      bad(
        'the descent leg IS the staging offset',
        `plan's last leg is ${legPx.toFixed(3)}pt, stagingOffsetFor says ${offset.toFixed(3)}pt. DESCENT_MS is the ` +
          'duration OF that distance; if they disagree, §28.5\'s published descent speed describes no flight.',
      );
    }
  }
}

// --- F5c. §28.11 / C′ — the bound holds for every pair, not just ours -----
//
// `beeSize` and `cellSize` are independent props on two different components.
// Nothing structural relates them — unlike R81's bank, where |pitch| ≤ 90 out
// of `atan2` made the ±22° bound true by construction with no clamp to route
// around. Here the guarantee has to be IN the function, and the only way to
// know it is is to sweep the two axes independently: a fixture at 44/44 says
// nothing about 44/16, which is the pair a denser comb would produce.
//
// Strictly less than the apothem, and strictly greater than zero. Zero is the
// other failure: an offset of 0 puts the staging point ON the cell centre, at
// which point there is no descent, no landing gesture, and §28.4's "the final
// leg is always a descent whatever direction he came from" is false.
{
  const FRACTION = mascot.MASCOT_WIDTH_FRACTION;
  const violations = [];
  const samples = [];
  for (let bee = 8; bee <= 200; bee += 2) {
    for (let cell = 12; cell <= 120; cell += 1) {
      const ringStep = lattice.ringStepFor(cell);
      const apothem = ringStep / 2;
      const off = flight.stagingOffsetFor({ bodyLengthPx: FRACTION * bee, ringStep });
      samples.push(1);
      if (!(off > 0) || !(off < apothem)) violations.push({ bee, cell, off, apothem });
    }
  }
  if (violations.length === 0) {
    ok(`stagingOffsetFor stays inside the target's own hexagon for every beeSize x cellSize pair (${samples.length} samples, bee 8..200 x cell 12..120, both swept independently)`);
  } else {
    const w = violations[0];
    bad(
      "stagingOffsetFor stays inside the target's own hexagon for every beeSize x cellSize pair",
      `${violations.length} of ${samples.length} pairs escape it, first at beeSize ${w.bee} / cellSize ${w.cell}: ` +
        `offset ${w.off.toFixed(3)}pt against an apothem of ${w.apothem.toFixed(3)}pt. At or past the apothem the ` +
        'staging point is in the seat above, which is R87\'s defect with different numbers in it.',
    );
  }
}

// --- F5d. §28.11 / C′ — the bound is a backstop, and stays one -----------
//
// The `min` in `stagingOffsetFor` is exactly the shape §28.5 killed on the
// approach: a guard that binds most of the time is the mechanism wearing a
// guard's name. It is legitimate here only because at the shipped pair the
// NOUN decides — he hangs his own length above the face, and the bound is
// inert. That is a property a retune can quietly destroy: raise `beeSize`
// past 1.141 x `cellSize` and the bee stops hanging a body length above
// anything, without a single line of this file changing.
//
// So the row asserts both directions. Inert where we ship (or F5c is passing
// because the clamp swallowed the design), and LIVE somewhere (or the clamp
// is dead code and F5c is passing for free).
{
  const FRACTION = mascot.MASCOT_WIDTH_FRACTION;
  const body = FRACTION * BEE_SIZE;
  const shipped = flight.stagingOffsetFor({ bodyLengthPx: body, ringStep: lattice.ringStepFor(CELL_SIZE) });
  if (Math.abs(shipped - body) < 1e-9) {
    ok(`the staging offset is the bee's own length at the shipped pair (beeSize ${BEE_SIZE} / cellSize ${CELL_SIZE} -> ${shipped.toFixed(2)}pt, the bound inert at ${((flight.STAGING_SAFETY * lattice.ringStepFor(CELL_SIZE)) / 2).toFixed(2)}pt)`);
  } else {
    bad(
      "the staging offset is the bee's own length at the shipped pair",
      `stagingOffsetFor returns ${shipped.toFixed(3)}pt where the drawn character is ${body.toFixed(3)}pt long. ` +
        'The bound is binding at the configuration we ship, so the comb is choosing the offset and the bee is ' +
        'not hanging its own length above anything — F5c would still be green.',
    );
  }
  // The clamp must be reachable, or F5c proves nothing about it.
  const tight = flight.stagingOffsetFor({ bodyLengthPx: FRACTION * 200, ringStep: lattice.ringStepFor(12) });
  if (tight < FRACTION * 200 - 1e-9) {
    ok(`the bound is live where a bee is large against its comb (beeSize 200 / cellSize 12 -> ${tight.toFixed(2)}pt, not ${(FRACTION * 200).toFixed(2)})`);
  } else {
    bad(
      'the bound is live where a bee is large against its comb',
      `beeSize 200 on cellSize 12 returns ${tight.toFixed(3)}pt, the full body length. Nothing bounds the offset, ` +
        'so F5c is green on the shipped ratio rather than on a guarantee.',
    );
  }
}

// --- F5e. §28.11 / C′ — the length the call site passes is the bee's ------
//
// R85(e), the hole a mutation found in this gate's own return-leg row: **a
// gate asserts a property of whatever it can import, and the defect lives at
// the call site it couldn't.** F5b/c/d sample `stagingOffsetFor`, which is
// true of any `bodyLengthPx` it is handed — including `size`, the BOX, which
// is 44 against a bound of 34.29 and would put the staging point back in the
// seat above with every row above it still green.
//
// So this reads the argument at the call site and requires it to resolve to
// the drawn character: the mascot's width fraction times the bee's own size
// prop. Order-insensitive, because `size * MASCOT_WIDTH_FRACTION` is the same
// length.
{
  const NAME = 'the call site passes the DRAWN length, not the box';
  let call = null;
  walk(flyingBeeAst, (n) => {
    if (n.type !== 'CallExpression' || n.callee?.name !== 'buildPollinationPlan') return;
    call = n;
  });
  const arg = call?.arguments?.[0]?.properties?.find((p) => p.key?.name === 'bodyLengthPx');
  if (!arg) {
    bad(
      NAME,
      call
        ? 'buildPollinationPlan is called without a `bodyLengthPx` property, so the staging offset falls to ' +
          '`Math.min(undefined, bound)` = NaN and the plan has no waypoint 1.'
        : 'no buildPollinationPlan call site found in FlyingBee.js — this row could not locate what it checks, ' +
          'which is a fail, not a pass.',
    );
  } else {
    const v = arg.value;
    const names = v?.type === 'BinaryExpression' && v.operator === '*'
      ? [v.left, v.right].map((s) => (s.type === 'Identifier' ? s.name : `<${s.type}>`))
      : [v?.type === 'Identifier' ? v.name : `<${v?.type}>`];
    const wanted = ['MASCOT_WIDTH_FRACTION', 'size'];
    if (wanted.every((w) => names.includes(w))) {
      ok(`${NAME} (bodyLengthPx: ${names.join(' * ')})`);
    } else {
      bad(
        NAME,
        `bodyLengthPx resolves to \`${names.join(' * ')}\`; expected the product of ${wanted.join(' and ')}. ` +
          `\`size\` alone is the BOX (${BEE_SIZE}pt against an apothem of ${(lattice.ringStepFor(CELL_SIZE) / 2).toFixed(2)}pt), ` +
          'which is R87\'s defect arriving through the argument instead of through the constant.',
      );
    }
  }
}

// --- F6. §28.5 / §32.1 — the approach speed is a RATIO, and the reference
//     it is a ratio OF is derived
//
// The published 375 px/s is a consequence of a 393x852 box, not a design
// decision. What reads as "he broke off to come here" is that he is moving
// faster than he was a moment ago, so the ratified quantity is the ratio.
//
// The reference used to be `cruiseSpeedPxS(PATH, …, LOOP_MS)` and `PATH` is
// deleted (§32.2). That is exactly the moment a chain like this quietly turns
// into a typed constant, so the row is kept and re-based rather than dropped:
// `referenceSpeedPxS` must still produce the same 187.59 px/s at 393x852 that
// every §28.5 figure — including `DESCENT_MS`'s justification — was written
// against. It does, to 0.06%, because it is the same fractional path resolved
// against the same box, restated per diagonal.
//
// It also pins the OTHER half of the chain, which is new and easy to break in
// isolation: a sortie is flown at `referenceSpeedPxS x DART_SPEED_RATIO`, and
// §28.5's contrast is between that and the approach. Raise the dart without
// re-basing the approach and the break-off stops reading, so both ratios are
// asserted against the one reference here.
{
  const rows = DEVICES.map((d) => {
    const reference = sequencer.referenceSpeedPxS(d.width, d.height);
    return {
      d,
      reference,
      approach: reference * flight.APPROACH_SPEED_RATIO,
      dart: reference * sequencer.DART_SPEED_RATIO,
    };
  });
  const offBy = rows.filter(
    (r) =>
      Math.abs(r.approach / r.reference - flight.APPROACH_SPEED_RATIO) > 1e-12 ||
      Math.abs(r.dart / r.reference - sequencer.DART_SPEED_RATIO) > 1e-12,
  );
  const shipped = rows.find((r) => r.d.width === 393);
  // 0.1 px/s, i.e. the 0.06% the swap was ratified on. A tighter bound would
  // fail on the restatement itself rather than on a regression.
  const referenceOk = Math.abs(shipped.reference - 187.59) < 0.15;
  // The contrast §28.5 is actually about: the approach must be faster than the
  // pace he was already flying, or "he broke off" has nothing to read off.
  const contrasts = flight.APPROACH_SPEED_RATIO > sequencer.DART_SPEED_RATIO;
  if (offBy.length === 0 && referenceOk && contrasts) {
    ok(
      `approach = ${flight.APPROACH_SPEED_RATIO}x and dart = ${sequencer.DART_SPEED_RATIO}x the reference speed on all ${rows.length} device boxes ` +
        `(reference ${shipped.reference.toFixed(2)} px/s at 393x852 vs the published 187.59, so approach ${shipped.approach.toFixed(2)})`,
    );
  } else {
    bad(
      `approach and dart are both ratios of the reference speed on all device boxes`,
      `${referenceOk ? '' : `reference at 393x852 is ${shipped.reference.toFixed(2)} px/s, not the published 187.59 — ` +
        'CRUISE_DIAG_PER_S moved and §28.5 did not. '}` +
        `${contrasts ? '' : `approach ratio ${flight.APPROACH_SPEED_RATIO} is not above dart ratio ${sequencer.DART_SPEED_RATIO}; ` +
          'the break-off is specified as a speed contrast and there is no contrast left. '}` +
        `${offBy.length === 0 ? '' : offBy.map((r) => r.d.label).join(', ')}`,
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

// =========================================================================
// G. §28.9 — the abort is INVOKED (Sage's find, and the chain under it)
// =========================================================================
//
// Section F sweeps `shouldAbortPollination` 961 ways and never once asserts
// that anything CALLS it. Delete `onScroll` from the ScrollView and every row
// in F stays green while the abort stops reaching one of its two cases.
// That is this gate's own rule, one commit later, in the mechanism it was
// written to guard: A GATE ASSERTS A PROPERTY OF WHATEVER IT CAN IMPORT, AND
// THE DEFECT LIVES AT THE CALL SITE IT COULDN'T.
//
// THE TRIGGER IS A CHAIN, NOT THREE PROPS. Three call sites were named when
// this was raised — `onScroll`, `scrollEventThrottle`, and the effect's
// dependency array. Walking the path from the native event to the predicate
// turns up six links, and a row per named prop would have had the same shape
// as the hole it was closing: true of the parts somebody thought to list.
//
//   native scroll event
//     → onScroll is bound to a handler                        (G1)
//     → the handler writes contentOffset.y into a ref          (G1)
//     → the handler publishes a tick                           (G1)
//     → the tick is published while a flight is airborne       (G2)
//     → both carriers cross into HoneycombGrid                 (G3)
//     → the effect's deps are the union of what can change
//       either of hitTest's two inputs                         (G4)
//     → the predicate reads the scroll LIVE, not off the aim   (G5)
//
// Every row resolves the NEXT link's name from the PREVIOUS row's finding
// rather than from a string typed here, so renaming any identifier or prop in
// the chain passes and removing any link fails. G1 finds the handler from the
// JSX attribute, the ref from the handler's own assignment, and the state
// variable from the setter's `useState` pair; G3 finds the prop names from
// the values passed at the JSX call site; G4 and G5 look for those prop
// names on the other side of the component boundary.
console.log('\nG. the abort predicate is invoked (§28.9)');

const HONEYCOMB_TAB = path.join(ROOT, 'src/screens/HoneycombTab.js');
const tabSource = await readFile(HONEYCOMB_TAB, 'utf8');
const tabAst = parseJs(tabSource);
const gridAst = parseJs(gridSource);

const sliceOf = (src) => (n) => (n ? src.slice(n.start, n.end).replace(/\s+/g, ' ') : '(absent)');
const tabTxt = sliceOf(tabSource);
const collect = (ast, pred) => {
  const out = [];
  walk(ast.program, (n) => {
    if (pred(n)) out.push(n);
  });
  return out;
};
const jsxElements = (ast, name) =>
  collect(ast, (n) => n.type === 'JSXElement' && n.openingElement?.name?.name === name);
const jsxOpenings = (ast, name) =>
  collect(ast, (n) => n.type === 'JSXOpeningElement' && n.name?.name === name);
const attrOf = (opening, name) =>
  (opening?.attributes || []).find((a) => a.type === 'JSXAttribute' && a.name?.name === name);
const attrExpr = (opening, name) => {
  const a = attrOf(opening, name);
  return a?.value?.type === 'JSXExpressionContainer' ? a.value.expression : null;
};
// `x.current` and `x?.current` are different node types in Babel, and the
// second one is what this file actually writes.
const isDotCurrent = (n, objectName) =>
  (n?.type === 'MemberExpression' || n?.type === 'OptionalMemberExpression') &&
  n.property?.name === 'current' &&
  (objectName === undefined || n.object?.name === objectName);

// --- G1. §28.9 row 9 — the aim trigger is bound, and it writes what the
//     predicate reads ----------------------------------------------------
//
// Three claims in one row because they are one link: an `onScroll` that is
// bound to nothing, a handler that publishes a tick without updating the aim
// point, and a handler that updates the aim point without publishing a tick
// are three ways to have wiring that looks present and re-evaluates nothing.
// The row also asserts the comb is INSIDE the ScrollView — if it ever moves
// out, scrolling stops moving the target and this whole beat is solving a
// problem the screen no longer has.
let scrollHandlerName = null;
let aimRefName = null;
let tickSetterName = null;
let tickStateName = null;
let scrollView = null;
let gridOpening = null;
{
  const svs = jsxElements(tabAst, 'ScrollView');
  const grids = jsxOpenings(tabAst, 'HoneycombGrid');
  scrollView = svs.length === 1 ? svs[0] : null;
  gridOpening = grids.length === 1 ? grids[0] : null;
  const nested = scrollView && gridOpening && gridOpening.start > scrollView.start && gridOpening.end < scrollView.end;

  const onScroll = scrollView ? attrExpr(scrollView.openingElement, 'onScroll') : null;
  scrollHandlerName = onScroll?.type === 'Identifier' ? onScroll.name : null;

  let handlerDecl = null;
  if (scrollHandlerName) {
    handlerDecl = collect(tabAst, (n) => n.type === 'VariableDeclarator' && n.id?.name === scrollHandlerName)[0] ?? null;
  }
  const setters = [];
  if (handlerDecl?.init) {
    walk(handlerDecl.init, (n) => {
      if (
        n.type === 'AssignmentExpression' &&
        isDotCurrent(n.left) &&
        /contentOffset\s*\.\s*y/.test(tabTxt(n.right))
      ) {
        aimRefName = n.left.object?.name ?? null;
      }
      if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && /^set[A-Z]/.test(n.callee.name)) {
        setters.push(n.callee.name);
      }
    });
  }
  tickSetterName = setters.length === 1 ? setters[0] : null;
  if (tickSetterName) {
    const pair = collect(
      tabAst,
      (n) =>
        n.type === 'VariableDeclarator' &&
        n.id?.type === 'ArrayPattern' &&
        n.init?.type === 'CallExpression' &&
        n.init.callee?.name === 'useState' &&
        n.id.elements?.[1]?.name === tickSetterName,
    )[0];
    tickStateName = pair?.id?.elements?.[0]?.name ?? null;
  }

  if (nested && scrollHandlerName && aimRefName && tickSetterName && tickStateName) {
    ok(
      `the aim trigger is bound and writes what the predicate reads (<ScrollView onScroll={${scrollHandlerName}}> → ${aimRefName}.current = contentOffset.y, and ${tickSetterName} publishes ${tickStateName})`,
    );
  } else {
    bad(
      'the aim trigger is bound and writes what the predicate reads',
      !scrollView
        ? `expected exactly 1 <ScrollView> in HoneycombTab.js, found ${jsxElements(tabAst, 'ScrollView').length}`
        : !gridOpening
          ? `expected exactly 1 <HoneycombGrid>, found ${jsxOpenings(tabAst, 'HoneycombGrid').length}`
          : !nested
            ? 'the comb is not inside the ScrollView — scrolling no longer moves the target, so §28.9 is guarding a hazard that has moved'
            : !scrollHandlerName
              ? 'the ScrollView has no `onScroll={handler}` — the aim point is never re-read and the abort reaches only the re-seat case'
              : !aimRefName
                ? `${scrollHandlerName} never assigns contentOffset.y into a ref — the tick fires, the predicate re-runs, and it compares the offset captured at tap time against itself forever`
                : !tickSetterName
                  ? `expected exactly 1 state setter call in ${scrollHandlerName}, found ${setters.length}${setters.length ? `: ${setters.join(', ')}` : ' — scrolling updates the aim point and nothing re-evaluates the predicate'}`
                  : `${tickSetterName} is not the setter of any useState pair — this row cannot name the value that crosses into the comb`,
    );
  }
}

// --- G2. §28.9 row 10 — the tick is published WHILE A FLIGHT IS AIRBORNE --
//
// G1 asserts a setter is called, which is true of `if (false) setTick(...)`
// too — the return-leg hole again, one link along. The publish here is
// deliberately guarded, because a per-frame `setState` on a screen with
// fourteen `useState` hooks is a real cost to pay when there is no bee to
// abort. So the row does not ask for an unguarded publish; it asks that the
// guard and the flight read THE SAME STATE. An unguarded publish passes (it
// is strictly more complete); a guard on anything else fails.
{
  let guardTest = null;
  if (scrollHandlerName) {
    const handlerDecl = collect(tabAst, (n) => n.type === 'VariableDeclarator' && n.id?.name === scrollHandlerName)[0];
    if (handlerDecl?.init && tickSetterName) {
      walk(handlerDecl.init, (n) => {
        if (n.type === 'IfStatement' && new RegExp(`\\b${tickSetterName}\\s*\\(`).test(tabTxt(n.consequent))) guardTest = n.test;
        if (
          n.type === 'LogicalExpression' &&
          n.operator === '&&' &&
          new RegExp(`\\b${tickSetterName}\\s*\\(`).test(tabTxt(n.right))
        ) {
          guardTest = n.left;
        }
      });
    }
  }
  // What each `someRef.current = X` mirrors, at component scope.
  const mirrors = {};
  walk(tabAst.program, (n) => {
    if (n.type === 'AssignmentExpression' && isDotCurrent(n.left) && n.right?.type === 'Identifier' && n.left.object?.name) {
      mirrors[n.left.object.name] = n.right.name;
    }
  });
  const guardReads = [];
  if (guardTest) {
    walk(guardTest, (n) => {
      if (isDotCurrent(n) && n.object?.name) guardReads.push(n.object.name);
      if (n.type === 'Identifier') guardReads.push(n.name);
    });
  }
  const flightKeySrc = tabTxt(attrExpr(gridOpening, 'activePollinationKey'));
  const sharedState = guardReads
    .map((r) => mirrors[r] ?? r)
    .find((state) => state && new RegExp(`\\b${state}\\b`).test(flightKeySrc));

  if (!tickSetterName) {
    bad('the tick is published while a flight is airborne', 'G1 could not name the setter, so this row has nothing to check — a row that cannot tell must fail rather than look clean');
  } else if (!guardTest) {
    ok(`${tickSetterName} publishes unconditionally — strictly more complete than the airborne guard this row permits`);
  } else if (sharedState) {
    ok(`the tick's guard and the flight read the same state (\`${tabTxt(guardTest)}\` mirrors \`${sharedState}\`, which activePollinationKey derives from)`);
  } else {
    bad(
      'the tick is published while a flight is airborne',
      `the guard on ${tickSetterName} is \`${tabTxt(guardTest)}\`, which reads ${guardReads.length ? guardReads.join('/') : 'nothing'} — none of which is the state activePollinationKey derives from (\`${flightKeySrc}\`). A guard that closes during the flight makes the aim trigger dead wiring.`,
    );
  }
}

// --- G3. §28.9 row 11 — both carriers cross the component boundary -------
//
// Resolved from G1's names, not from strings typed here: the row finds which
// PROPS carry the ref and the tick by looking at what is passed at the JSX
// call site, then checks those prop names are destructured on the other side.
// Rename anything in the chain and this passes; drop either prop and the
// predicate silently reads `0` forever (the ref) or never re-runs (the tick).
let refPropName = null;
let tickPropName = null;
{
  const passedAs = (identName) =>
    (gridOpening?.attributes || []).find(
      (a) => a.type === 'JSXAttribute' && a.value?.type === 'JSXExpressionContainer' && a.value.expression?.type === 'Identifier' && a.value.expression.name === identName,
    )?.name?.name ?? null;
  refPropName = aimRefName ? passedAs(aimRefName) : null;
  tickPropName = tickStateName ? passedAs(tickStateName) : null;

  let gridParams = [];
  walk(gridAst.program, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.name === 'HoneycombGrid' && n.init?.params?.[0]?.type === 'ObjectPattern') {
      gridParams = n.init.params[0].properties.map((p) => p.key?.name).filter(Boolean);
    }
  });
  const received = [refPropName, tickPropName].every((p) => p && gridParams.includes(p));

  if (refPropName && tickPropName && received) {
    ok(`both carriers cross into the comb (${aimRefName} as \`${refPropName}\`, ${tickStateName} as \`${tickPropName}\`, both destructured by HoneycombGrid)`);
  } else {
    bad(
      'both carriers cross into the comb',
      !aimRefName || !tickStateName
        ? 'G1 could not name what to look for, so this row cannot tell — which is a failure, not a pass'
        : !refPropName
          ? `${aimRefName} is not passed to <HoneycombGrid> — readScrollY falls back to 0 and the drift the predicate measures is a constant`
          : !tickPropName
            ? `${tickStateName} is not passed to <HoneycombGrid> — the aim trigger never reaches the effect`
            : `HoneycombGrid does not destructure ${[refPropName, tickPropName].filter((p) => !gridParams.includes(p)).join(' or ')} — the props are passed and dropped`,
    );
  }
}

// --- G4. §28.9 row 12 — the effect's deps are the union of hitTest's inputs
//
// `hitTest` has exactly two inputs, so the trigger set is the union of what
// can change either: the aim point (the scroll tick) and the seating
// (`layout`'s identity). The second half is complete BY CONSTRUCTION rather
// than by enumeration — `layout`'s own dependency list is the definition of
// what can re-seat — which is only true while `layout` really is the memo
// over the seating. So the row asserts both: the effect watches `layout`, and
// `layout` is `useMemo(buildCombLayout(...), [members, cellSize])`.
{
  let effect = null;
  walk(gridAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.name === 'useEffect') {
      let callsPredicate = false;
      walk(n.arguments?.[0], (m) => {
        if (m.type === 'CallExpression' && m.callee?.name === 'shouldAbortPollination') callsPredicate = true;
      });
      if (callsPredicate) effect = n;
    }
  });
  const deps = effect?.arguments?.[1]?.type === 'ArrayExpression' ? effect.arguments[1].elements.map((e) => e?.name ?? null) : null;
  const layoutMemo = collect(
    gridAst,
    (n) => n.type === 'VariableDeclarator' && n.id?.name === 'layout' && n.init?.type === 'CallExpression' && n.init.callee?.name === 'useMemo',
  )[0];
  const memoDeps = layoutMemo?.init?.arguments?.[1]?.elements?.map((e) => e?.name) ?? [];
  const seatingInputs = ['members', 'cellSize'].every((d) => memoDeps.includes(d));
  const watchesLayout = deps?.includes('layout');
  const watchesTick = tickPropName ? deps?.includes(tickPropName) : false;

  if (deps && watchesLayout && watchesTick && seatingInputs) {
    ok(`the abort effect watches both of hitTest's inputs ([${deps.join(', ')}]; layout re-memoizes on [${memoDeps.join(', ')}])`);
  } else {
    bad(
      "the abort effect watches both of hitTest's inputs",
      !effect
        ? 'no useEffect in HoneycombGrid.js calls shouldAbortPollination — the predicate is dead code'
        : !deps
          ? 'the abort effect has no dependency array — it re-runs on every render, which passes the aim point but makes the trigger set unreadable'
          : !tickPropName
            ? `G3 could not name the tick prop, so this row cannot tell whether [${deps.join(', ')}] contains it — and CANNOT TELL is a failure, not a clean NO`
            : !watchesLayout
              ? `\`layout\` is not in [${deps.join(', ')}] — a re-seat emits no scroll event, so the case the row-7 fixtures pin is evaluated by nothing`
              : !watchesTick
                ? `the scroll tick (\`${tickPropName}\`) is not in [${deps.join(', ')}] — scrolling moves the target and nothing re-checks it`
                : `layout re-memoizes on [${memoDeps.join(', ')}] — "complete by construction" holds only while that list IS the definition of what can re-seat`,
    );
  }
}

// --- G5. §28.9 row 13 — the predicate reads the scroll LIVE --------------
//
// The seeded aim carries `scrollY` at tap time and the predicate takes a
// second `scrollY` as its third argument; `drift` is their difference. Pass
// the seeded one and the drift is identically zero — a predicate that is
// wired, triggered, swept 961 ways and structurally incapable of ever being
// true. So the third argument must be a CALL, and that call must resolve to
// something reading the ref prop G3 named.
{
  let abortCall = null;
  walk(gridAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.name === 'shouldAbortPollination') abortCall = n;
  });
  const third = abortCall?.arguments?.[2] ?? null;
  const readerName = third?.type === 'CallExpression' && third.callee?.type === 'Identifier' ? third.callee.name : null;
  let readerReadsProp = false;
  if (readerName && refPropName) {
    const readerDecl = collect(gridAst, (n) => n.type === 'VariableDeclarator' && n.id?.name === readerName)[0];
    if (readerDecl?.init) {
      walk(readerDecl.init, (m) => {
        if (isDotCurrent(m, refPropName)) readerReadsProp = true;
      });
    }
  }

  if (readerName && readerReadsProp) {
    ok(`the abort predicate reads the scroll live (\`${readerName}()\` reads ${refPropName}.current, not the offset seeded at tap time)`);
  } else {
    bad(
      'the abort predicate reads the scroll live',
      !abortCall
        ? 'shouldAbortPollination is not called anywhere in HoneycombGrid.js'
        : !readerName
          ? `its third argument is \`${sliceOf(gridSource)(third)}\` — not a call, so it cannot be a live read. If it is the seeded offset, drift is identically zero and the predicate can never fire.`
          : !refPropName
            ? `G3 could not name the ref prop, so this row cannot tell what \`${readerName}\` ought to read — and CANNOT TELL is a failure, not a clean NO`
            : `\`${readerName}\` does not read ${refPropName}.current — the drift is measured against something other than the live scroll offset`,
    );
  }
}

// --- G6. §28.9 row 14 — nothing throttles the aim below one frame --------
//
// MEASURED, not recited, because the familiar claim about this prop does not
// hold on the installed version. `scrollEventThrottle={16}` is INERT here:
//
//   • Fabric — `BaseScrollViewProps.h:57` defaults it to 0;
//     `RCTScrollViewComponentView.mm:381-388` maps any value ≤ 1/60 s to an
//     internal 0, and `:744` then dispatches whenever `now - last > 0`. 16
//     and absent produce the identical internal value.
//   • Old arch — `RCTScrollView.m:385` defaults it to 0 and `:716` tests
//     `_scrollEventThrottle < MAX(0.017, elapsed)`, true for both 0 and
//     0.016. (The TODO at `:708` says 0 means "once per scroll"; the code
//     under it has not done that for some time. The comment is stale.)
//   • Android — `ReactScrollView.java:1620` stores it and
//     `getScrollEventThrottle()` has NO reader anywhere under
//     `ReactAndroid/src/main/java`. Probe scope stated: that directory, that
//     method name.
//
// THE FOLK CLAIM ABOUT THIS PROP IS WRITTEN DOWN TWICE AND IMPLEMENTED ZERO
// TIMES. `RCTScrollView.m:708` (a TODO) and `RCTScrollViewComponentView.mm:378`
// ("Zero means 'send value only once per significant logical event'") say the
// same false thing, in two architectures, and the second is a from-scratch
// reimplementation that carried the sentence forward — contradicted by `:744`,
// eleven lines below it. So the usual tell for a stale comment (one file
// disagreeing with everything else) is unavailable: a reader who distrusts one
// and checks the other finds corroboration.
//
// And the third source is the one that makes the bound below defensible.
// `ScrollView.js:580-583` and `ScrollView.d.ts` — the only two a JS developer
// reads — are CORRECT and SILENT: "Values <= `16` will disable throttling,
// regardless of the refresh rate of the device", with no statement of the
// default. THE DOCUMENTED SURFACE IS SILENT EXACTLY WHERE THE BEHAVIOUR IS
// SURPRISING, WHICH IS WHAT LETS A FALSE COMMENT IN THE IMPLEMENTATION READ AS
// AUTHORITATIVE.
//
// So the row does not assert the PROP, which would be asserting a token that
// governs nothing on this version. It asserts the PROPERTY: absent is fine,
// present must be ≤ 16 — and that 16 is the DOCUMENTED GUARANTEE, not the
// implementation constant (Fabric's internal threshold is 1/60 s = 16.67ms;
// binding the row to the documented number is what keeps it true if the
// implementation moves inside its own promise). The value stays in the source
// anyway, because a default of 0 meaning "every frame" is behaviour this beat
// depends on and does not own.
{
  const expr = scrollView ? attrExpr(scrollView.openingElement, 'scrollEventThrottle') : null;
  const value = expr?.type === 'NumericLiteral' ? expr.value : null;
  if (!scrollView) {
    bad('nothing throttles the aim point below one frame', 'G1 could not find the ScrollView, so this row cannot tell');
  } else if (!attrOf(scrollView.openingElement, 'scrollEventThrottle')) {
    ok('scrollEventThrottle is absent, which is 0 on this version — every frame (see the measurements above this row)');
  } else if (typeof value === 'number' && value <= 16) {
    ok(`scrollEventThrottle={${value}} ≤ 16, so the aim point is re-read every frame`);
  } else {
    bad(
      'nothing throttles the aim point below one frame',
      `scrollEventThrottle is \`${tabTxt(expr)}\` — above 16 this genuinely throttles on iOS, and the longest approaches (p95 1112ms) are the most interruptible ones`,
    );
  }
}

// --- H. §28.4 / R89 — the position ref is written by a subscription React
//     Native will actually call ------------------------------------------
//
// F3 above asserts that both plan builders take waypoint 0 from
// `posRef.current` rather than a constant. That row was GREEN for the entire
// life of this beat, while `posRef` held `{ x: 0, y: 0 }` from mount to
// unmount and every flight began in the container's top-left corner. The row
// was not wrong; it was answering a question one layer above the defect. It
// asked whether the source NAMES the live ref. Nothing asked whether the ref
// is live.
//
// The mechanism, verified in the installed RN (0.86.2) and then on device:
//
//   • `AnimatedWithChildren.__callListeners` (`:72-84`) calls the node's own
//     listeners, then cascades to children ONLY `if (!this.__isNative)`.
//   • `__makeNative` (`:24-39`) walks DOWN the chain, so once a value is
//     driven natively every node derived from it is native too.
//
//   ⇒ a listener on `t.interpolate(...)` is registered and then never called.
//     Measured: 49 callbacks in 800ms on the value; 0 on an interpolation of
//     it, whether or not that interpolation is attached to a real transform.
//     The class of the derived node is irrelevant, so "listen on the pair the
//     render uses" — the obvious fix — is also dead.
//
// The guard is correct, not a bug: under the native driver JS has no fresh
// value for the children, and RN chose frozen over stale. Frozen is also what
// made this findable, since a bee that teleports to the corner is a bug report
// and a bee lagging its own trail by two frames is not.
//
// So the rows below are about the SHAPE of a subscription, which is the part
// that is statically decidable. They cannot prove a listener fires — only a
// device can, and one did. What they can do is make the dead shape impossible
// to reintroduce, in this file or any other.
{
  // H1 — the class rule, enumerated rather than listed. Every `addListener`
  // in the app, receiver resolved to its declaration; a receiver built from
  // `.interpolate(...)` (or any other derived node) is a listener that will
  // go silent the moment its parent goes native, whether or not the file that
  // wrote it has a native driver in it today.
  const ANIMATED_DERIVED = /\.interpolate\s*\(|Animated\.(?:add|subtract|multiply|divide|modulo|diffClamp)\s*\(/;
  const ANIMATED_VALUE = /new\s+Animated\.Value\s*\(/;
  const sites = [];
  for (const file of [path.join(ROOT, 'App.js'), ...(await jsFiles(path.join(ROOT, 'src')))]) {
    const src = await readFile(file, 'utf8');
    if (!src.includes('.addListener(')) continue;
    const ast = parseJs(src);
    const declarators = [];
    walk(ast.program, (n) => {
      if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier') declarators.push(n);
    });
    walk(ast.program, (n) => {
      if (n.type !== 'CallExpression') return;
      if (n.callee?.type !== 'MemberExpression' || n.callee.property?.name !== 'addListener') return;
      const recv = n.callee.object;
      const rel = path.relative(ROOT, file);
      const name = recv?.type === 'Identifier' ? recv.name : null;
      const matches = name ? declarators.filter((d) => d.id.name === name) : [];
      const init = matches.length === 1 && matches[0].init
        ? src.slice(matches[0].init.start, matches[0].init.end)
        : null;
      let verdict;
      if (init === null) {
        // Unresolvable receiver. Only a concern in a file that deals in
        // Animated at all — `navigation.addListener` is a different API that
        // happens to share a method name.
        verdict = src.includes("from 'react-native'") && /\bAnimated\b/.test(src) ? 'CANNOT TELL' : 'not an Animated node';
      } else if (ANIMATED_DERIVED.test(init)) {
        verdict = 'DERIVED';
      } else if (ANIMATED_VALUE.test(init)) {
        verdict = 'AnimatedValue';
      } else {
        verdict = 'not an Animated node';
      }
      sites.push({ where: `${rel}:${src.slice(0, recv.start).split('\n').length}`, name, verdict, init });
    });
  }
  const derived = sites.filter((s) => s.verdict === 'DERIVED');
  const unknown = sites.filter((s) => s.verdict === 'CANNOT TELL');
  const values = sites.filter((s) => s.verdict === 'AnimatedValue');
  if (sites.length === 0) {
    bad(
      'every Animated listener in the app is attached to a value, not to a node derived from one',
      'found no `addListener` call anywhere — this row enumerates off disk, so zero sites means the walk broke, not that the app stopped listening',
    );
  } else if (derived.length === 0 && unknown.length === 0) {
    ok(
      `every Animated listener is attached to a value, not to a derived node (${values.length} on an AnimatedValue: ` +
        `${values.map((s) => `${s.where} \`${s.name}\``).join(', ')}; ${sites.length - values.length} not Animated)`,
    );
  } else {
    bad(
      'every Animated listener in the app is attached to a value, not to a node derived from one',
      [
        ...derived.map((s) => `${s.where} listens on \`${s.name}\` = ${s.init.replace(/\s+/g, ' ').slice(0, 90)} — a derived node. Its listeners stop firing the instant its parent is driven natively, silently, keeping the last value they saw.`),
        ...unknown.map((s) => `${s.where} listens on \`${s.name}\`, which this row could not resolve to a declaration in the same file — CANNOT TELL, which is a failure, not a pass.`),
      ].join(' '),
    );
  }

  // H2 — the sampler reads the SAME NODES the render puts on screen, not a
  // second copy built from the same numbers. This is what makes `__getValue`
  // worth its private-API cost: the same arithmetic can drift behind a
  // captured `track`; the same node cannot.
  const beeView = (() => {
    let found = null;
    walk(flyingBeeAst.program, (n) => {
      if (found || n.type !== 'JSXElement') return;
      const nm = n.openingElement.name;
      if (nm?.type !== 'JSXMemberExpression' || nm.property?.name !== 'View') return;
      const style = attrExpr(n.openingElement, 'style');
      if (style && flyingBeeSource.slice(style.start, style.end).includes('styles.bee')) found = n;
    });
    return found;
  })();
  const listenerCb = (() => {
    let found = null;
    walk(flyingBeeAst.program, (n) => {
      if (found || n.type !== 'CallExpression') return;
      if (n.callee?.type !== 'MemberExpression' || n.callee.property?.name !== 'addListener') return;
      found = n.arguments[0];
    });
    return found;
  })();
  const readNames = [];
  walk(listenerCb, (n) => {
    if (n.type !== 'CallExpression') return;
    if (n.callee?.type !== 'MemberExpression' || n.callee.property?.name !== '__getValue') return;
    if (n.callee.object?.type === 'Identifier') readNames.push(n.callee.object.name);
  });
  const renderNames = new Set();
  if (beeView) {
    const styleExpr = attrExpr(beeView.openingElement, 'style');
    walk(styleExpr, (n) => {
      if (n.type === 'Identifier') renderNames.add(n.name);
    });
    // One level of aliasing, and only through a RE-BINDING. The bee's opacity
    // is written `flightOpacity`, declared `presetOpacity ?? 1` — the same node
    // under a name that says what it is for, so the row must see through it or
    // it fails a correct file and teaches people to edit the gate.
    //
    // But `rotate` is declared `attitude ? t.interpolate({…}) : '0deg'`, and
    // expanding through THAT admits `t` — the parent value, which the render
    // does not draw with. Then a sampler that reads `t.__getValue()` and does
    // the interpolation arithmetic itself passes a row whose whole point is
    // that it must not: same numbers, different node, free to drift behind a
    // stale captured `track`. Found by mutating this row, not by reasoning
    // about it.
    //
    // So: expand only where the init CONSTRUCTS NOTHING. A declarator that
    // builds a new Animated node names a different node by definition; one
    // that just passes an identifier along names the same one.
    const CONSTRUCTS_A_NODE = /\.interpolate\s*\(|new\s+Animated\.|Animated\.(?:add|subtract|multiply|divide|modulo|diffClamp)\s*\(/;
    for (const name of [...renderNames]) {
      walk(flyingBeeAst.program, (n) => {
        if (n.type !== 'VariableDeclarator' || n.id?.name !== name || !n.init) return;
        if (CONSTRUCTS_A_NODE.test(flyingBeeSource.slice(n.init.start, n.init.end))) return;
        walk(n.init, (m) => {
          if (m.type === 'Identifier') renderNames.add(m.name);
        });
      });
    }
  }
  const unread = readNames.filter((n) => !renderNames.has(n));
  if (!beeView || !listenerCb) {
    bad(
      'the position sampler reads the nodes the render draws with',
      `could not locate ${!beeView ? 'the <Animated.View> carrying styles.bee' : 'an addListener callback in FlyingBee'} — CANNOT TELL`,
    );
  } else if (readNames.length === 0) {
    bad(
      'the position sampler reads the nodes the render draws with',
      'the listener callback calls `__getValue()` on nothing. Either it re-derives the interpolation in JS — which can drift from the transform behind a stale captured `track` — or it takes the callback argument, which is `t`, not a position.',
    );
  } else if (unread.length === 0) {
    ok(`the position sampler reads the nodes the render draws with (${[...new Set(readNames)].join(', ')} — all present in the bee's own transform)`);
  } else {
    bad(
      'the position sampler reads the nodes the render draws with',
      `\`${unread.join('`, `')}\` is read by the sampler but does not appear in the <Animated.View style={[styles.bee, …]}> the user sees. Same numbers is not the same node.`,
    );
  }

  // H3 — those nodes are memoised, and the effect depends on their IDENTITY.
  // Correct-by-dependency-array-coincidence is the failure mode here: rebuild
  // `translateX` in the render body and the listener holds whichever copy
  // existed when the effect last ran, which is right only for as long as two
  // hand-written dep arrays agree. Memoised, the node IS the dependency.
  //
  // This row's remedy is also §28.13's arming edit, so the remedy carries the
  // warning. Nowhere else in the suite can: the app-wide row would read "a
  // transform array whose nodes are all stable may not contain a varying plain
  // entry", and that is red on `CelebrationRays.js:74` today — a row that fails
  // a correct tree is a row people learn to edit. A failure message is not a
  // row. It costs no false red, and it reaches the person at the instant they
  // are holding the edit.
  //
  // It goes on the `notMemo` clause only. The `notDep` clause asks for a
  // dependency array, which arms nothing, and a warning about an edit somebody
  // is not making is noise. Scope, since it is the rule: this reaches whoever
  // memoises BECAUSE THIS ROW TOLD THEM TO. Whoever memoises for their own
  // reasons never sees it — for them the cover is §28.13 and the site comment
  // at `MascotBee.js:94`, which is the only place in `src/` where the edit
  // freezes real geometry.
  const memoised = new Set();
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier') return;
    if (n.init?.type === 'CallExpression' && n.init.callee?.name === 'useMemo') memoised.add(n.id.name);
  });
  const listenerEffectDeps = (() => {
    let deps = null;
    walk(flyingBeeAst.program, (n) => {
      if (deps || n.type !== 'CallExpression' || n.callee?.name !== 'useEffect') return;
      const body = n.arguments[0];
      let hasListen = false;
      walk(body, (m) => {
        if (m.type === 'CallExpression' && m.callee?.type === 'MemberExpression' && m.callee.property?.name === 'addListener') hasListen = true;
      });
      if (!hasListen) return;
      const arr = n.arguments[1];
      deps = arr?.type === 'ArrayExpression' ? arr.elements.filter((e) => e?.type === 'Identifier').map((e) => e.name) : null;
    });
    return deps;
  })();
  // Which of the sampled names actually sit in a `transform` array in this
  // file (Sage). COMPUTED per run from the AST rather than typed in, so it is
  // not a fact about the tree — it re-derives the day somebody moves a node,
  // which is the H4 argument applied to this row. The branch is not the unit
  // of scoping; the NAME is, because `notMemo` is a list whose members do not
  // share a hazard.
  //
  // Reference positions only. A property key and a member-expression property
  // are `Identifier` nodes that name nothing: `{ scale: slot.scale }` holds
  // three Identifiers and exactly one of them is a variable. Collecting all
  // three is R85's "prose about a variable is not the variable" one layer in
  // — the node type is right and the ROLE is wrong. Blind, this set carries
  // `pos`, `x`, `y`, `scale`, `driftX`, `driftY` off the particle array, and
  // a sampled node named any of those would take the clause without ever
  // being in a transform. Shorthand is safe either way: `{ rotate }` parses
  // key and value as distinct nodes (verified: 25 shorthand properties in this
  // file, `key === value` in none of them), so dropping the key keeps the
  // reference — which the bee's own array at the render depends on, since it
  // is 100% shorthand.
  //
  // WHAT THIS DOES NOT DO, because the caps above used to claim more than the
  // code performs (Sage): membership is matched BY NAME, NOT BY BINDING. No
  // scope resolution happens. `slot` is in the resulting set and it is the
  // `trailPool.map((slot, i) =>` PARAMETER at `:603`, not a component-scope
  // node — so a sampled node named `slot` would take the clause off a
  // different binding wearing the same name. Right role, wrong binding: one
  // step in from the role confusion this walk fixes. Left unresolved on
  // purpose — a parent-aware walk for a collision that needs somebody to name
  // a sampled node after a callback parameter is not worth the machinery, and
  // §28.12's precedent is to name residue rather than promise immunity.
  const inTransform = new Set();
  walk(flyingBeeAst.program, (n) => {
    if (n.type !== 'ObjectProperty') return;
    if ((n.key?.name ?? n.key?.value) !== 'transform') return;
    if (n.value?.type !== 'ArrayExpression') return;
    const notARef = new Set();
    walk(n.value, (m) => {
      if (m.type === 'ObjectProperty' && !m.computed) notARef.add(m.key);
      if (m.type === 'MemberExpression' && !m.computed) notARef.add(m.property);
    });
    walk(n.value, (m) => {
      if (m.type === 'Identifier' && !notARef.has(m)) inTransform.add(m.name);
    });
  });
  const notMemo = [...new Set(readNames)].filter((n) => !memoised.has(n));
  const notDep = [...new Set(readNames)].filter((n) => !(listenerEffectDeps ?? []).includes(n));
  // The arming clause, and its CANNOT-TELL case. Silence has to mean one
  // thing. Force the collector to gather nothing and the whole suite still
  // reports 77/0 (Sage) — every line of this predicate lives inside `bad()`,
  // so a passing run has no coverage of it at all. The reachable version of
  // that is a file the collector finds nothing in, at which point an absent
  // clause would read as the clean "none of these sit in a transform" when the
  // honest answer is "this row could not look." R73: the place a check
  // declines to have an opinion must not look like the place it has a clean
  // one.
  //
  // The sentence STATES WHAT THE TEST FOUND, never why (Sage). An earlier
  // draft said "no literal `transform: [...]` array was found in this file" —
  // a CAUSE, and only one of the two that produce `size === 0`. Make both
  // arrays literal-only and it reports no array in a file holding two, so the
  // verdict is right and the cause is invented. A MESSAGE THAT NAMES THE CAUSE
  // WILL DRIFT FROM THE PREDICATE; A MESSAGE THAT STATES WHAT THE TEST FOUND
  // CANNOT. Same words, true under both causes, cannot go stale.
  const arming = notMemo.filter((n) => inTransform.has(n));
  const armingClause = inTransform.size === 0
    ? ' §28.13 — CANNOT TELL whether memoising is also an arming edit: the membership test found no variable reference in any `transform: [...]` array in this file, so it has nothing to match against. Check by hand.'
    : arming.length
      ? ` §28.13 — \`${arming.join('`, `')}\` sits in a \`transform\` array, so memoising is also an ARMING edit: if it leaves EVERY node in a shared \`transform\` array identity-stable, every plain number in that array freezes at its first commit, and those have to become nodes in the same change.`
      : '';
  if (readNames.length === 0) {
    bad('the sampled nodes are memoised and are the effect\'s own dependencies', 'H2 found nothing being read, so this row cannot tell');
  } else if (listenerEffectDeps === null) {
    bad('the sampled nodes are memoised and are the effect\'s own dependencies', 'the listening useEffect has no literal dependency array — it re-subscribes every render, which is a different defect with the same symptom');
  } else if (notMemo.length === 0 && notDep.length === 0) {
    ok(`the sampled nodes are memoised and are the effect's own dependencies ([${listenerEffectDeps.join(', ')}])`);
  } else {
    bad(
      'the sampled nodes are memoised and are the effect\'s own dependencies',
      [
        // States what was checked — "is not declared by a useMemo" — never a
        // consequence. An earlier draft said "is rebuilt on every render",
        // which is false of a `useRef` and sent a mutation's diagnosis to the
        // wrong line.
        // The remedy's side effect, stated as the rule rather than as a fact
        // about this tree — "here `rotate` is rebuilt per render so you are
        // fine" would be a sentence that goes false the day somebody memoises
        // `rotate`, in the message that told them to.
        notMemo.length ? `\`${notMemo.join('`, `')}\` is not declared by a \`useMemo\` at component scope, so this row cannot show its identity is stable across renders.${armingClause}` : '',
        notDep.length ? `\`${notDep.join('`, `')}\` is not in the effect's deps [${listenerEffectDeps.join(', ')}], so the subscription outlives the node it samples.` : '',
      ].filter(Boolean).join(' '),
    );
  }
}

// --- H4. §28.2 — no tab-level scene transform over the pollinate mount ---
//
// The half of the origin residue that is opt-in, and therefore gateable.
//
// Measure-on-use (F2b) fixes a stale origin for anything Yoga can see. It
// cannot fix a NATIVELY DRIVEN ancestor transform, because `measureInWindow`
// reads the shadow tree and the native driver writes the layer — measured, 18
// samples of `y = 0` while a view slid 200pt. There are exactly two navigators
// over `HoneycombTab`'s `<FlyingBee>`:
//
//   * the ROOT stack (`App.js`, `@react-navigation/stack`). Its unfocused card
//     carries `translateUnfocused`, 0 -> `screen.width * -0.3`
//     (`CardStyleInterpolators.tsx:29-37`), driven with
//     `useNativeDriver: Platform.OS !== 'web'` (`Card.tsx:79`, `:251`). That is
//     UNCONDITIONAL and is what a stack is for — not gateable, and recorded in
//     §28.11 with its bound instead.
//   * this one, `MainTabs.js`. `hasAnimation` gates the whole tab transition on
//     `options.animation` / `options.transitionSpec`
//     (`BottomTabView.tsx:60-67`), and neither is set — so today there is no
//     second transform. It is one word away from there being one, on a
//     navigator the user crosses dozens of times a session rather than
//     occasionally, and that FREQUENCY is why this row is worth having while
//     the root stack's identical mechanism is only worth writing down.
//
// It asserts the BOUND, not the token. `animation: 'fade'` is opacity-only and
// cannot move this box; `'shift'` carries `translateX` ±50. A row that reds on
// both would be red about something it has no opinion on, and rows that fail
// correct trees teach people to edit the gate. So the row resolves the name
// through the INSTALLED library and CALLS the interpolator, rather than
// trusting a list typed here — which also means a library upgrade that gives
// `forFade` a transform turns this red on its own.
{
  const NAME = 'no tab-level scene transform over the pollinate mount (§28.2)';
  const MAIN_TABS = path.join(ROOT, 'src/navigation/MainTabs.js');
  const tabsSource = await readFile(MAIN_TABS, 'utf8');
  const tabsAst = parseJs(tabsSource);
  const named = [];
  walk(tabsAst.program, (n) => {
    if (n.type !== 'ObjectProperty' || !n.key) return;
    const k = n.key.name ?? n.key.value;
    if (!['animation', 'transitionSpec', 'sceneStyleInterpolator'].includes(k)) return;
    named.push({ key: k, node: n });
  });
  // Which named animations actually move the scene — asked of the installed
  // module by calling it, with `interpolate` stubbed so the returned style is
  // the shape the library would build.
  let moving = null;
  let interpolatorError = null;
  try {
    const mod = await import(
      path.join(ROOT, 'node_modules/@react-navigation/bottom-tabs/lib/module/TransitionConfigs/SceneStyleInterpolators.js')
    );
    const stub = { current: { progress: { interpolate: () => 'ANIMATED_NODE' } } };
    moving = new Map();
    for (const [exported, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function' || !exported.startsWith('for')) continue;
      const style = fn(stub)?.sceneStyle ?? {};
      const preset = exported.slice(3).toLowerCase();
      moving.set(preset, Object.prototype.hasOwnProperty.call(style, 'transform'));
    }
  } catch (e) {
    interpolatorError = e.message;
  }
  const offenders = [];
  for (const { key, node } of named) {
    if (key === 'transitionSpec') {
      // `transitionSpec` alone turns `hasAnimation` on but leaves
      // `sceneStyleInterpolator` at the `none` preset's `undefined`
      // (`BottomTabView.tsx:292-294`), so it animates a value no scene style
      // reads. Harmless for the origin — and stated rather than skipped,
      // because "the gate ignored it" and "the gate cleared it" must not
      // look the same.
      continue;
    }
    if (key === 'sceneStyleInterpolator') {
      offenders.push('`sceneStyleInterpolator` is set here, and this row cannot evaluate a function it did not resolve — CANNOT TELL, which is a fail');
      continue;
    }
    const v = node.value;
    if (v?.type !== 'StringLiteral') {
      offenders.push(`\`animation\` is set to a non-literal (${tabsSource.slice(v.start, v.end).replace(/\s+/g, ' ').slice(0, 60)}), so this row cannot resolve which interpolator runs — CANNOT TELL, which is a fail`);
      continue;
    }
    if (v.value === 'none') continue;
    if (!moving) {
      offenders.push(`\`animation: '${v.value}'\` is set and the installed interpolators could not be loaded (${interpolatorError}) — CANNOT TELL, which is a fail`);
      continue;
    }
    if (!moving.has(v.value)) {
      offenders.push(`\`animation: '${v.value}'\` does not resolve to an installed \`for${v.value.charAt(0).toUpperCase()}${v.value.slice(1)}\` interpolator, so this row cannot say whether it moves the scene — CANNOT TELL, which is a fail`);
      continue;
    }
    if (moving.get(v.value)) {
      offenders.push(`\`animation: '${v.value}'\` resolves to an interpolator that returns a \`transform\`, so every tab switch moves the bee's container by a transform the native driver writes straight to the layer — \`measureInWindow\` cannot see it and the origin is stale for the length of the transition (§28.11)`);
    }
  }
  if (offenders.length === 0) {
    const evidence = moving
      ? [...moving.entries()].map(([k, m]) => `${k}=${m ? 'moves' : 'opacity only'}`).join(', ')
      : 'installed interpolators not consulted';
    // Names what was FOUND, not just the verdict. "sets no scene-moving
    // animation" reads identically whether the file sets nothing or sets
    // `'fade'`, and those are different facts about the app.
    const found = named.length
      ? named.map(({ key, node }) => (node.value?.type === 'StringLiteral' ? `${key}: '${node.value.value}'` : key)).join(', ')
      : 'none set';
    ok(`${NAME} — MainTabs.js tab options [${found}]; none moves the scene (installed: ${evidence})`);
  } else {
    bad(NAME, offenders.join('; '));
  }
}

// --- I. §28.13 — a plain number sharing a transform array with a natively
//     driven node is frozen at its first commit ---------------------------
//
// Section H made `posRef` live, so the flight starts where the bee is. The
// particles it drops did not: every trail dot and every pollen fleck in the
// app rendered at the container's top-left corner, for as long as the pool
// has existed. Measured on device, 20 frames of ambient cruise: one 6.0 x 6.0
// pt `accentBurst` square at (2.8, 2.8) pt in 20 of 20 frames, and not one
// particle anywhere near the bee. The named glow of §17.3 R51 and the pollen
// of §20.7 have never been on a screen.
//
// The cause is two deliberate steps in RN 0.86.2, both measured in the
// running app rather than read:
//
//   1. `createAnimatedPropsMemoHook.js:162-189` builds the memo key that
//      decides whether to rebuild an `AnimatedProps` node from `AnimatedNode`
//      instances ONLY. A plain number becomes `null` in that key. Two styles
//      differing only in `translateX` (0 -> 211) compare
//      `areCompositeKeysEqual === true`, so the node is reused, forever.
//   2. `AnimatedTransform.js:147-156` bakes every non-node entry into the
//      native config as `{type: 'static', value}`. That config is generated
//      once, when the node goes native. Measured on a pool slot:
//      `{"type":"static","property":"translateX","value":0}`.
//
// The JS render path is fine — `__getValueWithStaticTransforms` reads the
// FRESH array every render — which is exactly why a state dump of the pool
// showed twelve correctly positioned particles while the screen showed one
// stack of them in the corner. The model was right. Only the native side was
// stale, and the native side is what you see.
//
// R89's shape, one layer over, and with the same tell: the initialiser
// happened to be the correct value at the only place anyone looked.
//
// WHAT THESE ROWS DO NOT CLAIM. A non-node entry is not a defect — it is a
// CONSTANT, and a constant baked once is correct. Whether a given expression
// is constant for the life of a mount is not decidable here, so I1 asserts
// only the part that is: an entry the file itself can be seen to CHANGE.
// The sites that are constant today by call-site coincidence rather than by
// construction (`MascotBee.js:94`'s hinge offsets, derived from a `size`
// prop no caller currently varies) are named in §28.13 instead, because a
// row that fails a correct tree is a row people learn to edit.
{
  const NAME = 'I1 §28.13 — no transform array mixes an Animated node with a value the file mutates';
  const offenders = [];
  let arrays = 0;
  let nodeArrays = 0;

  // Resolvably an Animated node: built by the Animated API, or an identifier
  // whose single declarator is. Deliberately conservative — an entry this
  // cannot call a node is simply treated as a plain value, which can only
  // make the row stricter, never blinder.
  const NODE_INIT = /new\s+Animated\.Value\s*\(|\.interpolate\s*\(|Animated\.(?:add|subtract|multiply|divide|modulo|diffClamp)\s*\(/;

  for (const file of [path.join(ROOT, 'App.js'), ...(await jsFiles(path.join(ROOT, 'src')))]) {
    const src = await readFile(file, 'utf8');
    if (!src.includes('transform:')) continue;
    const ast = parseJs(src);

    // Everything this file assigns to, by printed path: `slot.pos.x = 5`
    // records `slot.pos.x`, and `setPos(...)` records nothing (a setter's
    // name is not the value's name, so state is caught by its own rule).
    const mutated = new Set();
    const stateful = new Set();
    walk(ast.program, (n) => {
      if (n.type === 'AssignmentExpression' && n.left?.type === 'MemberExpression') {
        mutated.add(src.slice(n.left.start, n.left.end).replace(/\s+/g, ''));
      }
      // `const [x, setX] = useState(...)` — x changes by definition.
      if (
        n.type === 'VariableDeclarator' &&
        n.id?.type === 'ArrayPattern' &&
        n.init?.type === 'CallExpression' &&
        n.init.callee?.name === 'useState'
      ) {
        const first = n.id.elements[0];
        if (first?.type === 'Identifier') stateful.add(first.name);
      }
    });

    const declInit = new Map();
    walk(ast.program, (n) => {
      if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier' || !n.init) return;
      const prev = declInit.get(n.id.name);
      // Two declarators of one name is ambiguous — record the ambiguity
      // rather than the last one seen.
      declInit.set(n.id.name, prev === undefined ? src.slice(n.init.start, n.init.end) : null);
    });

    // Every dotted property path in this file that is declared holding an
    // Animated node, e.g. `pos.x` from `pos: { x: new Animated.Value(0) }`.
    //
    // The first draft of this row resolved a member expression through its
    // ROOT identifier's declarator, and `const slot = takeSlot()` appears
    // twice, so `slot` was ambiguous, nothing in the particle array resolved,
    // and the array was skipped as "contains no Animated node". The row then
    // reported a clean pass about an array it could not see — which is the
    // shape R73 named: the place a check declines to have an opinion must not
    // look like the place it has a clean one. Found by mutation: restoring the
    // exact defect this row exists for left it GREEN.
    const nodePaths = new Set();
    const collect = (obj, prefix) => {
      for (const p of obj.properties) {
        if (p.type !== 'ObjectProperty') continue;
        const key = p.key?.name ?? p.key?.value;
        if (key == null) continue;
        const dotted = prefix ? `${prefix}.${key}` : key;
        if (p.value?.type === 'ObjectExpression') collect(p.value, dotted);
        else if (NODE_INIT.test(src.slice(p.value.start, p.value.end))) nodePaths.add(dotted);
      }
    };
    walk(ast.program, (n) => {
      if (n.type === 'ObjectExpression') collect(n, '');
    });

    const isNode = (v) => {
      const text = src.slice(v.start, v.end);
      if (NODE_INIT.test(text)) return true;
      if (v.type === 'Identifier') {
        const init = declInit.get(v.name);
        return typeof init === 'string' && NODE_INIT.test(init);
      }
      if (v.type === 'MemberExpression') {
        // Match the longest property-path suffix, so `slot.pos.x` resolves
        // against `pos.x` without needing to know what `slot` is. The object
        // a pool hands out is described by the pool's own declaration, and
        // that is the thing worth reading.
        const parts = text.replace(/\s+/g, '').split('.');
        for (let i = 1; i < parts.length; i += 1) {
          if (nodePaths.has(parts.slice(i).join('.'))) return true;
        }
        return false;
      }
      return false;
    };

    walk(ast.program, (n) => {
      if (n.type !== 'ObjectProperty') return;
      if ((n.key?.name ?? n.key?.value) !== 'transform') return;
      if (n.value?.type !== 'ArrayExpression') return;
      arrays += 1;

      const entries = [];
      for (const el of n.value.elements) {
        if (el?.type !== 'ObjectExpression') continue;
        for (const p of el.properties) {
          if (p.type !== 'ObjectProperty') continue;
          entries.push({ prop: p.key?.name ?? p.key?.value, value: p.value });
        }
      }
      if (!entries.some((e) => isNode(e.value))) return;
      nodeArrays += 1;

      const rel = `${path.relative(ROOT, file)}:${n.loc.start.line}`;
      for (const e of entries) {
        if (isNode(e.value)) continue;
        const text = src.slice(e.value.start, e.value.end).replace(/\s+/g, ' ');
        const flat = text.replace(/\s+/g, '');
        if (mutated.has(flat)) {
          offenders.push(
            `${rel} \`${e.prop}: ${text}\` is not an Animated node and this file assigns to \`${flat}\` — it is baked into the native config once and every later write is invisible on screen (§28.13)`
          );
        } else if (e.value.type === 'Identifier' && stateful.has(e.value.name)) {
          offenders.push(
            `${rel} \`${e.prop}: ${text}\` is not an Animated node and \`${text}\` is React state — a re-render cannot rebuild the memoised AnimatedProps node, so the rendered value is frozen at the first commit (§28.13)`
          );
        }
      }
    });
  }

  if (offenders.length === 0) {
    ok(`${NAME} — ${nodeArrays} of ${arrays} transform arrays contain an Animated node; no non-node entry in them is written by its own file`);
  } else {
    bad(NAME, offenders.join('; '));
  }
}

{
  // I2 — the particle pool itself, named rather than inferred. I1 is a rule
  // about a shape; this is a rule about the one array that had the defect,
  // and it is stricter: EVERY entry is a node, so there is nothing left for
  // a future edit to make constant by accident.
  const NAME = 'I2 §28.13 — every entry of the particle transform is an Animated node';
  const src = await readFile(FLYING_BEE, 'utf8');
  const ast = parseJs(src);

  // What a slot holds, as dotted leaf paths, read off the pool declaration's
  // own object literal rather than by regex over its text. The first draft
  // matched `/new Animated.Value/` against the whole `pos: { … }` fragment,
  // so `pos: { x: 0, y: new Animated.Value(0) }` passed on the strength of
  // `y` — membership existential where the rule is universal, which is the
  // hole R83 already named once. Found by mutating half the defect in.
  let poolPaths = null;
  walk(ast.program, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id?.name !== 'trailPool' || !n.init) return;
    poolPaths = new Set();
    const collect = (obj, prefix) => {
      for (const p of obj.properties) {
        if (p.type !== 'ObjectProperty') continue;
        const key = p.key?.name ?? p.key?.value;
        if (key == null) continue;
        const dotted = prefix ? `${prefix}.${key}` : key;
        if (p.value?.type === 'ObjectExpression') collect(p.value, dotted);
        else if (/new\s+Animated\.Value\s*\(/.test(src.slice(p.value.start, p.value.end))) poolPaths.add(dotted);
      }
    };
    walk(n.init, (m) => {
      if (m.type === 'ObjectExpression') collect(m, '');
    });
  });

  const arrays = [];
  walk(ast.program, (n) => {
    if (n.type !== 'ObjectProperty') return;
    if ((n.key?.name ?? n.key?.value) !== 'transform') return;
    if (n.value?.type !== 'ArrayExpression') return;
    const entries = [];
    for (const el of n.value.elements) {
      if (el?.type !== 'ObjectExpression') continue;
      for (const p of el.properties) {
        if (p.type !== 'ObjectProperty') continue;
        entries.push({ prop: p.key?.name ?? p.key?.value, text: src.slice(p.value.start, p.value.end).replace(/\s+/g, '') });
      }
    }
    // The particle array is the one whose entries read off a pool slot. Found
    // by that property, not by a line number, so the row survives an edit
    // above it.
    if (entries.length && entries.every((e) => /^slot\./.test(e.text))) {
      arrays.push({ line: n.loc.start.line, entries });
    }
  });

  if (poolPaths === null) {
    bad(NAME, 'no `trailPool` declarator found in FlyingBee.js, so this row cannot resolve what a slot holds — CANNOT TELL, which is a fail');
  } else if (arrays.length !== 1) {
    bad(
      NAME,
      `expected exactly one transform array whose every entry reads a pool slot, found ${arrays.length}${arrays.length ? ` (lines ${arrays.map((a) => a.line).join(', ')})` : ' — the particle render may have been renamed, so this row cannot locate it, which is a fail'}`
    );
  } else {
    const [{ line, entries }] = arrays;
    // `slot.pos.x` must be declared at the leaf `pos.x`, not merely somewhere
    // under `pos`.
    const notNodes = entries.filter((e) => !poolPaths.has(e.text.split('.').slice(1).join('.')));
    if (notNodes.length) {
      bad(
        NAME,
        `FlyingBee.js:${line} — ${notNodes.map((e) => `\`${e.prop}: ${e.text}\``).join(', ')} does not resolve to an \`Animated.Value\` in the \`trailPool\` declaration, so it is baked into the native transform once (§28.13)`
      );
    } else {
      ok(`${NAME} — FlyingBee.js:${line}, ${entries.length} entries [${entries.map((e) => e.prop).join(', ')}], all resolving to Animated.Values in the pool`);
    }
  }
}

// =========================================================================
// J. §32 — the anti-repeat rule preserves a CHOICE, not a destination
// =========================================================================
//
// R121. `flightSequencer.js`'s own comment rejects "a shuffle of the full
// set, which would guarantee every anchor is visited once per cycle and
// reintroduce a period equal to the anchor count" — and at `n = depth + 1`
// the implementation WAS that shuffle, because blocking `n - 1` keys leaves a
// pool of exactly one. The rule was asserted only by that comment, which is
// how it stayed true in prose and false in code for a day.
//
// So this section asserts it as arithmetic, and it samples the function
// rather than reading the clamp: R81 — a sequencer is a generator of
// flights, so the only honest way to gate it is to sweep its seeds. Every
// row below runs the IMPORTED `chooseAnchor` and looks at what came out.
// Rewriting the clamp expression to something equivalent leaves every row
// green, which is the point; rewriting it to something weaker does not.
//
// THE BOUNDARY IS DERIVED, NOT LISTED. J4 and J5 do not assert "3 anchors
// work" — they measure where the behaviour changes and check that against
// arithmetic. A hardcoded pass-list has the hole it closes (R85(f)): raise
// `antiRepeatDepth` and a list of cases would keep passing while the
// invariant moved underneath it.
//
// Writing them that way immediately falsified the sentence they were written
// from. The first draft of H4 asserted the aperiodicity threshold is
// `depth + 2`, which is the invariant as stated in the module — and it went
// red at `depth 2: expected 4, observed 3`. That is the clamp working: it
// gives up DEPTH to keep a CHOICE, so aperiodicity arrives at three anchors
// for every depth, and `n >= depth + 2` is not the threshold for a choice —
// it is the threshold above which the requested depth is actually honoured.
// Two properties, so two rows. The prose that survived the correction is now
// H5's, and the module's own comment moved with it.
//
// WHAT THIS SECTION CANNOT DO, said because a silent gap reads like a clean
// one. `flightSequencer.js` still has no importer in `src/`, so no host
// declares an anchor set and there is nothing to check the invariant
// AGAINST. The row that matters most — "every render state a host declares
// supplies at least `antiRepeatDepth + 2` anchors" — cannot be written until
// a host declares one, and it is the row that turns this from a property of
// the engine into a property of the app. Sage's §4 rule, arriving as a
// missing row rather than as a mutation: A GATE ASSERTS A PROPERTY OF
// WHATEVER IT CAN IMPORT, AND THE DEFECT LIVES AT THE CALL SITE IT COULDN'T.
{
  const seqSource = await readFile(path.join(ROOT, 'src/components/flightSequencer.js'), 'utf8');
  const seq = await import(
    `data:text/javascript;base64,${Buffer.from(seqSource).toString('base64')}`
  );
  const { chooseAnchor, makeRng, STUB_GRAMMAR } = seq;
  // The depth under test comes from the module, so raising `antiRepeatDepth`
  // moves the boundary J4 asserts instead of leaving it pinned to a literal.
  const SHIPPED_DEPTH = STUB_GRAMMAR.antiRepeatDepth;
  const DEPTHS = [...new Set([1, 2, 3, SHIPPED_DEPTH])].sort((a, b) => a - b);
  const COUNTS = [2, 3, 4, 5, 6];
  const SEEDS = 256;
  const STEPS = 60;

  const anchorsOf = (n) =>
    Array.from({ length: n }, (_, i) => ({ key: String.fromCharCode(65 + i), x: i * 100, y: 0 }));

  // Walk exactly as `nextBeat` will: one `recent` list, appended and trimmed.
  const walk = (n, depth, seed) => {
    const anchors = anchorsOf(n);
    const rng = makeRng(seed);
    const recent = [];
    const out = [];
    for (let i = 0; i < STEPS; i += 1) {
      const a = chooseAnchor(anchors, recent, rng, depth);
      if (!a) return null;
      out.push(a.key);
      recent.push(a.key);
      if (recent.length > 8) recent.shift();
    }
    return out.join('');
  };

  // Smallest p for which the post-warmup tail repeats with period p, or null.
  // Capped at 12: a period longer than the anchor count is not a period a
  // viewer could see, and every count under test is well below it.
  const periodOf = (s) => {
    const tail = s.slice(20);
    for (let p = 1; p <= 12; p += 1) {
      let holds = true;
      for (let i = 0; i + p < tail.length; i += 1) {
        if (tail[i] !== tail[i + p]) {
          holds = false;
          break;
        }
      }
      if (holds) return p;
    }
    return null;
  };

  // Shortest gap between two visits of the same anchor. This is the depth the
  // run ACTUALLY enforced, read off the output — `minReturn - 1` keys were
  // blocked, whatever the clamp expression says.
  const minReturnGap = (s) => {
    const last = new Map();
    let min = Infinity;
    for (let i = 0; i < s.length; i += 1) {
      if (last.has(s[i])) min = Math.min(min, i - last.get(s[i]));
      last.set(s[i], i);
    }
    return min;
  };

  const sweep = new Map(); // `${n}:${depth}` -> { periods:Set, tails:Set, selfRepeats, minGap }
  for (const n of COUNTS) {
    for (const depth of DEPTHS) {
      const periods = new Set();
      const tails = new Set();
      let selfRepeats = 0;
      let minGap = Infinity;
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const s = walk(n, depth, seed * 7919);
        for (let i = 1; i < s.length; i += 1) if (s[i] === s[i - 1]) selfRepeats += 1;
        periods.add(periodOf(s));
        tails.add(s.slice(-12));
        minGap = Math.min(minGap, minReturnGap(s));
      }
      sweep.set(`${n}:${depth}`, { periods, tails, selfRepeats, minGap });
    }
  }
  const cases = COUNTS.length * DEPTHS.length * SEEDS;

  // --- J1: no anchor is ever chosen twice in a row -----------------------
  //
  // The row the floor of 1 exists for. `Math.min(depth, n - 2)` is 0 at two
  // anchors and `[..].slice(-0)` returns the WHOLE array, so an unfloored
  // clamp blocks everything, empties `eligible`, takes the `: anchors`
  // fallback and picks the incumbent 48.2% of the time — a dart, a descent
  // and a settle flown to the point the bee is already on.
  {
    const NAME = 'J1 §32 chooseAnchor never returns the incumbent, swept';
    const guilty = [];
    for (const [key, r] of sweep) if (r.selfRepeats > 0) guilty.push(`${key} (${r.selfRepeats})`);
    if (guilty.length) {
      bad(
        NAME,
        `n:depth pairs whose sequence repeats an anchor back-to-back — ${guilty.join(', ')}. ` +
          'A zero-length sortie flies the whole break-off gesture to where the bee already is. ' +
          'If the clamp was just changed, check the floor: `slice(-0)` returns the whole array.'
      );
    } else {
      ok(`${NAME} — ${cases} sequences x ${STEPS} beats, n ${COUNTS.join('/')} x depth ${DEPTHS.join('/')}, zero back-to-back`);
    }
  }

  // --- J2: above the invariant, the sequence is aperiodic ----------------
  {
    const NAME = 'J2 §32 no observable period at three anchors or more, any depth';
    const guilty = [];
    for (const n of COUNTS) {
      for (const depth of DEPTHS) {
        if (n < 3) continue; // two anchors is arithmetic — H3 owns it
        const { periods } = sweep.get(`${n}:${depth}`);
        const seen = [...periods].filter((p) => p !== null);
        if (seen.length) guilty.push(`n=${n} depth=${depth} -> period ${seen.join('/')}`);
      }
    }
    if (guilty.length) {
      bad(
        NAME,
        `the clamp should leave a pool of at least two at every n >= 3, whatever the depth asks for, but the tail repeats: ${guilty.join(', ')}`
      );
    } else {
      const distinct = [...sweep]
        .filter(([k]) => Number(k.split(':')[0]) >= 3)
        .reduce((min, [, r]) => Math.min(min, r.tails.size), Infinity);
      ok(`${NAME} — every (n, depth) with n >= 3 aperiodic over ${SEEDS} seeds; worst case still ${distinct} distinct 12-tails`);
    }
  }

  // --- J3: below the invariant, the degeneracy is DECLARED ---------------
  //
  // Stated positively, so silence means one thing. Two anchors with no
  // self-repeat is forced alternation — arithmetic, not a defect, and not
  // something the engine can repair. Asserting the period IS 2 means a
  // change that "fixes" it (by reintroducing self-repeats, the only way out)
  // fails here as well as at H1, instead of quietly looking like progress.
  {
    const NAME = 'J3 §32 two anchors alternate, and that is the documented floor';
    const { periods, tails } = sweep.get(`2:${SHIPPED_DEPTH}`);
    const seen = [...periods];
    if (seen.length === 1 && seen[0] === 2 && tails.size === 2) {
      ok(`${NAME} — n=2 depth=${SHIPPED_DEPTH}: period 2 on all ${SEEDS} seeds, ${tails.size} distinct tails (the two phases). A host declaring two anchors in a render state has declared a screensaver; the answer is on the host.`);
    } else {
      bad(
        NAME,
        `expected period 2 and exactly 2 distinct tails at two anchors, got periods [${seen.map((p) => (p === null ? 'none' : p)).join(', ')}] and ${tails.size} tails. ` +
          'Aperiodic here would mean the incumbent became eligible again — see H1.'
      );
    }
  }

  // --- J4: the choice threshold is 3, and it does NOT move with depth ----
  //
  // Derived rather than listed: for each depth, find the smallest anchor
  // count at which periodicity disappears. It is 3 for every depth, and that
  // independence IS the clamp — the requested depth is the thing that gives
  // way, never the pool. Raise `antiRepeatDepth` and this row must not move.
  {
    const NAME = 'J4 §32 the aperiodicity threshold is 3 and is independent of depth';
    const guilty = [];
    const found = [];
    for (const depth of DEPTHS) {
      const first = COUNTS.find((n) => [...sweep.get(`${n}:${depth}`).periods].every((p) => p === null));
      found.push(`depth ${depth} -> ${first ?? 'never'}`);
      if (first !== 3) {
        guilty.push(
          `depth ${depth}: expected 3, observed ${first ?? `no aperiodic count in ${COUNTS.join('/')}`}`
        );
      }
    }
    if (guilty.length) {
      bad(
        NAME,
        `${guilty.join('; ')}. A threshold that tracks depth means the clamp is honouring the requested depth at the pool's expense — the pre-R121 behaviour.`
      );
    } else {
      ok(`${NAME} — ${found.join(', ')}; depth gives way, the pool does not`);
    }
  }

  // --- J5: the requested depth IS honoured wherever it can be ------------
  //
  // The other half, and the one the module's invariant is actually about.
  // The enforced depth is read off the output — the shortest gap between two
  // visits of the same anchor is `enforced + 1` — and compared against the
  // clamp's arithmetic. So `n >= antiRepeatDepth + 2` earns its place as the
  // condition under which a host gets the anti-repeat it asked for, rather
  // than as a claim about whether the bee has anywhere to go.
  {
    const NAME = 'J5 §32 enforced anti-repeat depth = max(1, min(depth, n-2)), measured';
    const guilty = [];
    for (const n of COUNTS) {
      for (const depth of DEPTHS) {
        const expected = Math.max(1, Math.min(depth, n - 2));
        const observed = sweep.get(`${n}:${depth}`).minGap - 1;
        if (observed !== expected) {
          guilty.push(`n=${n} depth=${depth}: asked ${depth}, arithmetic says ${expected}, observed ${observed}`);
        }
      }
    }
    if (guilty.length) {
      bad(NAME, guilty.join('; '));
    } else {
      const full = COUNTS.filter((n) => n >= SHIPPED_DEPTH + 2);
      ok(`${NAME} — ${cases} sequences agree; at the shipped depth ${SHIPPED_DEPTH} the full depth is honoured from ${full[0]} anchors up (n >= antiRepeatDepth + 2), and traded down below that`);
    }
  }

  // --- J6: the flip boundary is `facingFor`'s, derived from both modules ---
  //
  // R122. `facingFlipRate` exists because the perch contract `{ key, on, at }`
  // does NOT make a spread out of nothing: every TodayTab anchor is a
  // full-width block in one padded column, so `on: 'left'` three times
  // resolves to one x and the bee flies a vertical line. The floor is the
  // point below which that is MECHANICAL — under one bee-box of x-extent no
  // pair can clear `facingFor`'s threshold, so the facing cannot change.
  //
  // Neither side of this row is typed. The boundary is found by sweeping
  // `facingFlipRate` until it leaves zero, and the thing it is compared
  // against is found by sweeping `facingFor` itself. Change the threshold in
  // `beeAttitude.js` and both move together; change only one and this goes
  // red, which is the whole reason the comparison is between two sweeps
  // rather than between a sweep and a literal.
  {
    const NAME = 'J6 §32 the anchor-spread floor is facingFor\'s own threshold, both swept';
    const SIZE = BEE_SIZE; // FlyingBee.js's DEFAULT_SIZE, read off source above
    let rateBoundary = null;
    for (let d = 0; d <= SIZE * 3 && rateBoundary === null; d += 1) {
      const rate = seq.facingFlipRate([{ key: 'a', x: 0, y: 0 }, { key: 'b', x: d, y: 300 }], SIZE);
      if (rate > 0) rateBoundary = d;
    }
    let facingBoundary = null;
    for (let d = 0; d <= SIZE * 3 && facingBoundary === null; d += 1) {
      if (facingFor(d, SIZE, -1) === 1) facingBoundary = d;
    }
    if (rateBoundary === null || facingBoundary === null) {
      bad(NAME, `no boundary inside 0..${SIZE * 3}px — rate ${rateBoundary}, facing ${facingBoundary}. ` +
        'One of the two sweeps never left its starting value, so this row cannot tell.');
    } else if (rateBoundary !== facingBoundary) {
      bad(NAME, `facingFlipRate first leaves zero at ${rateBoundary}px, facingFor first flips at ` +
        `${facingBoundary}px. The floor and the mechanism it is derived from disagree, so a set that ` +
        'passes the floor can still be one the bee never turns around in.');
    } else {
      ok(`${NAME} — both leave zero at ${rateBoundary}px (one ${SIZE}px box); below it every |dx| is ` +
        'under threshold, so no hop in the set can flip the facing');
    }
  }

  // --- J7: and that is true of the flights, not just of the arithmetic ----
  //
  // J6 compares two predicates. This one flies the real thing: a column set
  // and a spread set, through `buildPollinationPlan` and `buildAttitude`.
  //
  // THE EVENT IS BETWEEN SORTIES, NOT INSIDE ONE — and the first draft of this
  // row measured inside one. It summed `buildAttitude`'s `windows`, which is
  // that module's record of facing changes WITHIN a single flight, and a
  // sortie travels one way from takeoff to landing, so `windows` is 0 for
  // every well-formed sortie including the spread ones. The row went red on
  // its own control within a minute of being written, which is the only
  // reason it is not green and blind today. A bee turns around when the NEXT
  // sortie leaves the other way, so the sequence of sorties is the unit.
  //
  // The spread half is the control and it is the half that matters: a row
  // reporting "no turns" for both sets would pass the column half by being
  // blind rather than by the property holding.
  {
    const NAME = 'J7 §32 the observed turn boundary is the predicted one, x-extent swept';
    const SIZE = BEE_SIZE;
    const W = 393;
    const H = 852;
    const BODY = mascot.MASCOT_WIDTH_FRACTION * SIZE;
    const dart = EASINGS['Easing.inOut(Easing.ease)'];
    const settle = EASINGS['Easing.out(Easing.cubic)'];
    // Fly the real sequencer over the set for 60s and read the facing the
    // attitude builder actually lands on at each sortie. Chained, because the
    // question is whether consecutive sorties disagree.
    const turnsFor = (set) => {
      const grammar = seq.resolveGrammar({
        grammar: STUB_GRAMMAR,
        anchors: set,
        sortieDurationFor: (hopPx) => flight.buildPollinationPlan({
          from: { x: 0, y: 0 },
          target: { x: hopPx, y: 0 },
          ringStep: Infinity,
          bodyLengthPx: BODY,
          width: W,
          height: H,
          approachSpeedPxS: seq.referenceSpeedPxS(W, H) * seq.DART_SPEED_RATIO,
          easeApproach: dart,
          easeDescent: settle,
        }).durationMs,
      });
      const rng = makeRng(0xB33);
      const recent = [];
      let at = { x: set[0].x, y: set[0].y };
      let facing = null;
      let turns = 0;
      let sorties = 0;
      for (let i = 0; i < 40; i += 1) {
        const anchor = chooseAnchor(set, recent, rng, grammar.antiRepeatDepth);
        const plan = flight.buildPollinationPlan({
          from: at,
          target: { x: anchor.x, y: anchor.y },
          ringStep: Infinity,
          bodyLengthPx: BODY,
          width: W,
          height: H,
          approachSpeedPxS: seq.referenceSpeedPxS(W, H) * seq.DART_SPEED_RATIO,
          easeApproach: dart,
          easeDescent: settle,
        });
        const att = buildAttitude(plan.path, {
          width: W,
          height: H,
          size: SIZE,
          closed: false,
          easing: plan.easing,
          durationMs: plan.durationMs,
          // What the sequencer's plans have always carried and nothing read
          // until R122. Without it every sortie re-seeds from `Math.sign(dx)`
          // and the threshold is never consulted between plans.
          heldFacing: facing ?? undefined,
        });
        const landed = att.segments[att.segments.length - 1].facing;
        if (facing !== null && landed !== facing) turns += 1;
        facing = landed;
        sorties += 1;
        at = { x: anchor.x, y: anchor.y };
        recent.push(anchor.key);
        if (recent.length > 8) recent.shift();
      }
      return { turns, sorties };
    };
    // Three full-width cards on a 24pt gutter — Sage's case, and the one a
    // designer writing anchors in reading order actually produces. The middle
    // one's x is swept so the OBSERVED boundary is derived, not sampled at two
    // convenient points: two hand-picked sets would have been green through
    // the whole 8..43px band where the predicate said 0 and the bee turned 27
    // times.
    const setAt = (ext) => [
      { key: 'badge', x: 24, y: 120 },
      { key: 'streak', x: 24 + ext, y: 300 },
      { key: 'quote', x: 24, y: 520 },
    ];
    const rows = [];
    let observedBoundary = null;
    let predictedBoundary = null;
    for (let ext = 0; ext <= SIZE * 2; ext += 1) {
      const set = setAt(ext);
      const { turns, sorties } = turnsFor(set);
      const rate = seq.facingFlipRate(set, SIZE);
      if (turns > 0 && observedBoundary === null) observedBoundary = ext;
      if (rate > 0 && predictedBoundary === null) predictedBoundary = ext;
      rows.push({ ext, turns, sorties, rate });
    }
    const disagree = rows.filter((r) => (r.turns > 0) !== (r.rate > 0));
    if (observedBoundary === null || predictedBoundary === null) {
      bad(NAME, `no boundary inside 0..${SIZE * 2}px of x-extent — turns first appear at ` +
        `${observedBoundary}, rate first leaves zero at ${predictedBoundary}. One of the two never ` +
        'changed, so this row cannot tell.');
    } else if (disagree.length) {
      const w = disagree[0];
      bad(NAME, `${disagree.length} of ${rows.length} x-extents disagree with the predicate; first at ` +
        `extent ${w.ext}px, where facingFlipRate is ${w.rate} and the bee turned around ${w.turns} ` +
        `times in ${w.sorties} sorties. The floor predicts the flight or it is not a floor.`);
    } else {
      const top = rows[rows.length - 1];
      ok(`${NAME} — swept x-extent 0..${SIZE * 2}px in 1px steps: turns first appear at ` +
        `${observedBoundary}px and facingFlipRate first leaves zero at ${predictedBoundary}px, ` +
        `agreeing at all ${rows.length} extents (0 turns below, ${top.turns} in ${top.sorties} ` +
        'sorties at the top)');
    }
  }

  // --- J8: `heldFacing` is READ, not merely carried ----------------------
  //
  // J7's sweep is only true because `buildAttitude` now takes `heldFacing`.
  // Before R122 it did not, and the field was written by three plan builders,
  // threaded through `resolveBeat`, handed across the component boundary and
  // consumed by nothing, while `flightSequencer`'s own comment cited "its
  // `heldFacing` option" as the reason a perched bee keeps the facing he
  // arrived with. Nothing about a dead field looks dead.
  //
  // So this row does not check that the option EXISTS — an unread parameter
  // exists. It checks that passing the two facings produces two different
  // answers on a path whose own travel is below the threshold, which is the
  // only case where holding is distinguishable from re-seeding.
  {
    const NAME = 'J8 §32 buildAttitude consumes heldFacing, it does not just accept it';
    const SIZE = BEE_SIZE;
    const W = 393;
    const H = 852;
    // Below-threshold horizontal travel: the deadband, where the incoming
    // facing is the only thing that can decide the answer.
    const sub = SIZE * 0.25;
    const opts = { width: W, height: H, size: SIZE, closed: false, durationMs: 1000 };
    const p = [{ x: 0.5, y: 0.2 }, { x: 0.5 + sub / W, y: 0.8 }];
    const right = buildAttitude(p, { ...opts, heldFacing: 1 }).scaleXOutput;
    const left = buildAttitude(p, { ...opts, heldFacing: -1 }).scaleXOutput;
    const bare = buildAttitude(p, opts).scaleXOutput;
    const carried = seq.buildPerchPlan({
      at: { x: 200, y: 400 }, width: W, height: H, durationMs: 3000, heldFacing: -1,
    }).heldFacing;
    if (carried !== -1) {
      bad(NAME, `buildPerchPlan dropped heldFacing (carried ${carried}). The consumer below is fine ` +
        'and the producer is not, so a sequenced bee still snaps.');
    } else if (right.every((v, i) => v === left[i])) {
      bad(NAME, `heldFacing +1 and -1 produce the same scaleX (${JSON.stringify(right)}) on ` +
        `${sub.toFixed(1)}px of travel — below the ${SIZE}px threshold, so the seed is the only ` +
        'input. The option is accepted and discarded.');
    } else if (!left.every((v) => v === -1) || !right.every((v) => v === 1)) {
      bad(NAME, `heldFacing did not hold through sub-threshold travel: +1 gave ` +
        `${JSON.stringify(right)}, -1 gave ${JSON.stringify(left)}. facingFor's deadband is not ` +
        'reaching segment 0.');
    } else {
      ok(`${NAME} — on ${sub.toFixed(1)}px of travel (under the ${SIZE}px threshold) heldFacing +1 ` +
        `holds right and -1 holds left; with none passed the base case still reads its own sign ` +
        `(${JSON.stringify(bare)}), so existing call sites are unchanged`);
    }
  }
}

// =========================================================================
// K. The declared anchor sets (§32.2)
// =========================================================================
//
// This is the section J said it could not write. Its own comment read:
//
//   "`flightSequencer.js` still has no importer in `src/`, so no host declares
//    an anchor set and there is nothing to check the invariant AGAINST. The
//    row that matters most cannot be written until a host declares one, and it
//    is the row that turns this from a property of the engine into a property
//    of the app."
//
// A host declares one now. Section J proves things about `chooseAnchor` for
// synthetic anchor sets swept over n and depth; this section proves the sets
// the app actually ships are ones J's conclusions apply to. Neither is
// redundant and the split is Sage's §4 rule: J asserts a property of what it
// can import, K goes to the call sites it couldn't.
//
// The anchors are read out of the JSX rather than out of a table, because the
// table was the defect. Deezine's guide carried a per-state anchor count,
// Sage found it wrong within the hour (it counted affordances against a rule
// written in structural terms and missed the footer), and both of us then
// published corrections to a document nothing checks. `<PerchAnchor>` makes
// the count a consequence of the render tree; this section reads the same
// tree, so a drift between the two is not possible rather than merely
// unlikely.
console.log('\nK. the declared anchor sets (§32.2)');

const PERCH_HOSTS = [
  {
    file: 'src/screens/TodayTab.js',
    // Deezine's §32/R122 constraint, and on this screen it is load-bearing
    // rather than stylistic — every anchor is a full-width card in one padded
    // column, so the side is the ONLY thing that gives the set any x-extent.
    sidesOnly: true,
    // The column the full-width anchors live in, from the screen's own
    // `content` style. Read, not retyped: change the padding and the extent
    // this section computes moves with it.
    paddingStyle: 'content',
  },
  {
    file: 'src/screens/HoneycombTab.js',
    sidesOnly: false,
    paddingStyle: 'content',
  },
];

// The content column's horizontal insets, read off the screen's own
// stylesheet. Returns both edges rather than one number because the extent
// this section computes is left-edge to right-edge, and React Native lets the
// two differ (`paddingLeft` beats `paddingHorizontal` beats `padding`, most
// specific wins — the same precedence, in the same order, or the row measures
// a column the screen does not have).
const readPaddingH = (src, styleName) => {
  const block = src.match(new RegExp(`\\n  ${styleName}: \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? '';
  const value = (prop) => {
    const m = block.match(new RegExp(`(?:^|\\n)\\s*${prop}:\\s*([A-Za-z][\\w.]*|\\d+(?:\\.\\d+)?)`));
    if (!m) return null;
    if (/^\d/.test(m[1])) return Number(m[1]);
    // `theme.spacing.lg` and friends — resolved through the theme rather than
    // retyped, so a change to the scale moves this row with it.
    const key = m[1].split('.').pop();
    const t = themeSource.match(new RegExp(`\\n\\s*${key}: (\\d+)`));
    return t ? Number(t[1]) : null;
  };
  const all = value('padding');
  const horiz = value('paddingHorizontal');
  const left = value('paddingLeft') ?? horiz ?? all;
  const right = value('paddingRight') ?? horiz ?? all;
  return left === null || right === null ? null : { left, right };
};

const themeSource = await readFile(path.join(ROOT, 'src/constants/theme.js'), 'utf8');

// --- read every <PerchAnchor> off every host, with whether it is conditional
const perchSets = new Map();
for (const host of PERCH_HOSTS) {
  const src = await readFile(path.join(ROOT, host.file), 'utf8');
  const ast = parseJs(src);
  const anchors = [];
  // Parent chain, so "is this anchor inside a conditional arm" is answered by
  // structure rather than by a regex over indentation.
  const stack = [];
  const descend = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(descend);
    if (typeof node.type !== 'string') {
      for (const k of Object.keys(node)) if (k !== 'loc' && !k.endsWith('Comments')) descend(node[k]);
      return;
    }
    stack.push(node);
    if (node.type === 'JSXOpeningElement' && node.name?.name === 'PerchAnchor') {
      const props = {};
      node.attributes.forEach((a) => {
        if (a.type !== 'JSXAttribute') return;
        const v = a.value;
        props[a.name.name] =
          v === null ? true : v.type === 'StringLiteral' ? v.value : v.expression?.value;
      });
      // Conditional iff any ancestor is a ternary or a `&&` — that is what
      // makes an anchor present in some render states and absent in others,
      // and it is the whole of how the per-state count is derived here.
      const conditional = stack.some(
        (a) => a.type === 'ConditionalExpression' || a.type === 'LogicalExpression',
      );
      anchors.push({ ...props, line: node.loc.start.line, conditional });
    }
    for (const k of Object.keys(node)) if (k !== 'loc' && !k.endsWith('Comments')) descend(node[k]);
    stack.pop();
  };
  descend(ast.program);
  perchSets.set(host.file, { host, src, anchors, paddingH: readPaddingH(src, host.paddingStyle) });
}

// --- K1. every cruise mount has a set, and every set is readable ----------
{
  const cruiseHosts = CALL_SITES.filter((s) => s.preset === null && s.source);
  const missing = cruiseHosts.filter((s) => (perchSets.get(s.file)?.anchors.length ?? 0) === 0);
  if (missing.length === 0 && cruiseHosts.length === perchSets.size) {
    ok(
      `every cruise mount declares its own anchors (${cruiseHosts
        .map((s) => `${path.basename(s.file)} ${perchSets.get(s.file).anchors.length}`)
        .join(', ')})`,
    );
  } else {
    bad(
      'every cruise mount declares its own anchors',
      missing.length
        ? `${missing.map((s) => s.file).join(', ')} mounts <FlyingBee> with no <PerchAnchor> anywhere in the file`
        : `${cruiseHosts.length} cruise mounts but ${perchSets.size} anchor hosts — this section's host table has drifted from the call sites`,
    );
  }
}

// --- K2. ids are unique and sides are legal ------------------------------
//
// The id is `chooseAnchor`'s anti-repeat key. Two anchors sharing one is a bee
// that thinks it has already been to a place it has never been — the memory
// silently blocks the wrong destination, and nothing anywhere else would show
// it. The side is R122: `resolvePerchPoint` accepts only 'left' and 'right',
// and anything else resolves to the left edge without complaint.
for (const [file, { anchors, host }] of perchSets) {
  const ids = anchors.map((a) => a.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const badSides = anchors.filter((a) => !['left', 'right'].includes(a.on));
  const badAt = anchors.filter((a) => !(typeof a.at === 'number' && a.at >= 0 && a.at <= 1));
  if (dupes.length === 0 && badSides.length === 0 && badAt.length === 0) {
    ok(
      `${path.basename(file)} declares ${anchors.length} anchors, ids unique, sides legal ` +
        `(${anchors.map((a) => `${a.id}:${a.on}@${a.at}`).join(', ')})`,
    );
  } else {
    bad(
      `${path.basename(file)} anchors have unique ids and legal sides`,
      `${dupes.length ? `duplicate ids: ${[...new Set(dupes)].join(', ')} — the anti-repeat memory is keyed on this; ` : ''}` +
        `${badSides.length ? `bad sides: ${badSides.map((a) => `${a.id}=${a.on}`).join(', ')} (resolvePerchPoint silently reads anything but 'right' as the left edge); ` : ''}` +
        `${badAt.length ? `bad fractions: ${badAt.map((a) => `${a.id}=${a.at}`).join(', ')}` : ''}`,
    );
  }
}

// --- K3. the worst render state still clears the floor -------------------
//
// The floor is two, and it is `chooseAnchor`'s rather than a taste call: below
// it there is nowhere to go that is not where he already is. Derived from the
// module, so raising the floor there moves this row.
//
// The worst state is the one where every conditional anchor is absent, and
// that is computed from the JSX rather than declared: an anchor inside a
// ternary or a `&&` is one the user can make disappear.
//
// It is DELIBERATELY CONSERVATIVE and that is worth saying, because the count
// it prints is not the count any flying state has. On TodayTab the all-absent
// state is the error arm, which the ruling gives no bee at all — so this row
// asserts the floor holds even in a state that never flies. Teaching it about
// suppression would make it agree with K6 about which states matter, and two
// rows that have to agree are one row with a way to disagree.
for (const [file, { anchors }] of perchSets) {
  const always = anchors.filter((a) => !a.conditional);
  const FLOOR = 2;
  if (always.length >= FLOOR) {
    ok(
      `${path.basename(file)} clears the anchor floor in its worst render state ` +
        `(${always.length} unconditional of ${anchors.length}; floor ${FLOOR})`,
    );
  } else {
    bad(
      `${path.basename(file)} clears the anchor floor in its worst render state`,
      `only ${always.length} of ${anchors.length} anchors render unconditionally ` +
        `(conditional: ${anchors.filter((a) => a.conditional).map((a) => a.id).join(', ')}). ` +
        'Below two the bee flies a zero-length sortie to the point he is already standing on, ' +
        'which is worse than the loop this replaced — and the state that does it is a state a user reaches.',
    );
  }
}

// --- K4. the set is not a column -----------------------------------------
//
// SAGE'S FALSIFICATION OF MY OWN CONTRACT, AS A ROW. I argued the collinearity
// problem dissolved for free once anchors were sides rather than centres; it
// does not, because TodayTab's anchors are full-width blocks in ONE padded
// column, so choosing 'left' for all of them puts every anchor on the same x.
// A CONTRACT WHOSE SAFE USE DEPENDS ON TASTE IS NOT A CONTRACT.
//
// The floor is derived, not chosen: `facingFor` flips the mirror at one bee
// box of horizontal travel, so a set whose entire x-extent is under `size`
// contains no hop that can turn the bee around — he flies every sortie of
// every session facing the same way. That is J6/J7's threshold, reused here
// against the sets the app ships instead of against a sweep.
for (const [file, { anchors, paddingH }] of perchSets) {
  const SIZE = constants.DEFAULT_SIZE;
  const device = DEVICES.reduce((a, b) => (a.width <= b.width ? a : b));
  if (paddingH === null) {
    bad(
      `${path.basename(file)} anchor set spans at least one bee box in x`,
      "could not read the content column's paddingHorizontal from the screen's stylesheet — " +
        'the extent below would be computed against a padding this gate invented.',
    );
    continue;
  }
  // A full-width anchor's frame in the content column. The badge and the
  // header actions are narrower than this and sit at its RIGHT edge, so
  // modelling every anchor as full-width is exact for the left/right x this
  // row is about, and does not flatter the result.
  const frame = {
    x: paddingH.left,
    y: 0,
    width: device.width - paddingH.left - paddingH.right,
    height: 100,
  };
  // BOTH the full set and the set a user cannot make disappear. The second is
  // the one that matters and it is the one a hand-written row would omit: my
  // first draft checked only the full set, and a mutation that put three of
  // TodayTab's four anchors in one column stayed GREEN because the fourth —
  // the conditional badge — still carried the whole extent by itself. An
  // x-extent that depends on an anchor some render state removes is an extent
  // that some render state does not have. Same shape as K3's floor: THE
  // INVARIANT IS ABOUT THE WORST STATE, NOT THE DECLARED SET.
  const subsets = [
    { label: 'all', set: anchors },
    { label: 'unconditional only', set: anchors.filter((a) => !a.conditional) },
  ];
  const measure = (set) => {
    const pts = set.map((a, i) => ({
      key: a.id,
      x: sequencer.resolvePerchPoint(frame, a.on, a.at).x,
      y: i * 100,
    }));
    const xs = pts.map((p) => p.x);
    return {
      extent: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
      sides: new Set(set.map((a) => a.on)),
      flipRate: sequencer.facingFlipRate(pts, SIZE),
    };
  };
  const results = subsets.map((s) => ({ ...s, ...measure(s.set) }));
  const failed = results.filter((r) => !(r.extent >= SIZE && r.sides.size === 2 && r.flipRate > 0));
  if (failed.length === 0) {
    ok(
      `${path.basename(file)} anchor set spans at least one bee box in x on the ${device.label} ` +
        `(${results.map((r) => `${r.label}: ${r.extent.toFixed(0)}pt, flipRate ${r.flipRate.toFixed(3)}`).join('; ')})`,
    );
  } else {
    bad(
      `${path.basename(file)} anchor set spans at least one bee box in x`,
      failed
        .map(
          (r) =>
            `${r.label}: extent ${r.extent.toFixed(1)}pt against a ${SIZE}pt bee box, ` +
            `sides ${[...r.sides].join('/') || '(none)'}, facingFlipRate ${r.flipRate === null ? 'null' : r.flipRate.toFixed(3)}`,
        )
        .join('; ') +
        '. Every anchor on this screen is a full-width block in one column, so the side is the only ' +
        'thing giving the set any x-extent — put them all on one side and the bee never turns around. ' +
        'An "unconditional only" failure means the extent exists but rests on an anchor a render state removes.',
    );
  }
}

// --- K5. a sortie between the declared anchors is flyable ----------------
//
// The rows above are about the SET. This one flies it: resolve a real beat
// between the two extreme anchors, through the same `resolveBeat` the
// component calls, and check the attitude the bee wears getting there. A set
// can satisfy every structural rule above and still produce a flight that
// banks past the readable limit, and that is the failure only a resolved plan
// can show.
for (const [file, { anchors, paddingH }] of perchSets) {
  if (paddingH === null) continue;
  const SIZE = constants.DEFAULT_SIZE;
  const device = DEVICES.reduce((a, b) => (a.width <= b.width ? a : b));
  const frame = {
    x: paddingH.left,
    y: 0,
    width: device.width - paddingH.left - paddingH.right,
    height: 100,
  };
  const pts = anchors.map((a, i) => {
    const p = sequencer.resolvePerchPoint({ ...frame, y: 80 + i * 140 }, a.on, a.at);
    return { key: a.id, x: p.x, y: p.y };
  });
  const grammar = sequencer.resolveGrammar({
    grammar: sequencer.STUB_GRAMMAR,
    anchors: pts,
    sortieDurationFor: (hop) =>
      flight.buildPollinationPlan({
        from: { x: 0, y: 0 },
        target: { x: hop, y: 0 },
        ringStep: Infinity,
        bodyLengthPx: mascot.MASCOT_WIDTH_FRACTION * SIZE,
        width: device.width,
        height: device.height,
        approachSpeedPxS: sequencer.referenceSpeedPxS(device.width, device.height) * sequencer.DART_SPEED_RATIO,
        easeApproach: (w) => w,
        easeDescent: (w) => w,
      }).durationMs,
  });
  if (!grammar) {
    bad(
      `${path.basename(file)} resolves a dwell for its own anchor set`,
      'resolveGrammar returned null — fewer than two anchors, or an airborne target outside (0,1). ' +
        'The host would render no bee at all.',
    );
    continue;
  }
  // Fly every ordered pair, not a chosen one: R81's rule, and the pair that
  // banks worst is not the pair anyone would pick by hand.
  const banks = [];
  let unflyable = null;
  for (const from of pts) {
    for (const to of pts) {
      if (from === to) continue;
      const plan = sequencer.resolveBeat({
        beat: { state: 'sortie', anchor: to },
        from,
        width: device.width,
        height: device.height,
        bodyLengthPx: mascot.MASCOT_WIDTH_FRACTION * SIZE,
        grammar,
        easings: { dart: (w) => w, settle: (w) => w, hover: (w) => w },
        builders: {
          buildPollinationPlan: flight.buildPollinationPlan,
          composeSegmentEasing: flight.composeSegmentEasing,
        },
        heldFacing: 1,
      });
      if (!plan) {
        unflyable = `${from.key} -> ${to.key}`;
        break;
      }
      const a = buildAttitude(plan.path, {
        width: device.width,
        height: device.height,
        size: SIZE,
        closed: false,
        easing: (w) => w,
        durationMs: plan.durationMs,
        heldFacing: 1,
      });
      banks.push(...a.rotateOutput.map((d) => Math.abs(d)));
    }
  }
  const worst = banks.length ? Math.max(...banks) : Infinity;
  const LIMIT = 22;
  if (!unflyable && worst <= LIMIT + 1e-9) {
    ok(
      `${path.basename(file)} every ordered anchor pair resolves a flyable sortie ` +
        `(${pts.length * (pts.length - 1)} pairs, worst bank ${worst.toFixed(2)}° <= ${LIMIT}°, ` +
        `solved dwell ${(grammar.perchMs[0] / 1000).toFixed(2)}-${(grammar.perchMs[1] / 1000).toFixed(2)}s)`,
    );
  } else {
    bad(
      `${path.basename(file)} every ordered anchor pair resolves a flyable sortie`,
      unflyable
        ? `resolveBeat returned null for ${unflyable}`
        : `worst bank ${worst.toFixed(2)}° exceeds the ${LIMIT}° readable limit`,
    );
  }
}

// --- K6. the two ratified suppressions are still wired -------------------
//
// Both are BEHAVIOUR REMOVALS that Lumen ratified on 2026-08-17, and both are
// one expression at a call site. That is the right shape and it is also the
// easy shape to delete by accident while doing something else, at which point
// a bee reappears over the week feed or over failure copy and nothing fails.
// A removal that was argued for deserves a row.
{
  const rows = [
    {
      file: 'src/screens/HoneycombTab.js',
      want: /perches=\{hiveView === 'week' \? null : perches\}/,
      what: "week view gets no bee (a feed is for reading)",
    },
    {
      file: 'src/screens/TodayTab.js',
      want: /perches=\{error \? null : perches\}/,
      what: 'the error arm gets no bee (a mascot doing laps over failure copy performs cheerfulness at failure)',
    },
  ];
  const broken = rows.filter((r) => !r.want.test(perchSets.get(r.file).src));
  if (broken.length === 0) {
    ok(`both ratified suppressions are wired at their call sites (${rows.map((r) => r.what).join('; ')})`);
  } else {
    bad(
      'both ratified suppressions are wired at their call sites',
      `${broken.map((r) => `${path.basename(r.file)}: ${r.what}`).join('; ')} — the guard is gone and the ` +
        'bee is back on a surface a ruling took it off.',
    );
  }
}

// --- K7. a cascade step the bee cannot reach -----------------------------
//
// SAGE'S FINDING, AS A ROW (2026-08-17). K1-K6 all read the DECLARED set —
// they enumerate `PerchAnchor` nodes and measure them. So they are blind in
// exactly one direction: a screen that grows a new top-level region carrying
// no anchor stays green, because the thing that is missing is the thing the
// collector enumerates. `fizz/private-hives-rails` adds an unconditional
// `<StaggeredItem index={3}>` shelf to TodayTab with no anchor in it; the
// merge is one trivial conflict hunk in the `useState` block, so the half
// that needs a decision is the half git resolves silently.
//
// A GATE THAT ENUMERATES X CANNOT SEE A MISSING X. So this row asserts the
// direction the others cannot:
//
//   every top-level `StaggeredItem` on a screen that declares a perch set
//   is contained by a `PerchAnchor`, or contains one that renders in EVERY
//   state the step itself renders in.
//
// That last clause is not decoration — see `anchorsInEveryState` below for
// the green-and-wrong shape it exists to catch.
//
// ONE DIRECTION, NOT A BIJECTION, and the difference is not a detail. The
// obvious reading is Bumble's `check-migration-sentinels` shape, which
// checks both ways — but he needs both because his sentinel table is a
// SECOND COPY of the migration list, and either copy can drift. The anchor
// set is not a copy of anything; `PerchAnchor.js`'s header says it outright
// ("THE ANCHOR SET IS NOT A TABLE, IT IS THE RENDER TREE"). An anchor for a
// region that does not render cannot exist, because the anchor IS the
// region. So the converse has no content to assert, and asserting it anyway
// is red on a correct tree: measured on this branch, TodayTab declares 3
// cascade steps and 4 anchors — the badge sits in `ScreenHeader`'s `right`
// slot with no cascade step of its own — and HoneycombTab declares 3
// anchors and no cascade at all. A bijection reds four times on the tree it
// lands on. A RULE MUST BE STATED IN THE DIRECTION THAT HAS CONTENT.
//
// WHY `StaggeredItem` AND NOT "every child of the content container": the
// general rule is false. HoneycombTab's scroll content has many direct
// children that are legitimately not anchors (the controls, the feed, the
// week list Lumen ratified as perch-only at the toggle), so a row demanding
// an anchor per child would be red on a screen that is correct. What
// `StaggeredItem` marks is narrower and is the right thing: a deliberate
// cascade step — a region the designer already declared arrives on its own
// and reads as a place. That is the same population the bee should be able
// to visit.
//
// NO EXEMPTION LIST, and that is a considered refusal rather than an
// omission. There are zero exemptions today, so a list would be AN EMPTY
// LIST WITH A DOOR IN IT (R83, where I declined one for the same reason).
// The deeper argument is §32.2's own: the anchor set is the render tree,
// not a table. Putting the NEGATIVE in a table reintroduces exactly the
// drift `PerchAnchor` was built to remove — a row saying "this shelf is
// deliberately unreachable" would sit in this file, outlive the shelf, and
// nobody reading the screen would ever see it. If a cascade step must be
// exempt, that belongs at the call site where a reviewer meets it, and it
// arrives with the ruling that justifies it.
{
  const hostSteps = [];
  for (const [file, { src }] of perchSets) {
    const ast = parseJs(src);
    const steps = [];
    const stack = [];
    // An anchor makes the region reachable whether it is INSIDE the step or
    // WRAPS it — both are live shapes in this repo (TodayTab nests the anchor
    // inside; HoneycombTab wraps `HoneycombGrid` from outside). Checking only
    // the subtree would red on a correct screen.
    //
    // PRESENCE ONLY. This one answers "is there an anchor down there at all",
    // which is not the property the row asserts — it exists so a failure can
    // name WHICH defect it found (no anchor, or an anchor on some renders).
    const hasAnchorSomewhere = (node) => {
      let found = false;
      const walk = (n) => {
        if (found || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === 'JSXOpeningElement' && n.name?.name === 'PerchAnchor') {
          found = true;
          return;
        }
        for (const k of Object.keys(n)) if (k !== 'loc' && !k.endsWith('Comments')) walk(n[k]);
      };
      walk(node);
      return found;
    };
    // AN ANCHOR IS ONLY AN ANCHOR IN THE STATES IT RENDERS IN.
    //
    // Sage's second finding (2026-08-17), and it is K3's and K4's lesson
    // arriving a third time inside the row I wrote BECAUSE of it: THE
    // INVARIANT IS ABOUT THE WORST RENDER STATE, NOT THE DECLARED SET. The
    // obvious way to anchor the hive shelf is to do it only when there is
    // something on it —
    //
    //     {hives.length > 0
    //        ? <PerchAnchor id="hive-shelf" …><View style={styles.hiveShelf}/></PerchAnchor>
    //        : <View style={styles.hiveShelf}/>}
    //
    // — and a presence walk finds the anchor and goes green. The state it is
    // wrong in is `hives.length === 0`: the first-run state, which is the
    // exact state the shelf ruling turned on. The row built to catch that
    // region would have passed the version of it that ships the defect.
    //
    // So `anchored` is not "an anchor exists below". It is: AN ANCHOR RENDERS
    // IN EVERY STATE THIS STEP RENDERS IN. Descending through a
    // `ConditionalExpression` therefore costs BOTH arms, and a
    // `LogicalExpression` is never certain, because its JSX operand is
    // precisely the one that may not render.
    //
    // THIS IS A DIFFERENT QUESTION FROM THE `conditional` FLAG BELOW, and the
    // footer proves they must stay two questions. `conditional` describes the
    // step's OWN ancestry — whether the `StaggeredItem` is itself inside a
    // branch. Index 2 is a conditional step holding an unconditional anchor,
    // which is CORRECT and must stay green. This asks about the path BETWEEN
    // the step and its anchor. Collapsing them would red the footer.
    //
    // WHAT IT CANNOT SEE: a branch that is not syntax. A component that
    // declines to render its children (`<Modal visible={x}>`) hides the same
    // hole behind a prop, and no AST walk reaches it. Neither host does that
    // today; if one ever does, this row will say yes and be wrong, and the
    // honest place to catch it is the call site.
    //
    // AN ANCHOR IN BOTH ARMS PASSES THIS ROW, AND YOU SHOULD STILL NOT WRITE
    // ONE. Both arms carrying an anchor does mean one renders in every state,
    // so a green here is correct — but the only spelling that gets there
    // gives ONE REGION TWO IDENTITIES, because written the natural way (one
    // region, one name) K2 reds on `duplicate ids: hive-shelf` (measured, not
    // reasoned: Sage's correction to a note of mine that stopped one step
    // short). And `PerchAnchor.js:117` says what two identities cost — the
    // anti-repeat memory is keyed on `id`, so two names for one place are two
    // places to `chooseAnchor`. Hoist the anchor ABOVE the ternary: one id,
    // unconditional, and the question does not arise.
    //
    // K3 DISAGREES WITH THIS ROW ON THAT SHAPE, AND THE DISAGREEMENT IS
    // FAIL-SAFE, WHICH IS WHY THERE IS NO ROW JOINING THEM. K3 measures each
    // anchor's own conditionality, so it cannot see that a pair is jointly
    // total and reads `2 unconditional of 6` where this row reads reachable.
    // That is an UNDERCOUNT against a `>= FLOOR` assertion, and an undercount
    // there can only ever produce a false RED — a conversation. This row's
    // old defect ran the other direction, which is what made it worth an
    // evening. Naming the direction is the point: "these two disagree" invites
    // a reconciliation, and the reconciliation is the row not to build.
    const anchorsInEveryState = (n) => {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some(anchorsInEveryState);
      if (n.type === 'JSXElement' && n.openingElement?.name?.name === 'PerchAnchor') return true;
      if (n.type === 'ConditionalExpression') {
        return anchorsInEveryState(n.consequent) && anchorsInEveryState(n.alternate);
      }
      if (n.type === 'LogicalExpression') return false;
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k.endsWith('Comments')) continue;
        if (anchorsInEveryState(n[k])) return true;
      }
      return false;
    };
    const descend = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(descend);
      if (typeof node.type !== 'string') {
        for (const k of Object.keys(node)) if (k !== 'loc' && !k.endsWith('Comments')) descend(node[k]);
        return;
      }
      stack.push(node);
      if (node.type === 'JSXElement' && node.openingElement?.name?.name === 'StaggeredItem') {
        const idxAttr = node.openingElement.attributes.find(
          (a) => a.type === 'JSXAttribute' && a.name.name === 'index',
        );
        // UPWARD, DOMINANCE IS FREE — and the asymmetry with the subtree walk
        // above is the point, not an oversight. If a `PerchAnchor` is an
        // ANCESTOR of the step, then every state in which the step renders is
        // a state in which the anchor rendered, because nothing renders
        // without its ancestors. A branch between them decides only whether
        // the STEP renders, and a step that does not render needs nowhere to
        // land. Downward that implication fails, which is why the walk below
        // the step counts branch nodes and this one does not.
        const wrapped = stack.some(
          (a) =>
            a !== node &&
            a.type === 'JSXElement' &&
            a.openingElement?.name?.name === 'PerchAnchor',
        );
        steps.push({
          line: node.openingElement.loc.start.line,
          index: idxAttr?.value?.expression?.value ?? idxAttr?.value?.value ?? '?',
          anchored: wrapped || anchorsInEveryState(node),
          // Not the verdict — the discriminator that lets the failure say
          // which of the two defects this step has.
          anchorSomewhere: wrapped || hasAnchorSomewhere(node),
          conditional: stack.some(
            (a) => a !== node && (a.type === 'ConditionalExpression' || a.type === 'LogicalExpression'),
          ),
        });
      }
      for (const k of Object.keys(node)) if (k !== 'loc' && !k.endsWith('Comments')) descend(node[k]);
      stack.pop();
    };
    descend(ast.program);
    hostSteps.push({ file, steps });

    const orphans = steps.filter((s) => !s.anchored);
    if (steps.length === 0) {
      // VACUOUS, AND IT SAYS SO. A host with no cascade steps has nothing for
      // this rule to bind to, and a silent `ok` here would read exactly like a
      // host that was checked and found clean. CANNOT TELL MUST NOT LOOK LIKE
      // A CLEAN NO.
      ok(
        `${path.basename(file)} declares no cascade steps, so the reachability rule is vacuous here ` +
          '(its anchors are declared directly, not as StaggeredItem children) — checked nothing, and says so',
      );
    } else if (orphans.length === 0) {
      ok(
        `${path.basename(file)} every cascade step reaches an anchor in every state it renders in ` +
          `(${steps.map((s) => `index ${s.index}${s.conditional ? ' (conditional step)' : ''}`).join(', ')})`,
      );
    } else {
      // TWO DEFECTS, NAMED APART. "No anchor" and "an anchor on some renders"
      // are fixed by different edits, and the second is the one that looks
      // finished, so a message that merged them would send the reader to the
      // wrong place.
      const detail = orphans
        .map(
          (s) =>
            `index ${s.index} at :${s.line}` +
            `${s.conditional ? ' (conditional step)' : ''} — ` +
            (s.anchorSomewhere
              ? 'its anchor is inside a branch, so it is absent in at least one render state'
              : 'no anchor at all'),
        )
        .join('; ');
      bad(
        `${path.basename(file)} every cascade step reaches an anchor in every state it renders in`,
        `${orphans.length} of ${steps.length} cascade step(s) fail: ${detail}. ` +
          'A top-level StaggeredItem is a region that reads as a place on the screen, and one the bee ' +
          'cannot reach is dead surface — the other K rows cannot see this, because what is missing is ' +
          'the node they enumerate. An anchor that renders only on some states is the same defect wearing ' +
          'a green face: it is absent exactly in the state it is absent in, and that state is usually the ' +
          'empty one a new user sees first. Either anchor it unconditionally, or land the ruling that says ' +
          'it is deliberately unreachable, at the call site where a reviewer meets it.',
      );
    }
  }

  // THE ROW MUST BIND SOMEWHERE. Every per-host branch above can pass by
  // being vacuous, so without this the whole section could go green on a tree
  // where `StaggeredItem` had been renamed and nothing was being checked at
  // all — green by blindness rather than by the property holding.
  const bound = hostSteps.reduce((n, h) => n + h.steps.length, 0);
  if (bound > 0) {
    ok(
      `the cascade-step reachability rule is exercised: ${bound} step(s) across ` +
        `${hostSteps.filter((h) => h.steps.length).length} of ${hostSteps.length} perch host(s)`,
    );
  } else {
    bad(
      'the cascade-step reachability rule is exercised on at least one host',
      'no <StaggeredItem> was found on any perch host, so every branch above passed vacuously. ' +
        'Either the cascade component was renamed and this row is now looking for a node that no ' +
        'longer exists, or the hosts changed shape — in both cases this row is asserting nothing.',
    );
  }
}

console.log(`\ncheck-bee-attitude: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
