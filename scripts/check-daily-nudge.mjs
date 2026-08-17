// Gate for the Daily Nudge, half A (`PLANS/DAILY_NUDGE_SPEC.md` §6).
//
//   npm run check:daily-nudge
//
// SCOPE, STATED BEFORE THE ROWS. Half A ships `src/services/nudgeWindow.js`,
// `src/services/dailyNudge.js`, `App.js`'s wiring, `app.json`, and
// `src/constants/nudgeCopy.js`. It does NOT ship the Celebration "yes"
// handler (`Onboarding.js`, half B, blocked on `pixel/one-door` merging) or
// a settings row (unclaimed by either half as of this PR). §6 rows 2 and 8
// each need a call site that lives in one of those two places, so this gate
// reports them as PENDING — printed loudly, counted in neither the pass nor
// the fail tally — rather than skipped silently or faked green. A gate
// written against a call site that does not exist yet would either lie
// (pass on an empty search) or ship as a standing red nobody can fix from
// this PR, and `check-bee-attitude.mjs`'s header is right that a standing
// red trains everyone to read past the red slot. PENDING is the third state
// that keeps this gate honest without doing either.
//
// The copy row (new here, not in §6's numbered list, because §7 is a "what
// this spec does not decide" section, not §6) is the same shape as rows 2/8
// in reverse: the call site exists (`App.js`'s `rearmDailyNudge`), but the
// value it would ship is a deliberately-unshippable sentinel
// (`src/constants/nudgeCopy.js`). That row FAILS ON PURPOSE until Deezine's
// real strings land — §7: "half A does not ship without it."
//
// `scripts/run-checks.mjs` enumerates `scripts/check-*.mjs` off disk — there
// is no separate registration step, and no way for this file to opt itself
// out of the aggregate suite while still existing here. So merging this PR
// turns the shared suite's count from N/N to (N+1) gates, one of them red,
// until the copy PR lands — not hidden, not a SKIP (`run-checks.mjs`'s own
// header: "a SKIP must be one somebody ASKED for", which this is not), a
// real and correctly-attributed red. Flagged to the channel rather than
// decided here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WINDOW_MODULE = path.join(ROOT, 'src/services/nudgeWindow.js');
const SERVICE_MODULE = path.join(ROOT, 'src/services/dailyNudge.js');
const APP_JS = path.join(ROOT, 'App.js');
const COPY_MODULE = path.join(ROOT, 'src/constants/nudgeCopy.js');

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

const importModule = async (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

// Which top-level function (if any) a given AST position falls inside, by
// walking outward from every function declaration/expression and recording
// the [start, end) ranges it owns. Used by rows 2, 3 and 5a — "does this
// call sit inside that function" is a containment question, not a string
// match.
const enclosingFunctions = (ast) => {
  const fns = [];
  walk(ast.program, (n) => {
    if (
      n.type === 'FunctionDeclaration' ||
      n.type === 'FunctionExpression' ||
      n.type === 'ArrowFunctionExpression'
    ) {
      fns.push({ node: n, start: n.start, end: n.end, name: n.id?.name ?? null });
    }
  });
  // Name an anonymous function/arrow from its VariableDeclarator, which is
  // how every export in this codebase's services is written
  // (`export const foo = async () => {...}`).
  walk(ast.program, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) {
      const fn = fns.find((f) => f.node === n.init);
      if (fn) fn.name = n.id.name;
    }
  });
  return fns;
};

const smallestEnclosing = (fns, pos) => {
  let best = null;
  for (const fn of fns) {
    if (pos >= fn.start && pos < fn.end) {
      if (!best || fn.end - fn.start < best.end - best.start) best = fn;
    }
  }
  return best;
};

// Smallest enclosing function that has a NAME — skips past an inline
// `.map()`/`.filter()` callback to the named function it lives inside. Row
// 5a's question is "does the same logical function do both the enumerate
// and the cancel", and `reconcile`'s cancel call sits inside
// `ours.map((request) => cancel(...))` — the literal smallest enclosing
// node is that anonymous arrow, which is an implementation detail of
// `reconcile`, not a second function the spec's row is asking about.
const namedEnclosing = (fns, pos) => {
  let best = null;
  for (const fn of fns) {
    if (fn.name && pos >= fn.start && pos < fn.end) {
      if (!best || fn.end - fn.start < best.end - best.start) best = fn;
    }
  }
  return best;
};

const importShapes = (ast) => {
  const hits = [];
  const decls = ast.program.body.filter((n) => n.type === 'ImportDeclaration');
  hits.push(...decls.map((n) => `import '${n.source.value}'`));
  walk(ast.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.type === 'Import') hits.push('dynamic import()');
    if (n.type === 'CallExpression' && n.callee?.name === 'require') hits.push(`require(${n.arguments[0]?.value ?? '?'})`);
  });
  return hits;
};

const allSrc = new Map();
for (const file of [APP_JS, ...(await jsFiles(path.join(ROOT, 'src')))]) {
  allSrc.set(file, await readFile(file, 'utf8'));
}

const serviceSrc = allSrc.get(SERVICE_MODULE);
const serviceAst = parseJs(serviceSrc);
const windowSource = await readFile(WINDOW_MODULE, 'utf8');

// dailyNudge.js imports real RN/Expo native modules
// (`@react-native-async-storage/async-storage`, `expo-notifications`) — it
// is the service module, not a leaf, and cannot be `import()`-ed by this
// gate's data:-URL loader (nor should it be: §6 row 6/6a's whole point is
// that ONLY `nudgeWindow.js` promises that property). So everything this
// gate needs from dailyNudge.js — its exported function names and its
// exported constant literals — is read statically off the AST instead of by
// executing the module.
const serviceMod = (() => {
  const functionNames = new Set();
  const constants = {};
  walk(serviceAst.program, (n) => {
    if (n.type !== 'ExportNamedDeclaration' || n.declaration?.type !== 'VariableDeclaration') return;
    for (const decl of n.declaration.declarations) {
      if (decl.id?.type !== 'Identifier' || !decl.init) continue;
      if (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') {
        functionNames.add(decl.id.name);
      } else if (decl.init.type === 'NumericLiteral' || decl.init.type === 'StringLiteral') {
        constants[decl.id.name] = decl.init.value;
      }
    }
  });
  walk(serviceAst.program, (n) => {
    if (n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'FunctionDeclaration' && n.declaration.id) {
      functionNames.add(n.declaration.id.name);
    }
  });
  return { functionNames, ...constants };
})();

// =========================================================================
// A. The permission ask is fused (§2)
// =========================================================================
console.log('\nA. the permission ask is fused');

{
  const exportsFn = serviceMod.functionNames.size > 0;
  if (exportsFn) {
    ok('row 1 — dailyNudge.js resolves and exports at least one function');
  } else {
    bad('row 1 — dailyNudge.js resolves and exports at least one function', 'no function export found — nothing below has anything to walk from');
  }

  // Row 2/3 — find every call to requestPermissionsAsync anywhere in src/,
  // and for each, which function (if any) contains it.
  const callSites = [];
  for (const [file, src] of allSrc) {
    let ast;
    try {
      ast = parseJs(src);
    } catch {
      continue;
    }
    const fns = enclosingFunctions(ast);
    walk(ast.program, (n) => {
      if (
        n.type === 'CallExpression' &&
        n.callee?.type === 'MemberExpression' &&
        n.callee.property?.name === 'requestPermissionsAsync'
      ) {
        callSites.push({ file, pos: n.start, line: n.loc.start.line, enclosing: smallestEnclosing(fns, n.start) });
      }
    });
  }

  if (callSites.length === 1) {
    ok(`row 2a — requestPermissionsAsync appears in exactly one place in src/ (${path.relative(ROOT, callSites[0].file)}:${callSites[0].line})`);
  } else {
    bad(
      'row 2a — requestPermissionsAsync appears in exactly one place in src/',
      callSites.length === 0
        ? 'zero call sites found'
        : `${callSites.length} call sites: ${callSites.map((c) => `${path.relative(ROOT, c.file)}:${c.line}`).join(', ')}`,
    );
  }

  if (callSites.length === 1) {
    const site = callSites[0];
    if (site.enclosing?.name === 'requestPermissionAndEnable') {
      ok(`row 2b — the call sits inside requestPermissionAndEnable (walked from the call site, ${path.relative(ROOT, site.file)}:${site.line})`);
    } else {
      bad(
        'row 2b — the call sits inside a named, exported fuse function',
        `enclosing function is ${site.enclosing?.name ?? '(module level / anonymous)'}`,
      );
    }

    // Row 3 — never inside a useEffect callback or bare at module level.
    let insideUseEffect = false;
    const siteAst = parseJs(allSrc.get(site.file));
    walk(siteAst.program, (n) => {
      if (n.type !== 'CallExpression' || n.callee?.name !== 'useEffect') return;
      if (site.pos >= n.start && site.pos < n.end) insideUseEffect = true;
    });
    if (!site.enclosing) {
      bad('row 3 — requestPermissionsAsync is not called at module level or inside useEffect', 'call site has no enclosing function — it is a bare module-level statement, the mount-time defect §2 exists to prevent');
    } else if (insideUseEffect) {
      bad('row 3 — requestPermissionsAsync is not called at module level or inside useEffect', `${path.relative(ROOT, site.file)}:${site.line} sits inside a useEffect callback`);
    } else {
      ok('row 3 — requestPermissionsAsync sits inside a named function, not a useEffect body or a bare module-level statement');
    }
  }

  // Row 2c — a real caller. Half A ships no Celebration screen yet
  // (`pixel/one-door`, half B), so there is nothing in src/ that calls
  // `requestPermissionAndEnable` by name. PENDING, not a fail: the fuse
  // function is correctly shaped and correctly the only caller of the
  // native API; it simply has no caller of its own yet.
  //
  // A CALL SITE, not a substring match — App.js's own comments name
  // `requestPermissionAndEnable` in prose (documenting that it is NOT yet
  // called), and `src.includes(...)` cannot tell a comment from a call. It
  // did not, in an earlier draft of this gate: this row misreported PASS
  // off that exact comment before being caught.
  const fuseCallers = [];
  for (const [file, src] of allSrc) {
    if (file === SERVICE_MODULE) continue;
    let ast;
    try {
      ast = parseJs(src);
    } catch {
      continue;
    }
    let calls = false;
    walk(ast.program, (n) => {
      if (n.type !== 'CallExpression') return;
      if (n.callee?.type === 'Identifier' && n.callee.name === 'requestPermissionAndEnable') calls = true;
      if (n.callee?.type === 'MemberExpression' && n.callee.property?.name === 'requestPermissionAndEnable') calls = true;
    });
    if (calls) fuseCallers.push(path.relative(ROOT, file));
  }
  if (fuseCallers.length > 0) {
    ok(`row 2c — requestPermissionAndEnable is called from a real call site (${fuseCallers.join(', ')})`);
  } else {
    pend(
      'row 2c — requestPermissionAndEnable is called from the Celebration "yes" handler',
      "no caller yet — Onboarding.js's Celebration screen is half B, blocked on pixel/one-door merging (spec's ratified split). Re-run this gate once that PR lands and expect this row to resolve to pass or fail.",
    );
  }
}

// =========================================================================
// B. Blast radius (§4)
// =========================================================================
console.log('\nB. blast radius');

{
  // Row 4 — zero cancelAll call sites, absence enumerated.
  const cancelAllSites = [];
  for (const [file, src] of allSrc) {
    if (!src.includes('cancelAllScheduledNotificationsAsync')) continue;
    let ast;
    try {
      ast = parseJs(src);
    } catch {
      continue;
    }
    walk(ast.program, (n) => {
      if (n.type === 'CallExpression' && n.callee?.property?.name === 'cancelAllScheduledNotificationsAsync') {
        cancelAllSites.push(`${path.relative(ROOT, file)}:${n.loc.start.line}`);
      }
    });
  }
  if (cancelAllSites.length === 0) {
    ok('row 4 — zero cancelAllScheduledNotificationsAsync call sites in src/ + App.js');
  } else {
    bad('row 4 — zero cancelAllScheduledNotificationsAsync call sites', cancelAllSites.join(', '));
  }

  // Row 5a — every function containing cancelScheduledNotificationAsync
  // also contains getAllScheduledNotificationsAsync. Walked from the call
  // site's enclosing function, not by variable name.
  const fns = enclosingFunctions(serviceAst);
  const cancelSites = [];
  walk(serviceAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.property?.name === 'cancelScheduledNotificationAsync') {
      cancelSites.push({ pos: n.start, line: n.loc.start.line, enclosing: namedEnclosing(fns, n.start) });
    }
  });
  const getAllSites = [];
  walk(serviceAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.property?.name === 'getAllScheduledNotificationsAsync') {
      getAllSites.push({ pos: n.start, enclosing: namedEnclosing(fns, n.start) });
    }
  });
  if (cancelSites.length === 0) {
    bad('row 5a — every function that cancels also enumerates first', 'no cancelScheduledNotificationAsync call site found — the reconciler is missing its cancel step');
  } else {
    const bads = cancelSites.filter(
      (c) => !getAllSites.some((g) => g.enclosing?.node === c.enclosing?.node),
    );
    if (bads.length === 0) {
      ok(`row 5a — every function containing cancelScheduledNotificationAsync also contains getAllScheduledNotificationsAsync (${cancelSites.length} cancel site${cancelSites.length > 1 ? 's' : ''}, function ${cancelSites[0].enclosing?.name})`);
    } else {
      bad(
        'row 5a — every function containing cancelScheduledNotificationAsync also contains getAllScheduledNotificationsAsync',
        bads.map((b) => `dailyNudge.js:${b.line} in ${b.enclosing?.name ?? '(module level)'}`).join('; '),
      );
    }
  }

  // Row 5b — the AsyncStorage key set is EXACTLY the hour key and the
  // enabled key. Collected as string literals passed to AsyncStorage
  // get/set, not as a re-typed list — a third key anywhere in this file is
  // the ledger growing back.
  const storageKeys = new Set();
  walk(serviceAst.program, (n) => {
    if (
      n.type !== 'CallExpression' ||
      n.callee?.type !== 'MemberExpression' ||
      n.callee.object?.name !== 'AsyncStorage'
    ) {
      return;
    }
    const method = n.callee.property?.name;
    if (method !== 'getItem' && method !== 'setItem' && method !== 'removeItem') return;
    const arg = n.arguments[0];
    if (arg?.type === 'StringLiteral') {
      storageKeys.add(arg.value);
    } else if (arg?.type === 'Identifier') {
      // Resolve a same-file const to its literal so `HOUR_STORAGE_KEY` counts.
      walk(serviceAst.program, (m) => {
        if (m.type === 'VariableDeclarator' && m.id?.name === arg.name && m.init?.type === 'StringLiteral') {
          storageKeys.add(m.init.value);
        }
      });
    } else {
      storageKeys.add(`(unresolved: ${arg?.type})`);
    }
  });
  const expectedKeys = new Set([serviceMod.HOUR_STORAGE_KEY, serviceMod.ENABLED_STORAGE_KEY].filter(Boolean));
  const unexpected = [...storageKeys].filter((k) => !expectedKeys.has(k));
  if (unexpected.length === 0 && storageKeys.size === expectedKeys.size) {
    ok(`row 5b — AsyncStorage keys in dailyNudge.js are exactly {${[...storageKeys].join(', ')}}`);
  } else {
    bad(
      'row 5b — AsyncStorage keys in dailyNudge.js are exactly the hour key and the enabled key',
      `found {${[...storageKeys].join(', ')}}, expected {${[...expectedKeys].join(', ')}} — a third key is the persistence ban (§4.5) silently un-ruling itself`,
    );
  }
}

// =========================================================================
// C. The window skips written days (§4.2/§6 row 6) — the row that matters
// =========================================================================
console.log('\nC. the window builder, sampled');

{
  const ast = parseJs(windowSource);
  const hits = importShapes(ast);
  if (hits.length === 0) {
    ok('row 6a — nudgeWindow.js has zero imports (import declarations, require(), dynamic import() — all three shapes checked)');
  } else {
    bad('row 6a — nudgeWindow.js has zero imports', hits.join(', '));
  }
}

const windowMod = await importModule(windowSource);
const { buildWindow } = windowMod;

// A minimal, deterministic addDays for the gate's own sweep — integers, not
// calendar dates. `today` and `writtenDays` share this key-space; the
// module does not know or care that the real app uses YYYY-MM-DD strings.
const gateAddDays = (d, n) => d + n;

const runSweep = (windowDays, buildWindowFn = buildWindow) => {
  const cases = [
    { label: 'none written', written: [] },
    { label: 'first index written', written: [0] },
    { label: 'last index written', written: [windowDays - 1] },
    { label: 'middle index written', written: [Math.floor(windowDays / 2)] },
    { label: 'all written', written: Array.from({ length: windowDays }, (_, i) => i) },
  ];
  return cases.map((c) => ({
    ...c,
    result: buildWindowFn({ today: 0, writtenDays: c.written, windowDays, addDays: gateAddDays }),
  }));
};

{
  const WINDOW_DAYS = serviceMod.WINDOW_DAYS;
  if (typeof WINDOW_DAYS !== 'number') {
    bad('row 7 — WINDOW_DAYS is read off the service module, not typed into the gate', `dailyNudge.js does not export a numeric WINDOW_DAYS (got ${WINDOW_DAYS})`);
  } else {
    const runs = runSweep(WINDOW_DAYS);
    const violations = runs.filter((r) => r.result.some((day) => r.written.includes(day)));
    if (violations.length === 0) {
      ok(`row 6 — no scheduled date falls on a written day, swept across ${runs.length} cases at WINDOW_DAYS=${WINDOW_DAYS} (first/last/middle/all/none)`);
    } else {
      bad(
        'row 6 — no scheduled date falls on a written day',
        violations.map((v) => `${v.label}: scheduled ${JSON.stringify(v.result)} against written ${JSON.stringify(v.written)}`).join('; '),
      );
    }

    const tooLong = runs.filter((r) => r.result.length > WINDOW_DAYS);
    if (tooLong.length === 0) {
      ok(`row 7 — the window never exceeds WINDOW_DAYS (${WINDOW_DAYS}) across the same ${runs.length} swept cases`);
    } else {
      bad('row 7 — the window never exceeds WINDOW_DAYS', tooLong.map((r) => `${r.label}: length ${r.result.length}`).join('; '));
    }

    // -------------------------------------------------------------------
    // E. the cap as a guard rail (§4.4, §0.1(7))
    // -------------------------------------------------------------------
    console.log('\nE. the cap as a guard rail');
    const PENDING_HEADROOM = serviceMod.PENDING_HEADROOM;
    const worstCase = runs.find((r) => r.label === 'none written').result.length;
    if (typeof PENDING_HEADROOM !== 'number') {
      bad('row 9 — pending count worst case is within a stated headroom', 'dailyNudge.js does not export a numeric PENDING_HEADROOM');
    } else if (worstCase > PENDING_HEADROOM) {
      bad(
        'row 9 — pending count worst case (no day written) is within PENDING_HEADROOM',
        `worst case ${worstCase} > headroom ${PENDING_HEADROOM} — someone widened the window toward a cap this module does not own`,
      );
    } else if (PENDING_HEADROOM >= 64) {
      bad('row 9 — PENDING_HEADROOM is well under the reported 64 per-app cap (§0.1(7))', `PENDING_HEADROOM=${PENDING_HEADROOM} is not under 64`);
    } else {
      ok(`row 9 — worst-case pending (${worstCase}, no day written) is within PENDING_HEADROOM (${PENDING_HEADROOM}), itself well under the reported 64 cap (§0.1(7), unverifiable first-hand — see dailyNudge.js's header)`);
    }
  }
}

// =========================================================================
// D. Live-state honesty (§5/§6 row 8)
// =========================================================================
console.log('\nD. live-state honesty');
{
  // No settings row exists in src/ yet — neither half A nor half B's stated
  // scope includes one. PENDING, for the same reason row 2c is: the thing
  // this row checks has no call site to walk yet.
  //
  // A CALL SITE, not a substring match — same class of bug row 2c had:
  // `src.includes('getPermissionState')` would match a comment naming the
  // function without a component ever calling it.
  const settingsCandidates = [];
  for (const [file, src] of allSrc) {
    if (file === SERVICE_MODULE) continue;
    let ast;
    try {
      ast = parseJs(src);
    } catch {
      continue;
    }
    let calls = false;
    walk(ast.program, (n) => {
      if (n.type !== 'CallExpression') return;
      if (n.callee?.type === 'Identifier' && n.callee.name === 'getPermissionState') calls = true;
      if (n.callee?.type === 'MemberExpression' && n.callee.property?.name === 'getPermissionState') calls = true;
    });
    if (calls) settingsCandidates.push(path.relative(ROOT, file));
  }
  if (settingsCandidates.length > 0) {
    ok(`row 8 — a component references dailyNudge.getPermissionState (${settingsCandidates.join(', ')}) — re-check manually that it is the one rendering the switch`);
  } else {
    pend(
      "row 8 — the settings row's rendered switch derives from a live permission read, not a stored preference alone",
      'no settings row exists in src/ yet — unclaimed by half A or half B\'s stated scope. dailyNudge.js exports getPermissionState() (a live, non-prompting read) for whichever PR builds the row to call.',
    );
  }
}

// =========================================================================
// F. No Supabase, no network (C12, Sage)
// =========================================================================
console.log('\nF. the notification service touches no network');
{
  const badImports = serviceAst.program.body.filter(
    (n) => n.type === 'ImportDeclaration' && /supabase/i.test(n.source.value),
  );
  let fetchCalls = 0;
  walk(serviceAst.program, (n) => {
    if (n.type === 'CallExpression' && n.callee?.name === 'fetch') fetchCalls += 1;
  });
  if (badImports.length === 0 && fetchCalls === 0) {
    ok('the notification service imports no Supabase client and makes no network call (dailyNudge.js keeps the legal-copy "no analytics, crash-reporting or tracking code" sentence true by construction)');
  } else {
    bad(
      'the notification service imports no Supabase client and makes no network call',
      `supabase imports: ${badImports.map((n) => n.source.value).join(', ') || 'none'}; fetch() call sites: ${fetchCalls}`,
    );
  }
}

// =========================================================================
// G. The copy is not the unowned sentinel (§7)
// =========================================================================
console.log('\nG. copy ownership (§7 — not wired into run-checks.mjs, see header)');
{
  const copySrc = await readFile(COPY_MODULE, 'utf8');
  const copyMod = await importModule(copySrc);
  const sentinelled = [copyMod.NUDGE_TITLE, copyMod.NUDGE_BODY].some((v) => typeof v === 'string' && v.startsWith('__OWNED_BY_'));
  if (!sentinelled) {
    ok('NUDGE_TITLE / NUDGE_BODY are no longer the unowned sentinel — half A is copy-complete');
  } else {
    bad(
      "NUDGE_TITLE / NUDGE_BODY are not Deezine's real copy yet",
      '§7: "half A does not ship without it." src/constants/nudgeCopy.js still holds the sentinel — this is the expected, intentional state of this row until that PR lands.',
    );
  }
}

// =========================================================================
// H. Mutation matrix (required before §6's rows are trusted)
// =========================================================================
console.log('\nH. mutation matrix');
{
  // SHOULD-PASS — renaming the window builder's internals must not move any
  // row. Proves the gate is testing behaviour, not the specific identifier
  // names this draft happens to use.
  const renamed = windowSource
    .replace(/\bwritten\b/g, 'seenDays')
    .replace(/\bdays\b(?!\w)/g, 'scheduleDays');
  try {
    const renamedAst = parseJs(renamed);
    const renamedMod = await importModule(renamed);
    const hits = importShapes(renamedAst);
    const runs = runSweep(serviceMod.WINDOW_DAYS, renamedMod.buildWindow);
    const violations = runs.filter((r) => r.result.some((day) => r.written.includes(day)));
    if (hits.length === 0 && violations.length === 0) {
      ok("should-pass — renaming buildWindow's internal variables changes nothing rows 6/6a/7/9 assert");
    } else {
      bad('should-pass mutation stayed green', `renaming internals broke the gate — hits=${hits.length}, violations=${violations.length}. Rows 6/6a are reading source shape, not behaviour.`);
    }
  } catch (e) {
    bad('should-pass mutation (rename) is even parseable', String(e));
  }

  // SHOULD-FAIL #1 — reintroduce the exact defect §4.2 exists to prevent:
  // stop skipping written days. Row 6 must catch it.
  const skipTarget = 'if (!written.has(day)) days.push(day);';
  const noSkip = windowSource.replace(skipTarget, 'days.push(day);');
  if (noSkip === windowSource) {
    bad('should-fail mutation #1 (drop the skip) applied cleanly', 'the replace target string was not found — nudgeWindow.js changed shape and this mutation needs updating');
  } else {
    const noSkipMod = await importModule(noSkip);
    const runs = runSweep(serviceMod.WINDOW_DAYS, noSkipMod.buildWindow);
    const violations = runs.filter((r) => r.result.some((day) => r.written.includes(day)));
    if (violations.length > 0) {
      ok(`should-fail — dropping the "skip written days" line is caught by row 6 (${violations.length}/${runs.length} swept cases now violate it)`);
    } else {
      bad('should-fail mutation #1 (drop the skip) is caught by row 6', 'row 6 stayed green with the defect reintroduced — it is not testing what it claims to');
    }
  }

  // SHOULD-FAIL #2 — add a relative import. Row 6a must catch it, which is
  // the whole point of Bumble's ZERO-imports correction: a data:-URL loader
  // cannot resolve a relative specifier at all, so this mutation is also a
  // should-fail for row 6/7/9 (they would throw rather than assert) — this
  // gate treats "the loader itself fails" as the row 6a failure it is,
  // rather than letting an unrelated exception stand in for it.
  const withImport = `import { toISODate } from '../utils/dateRanges';\n${windowSource}`;
  const withImportAst = parseJs(withImport);
  const hits = importShapes(withImportAst);
  if (hits.length > 0) {
    ok(`should-fail — adding a relative import is caught by row 6a (${hits.join(', ')})`);
  } else {
    bad('should-fail mutation #2 (add an import) is caught by row 6a', 'row 6a did not see the added import');
  }
}

// =========================================================================
// `run-checks.mjs` greps every gate's tail for `/(\d+) passed, (\d+) failed/`
// to build the aggregate suite's totals — that pattern, not this line's
// prose, is the real interface. Printing `ok`/`pending` instead of `passed`
// here would not fail loudly: the regex would simply find nothing, and
// run-checks.mjs's own rule 3 ("exited 0 having asserted nothing is red, not
// green") would misreport 16 real passing assertions as an empty gate.
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
