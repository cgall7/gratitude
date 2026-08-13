// Gate for the hazard Sage briefed and Pixel then caught me re-opening
// (2026-08-13, thread 3b8744e8): `navigation.getParent()` is a *position*
// claim, and nothing in the codebase checks the position.
//
//   npm run check:nav-depth
//
// WHY THIS EXISTS
//
// Six call sites do `navigation.getParent()?.navigate('Seeds' | 'Notes' |
// 'Onboarding' | 'Lock' | 'Wrapped')`. They work because their screens are
// direct `<Tab.Screen>` children of the one tab navigator, which is itself a
// direct `<Stack.Screen>` of the root stack — so `getParent()` IS the root
// stack, which is where those routes live.
//
// Put one navigator in between and `getParent()` returns the *tab* navigator
// instead. It is non-null, so `?.` does not save you: `.navigate('Seeds')`
// gets called, finds no such route, and React Navigation logs a dev-only
// warning and does nothing. Dead buttons. No crash, no red screen, and it
// looks correct in a screenshot — which is why prose kept aging wrong:
//
//   Sage, 18:49Z:  "RecapTab and PollinateWrapped call getParent nowhere,
//                   so Garden can nest as deep as you like."   (true then)
//   Me, 18:55Z:    "Garden could have nested safely."          (false when
//                   written — by the same commit it described: RecapTab.js
//                   grew the Wrapped card, and with it a getParent site)
//   Pixel §26.4:   the identical sentence, aged the identical distance.
//
// Three people wrote the same true-then-false sentence within six minutes.
// The invariant does not need better prose, it needs a reader.
//
// WHAT IT ASSERTS, AND WHY IN THIS ORDER
//
//   1. The app has exactly two navigators. This is the assertion that
//      actually holds the line — a third navigator anywhere is what changes
//      what `getParent()` means, so it is checked as a census of every file
//      on disk rather than as a property of the files I happened to think of.
//   2. The root stack registers the tab navigator directly.
//   3. Every getParent site is reached by a direct tab screen — computed by
//      walking the import graph up from the site, so a site inside a
//      *component* (DevVersionTag) is attributed to the screen that renders
//      it rather than skipped for not being a screen itself.
//   4. Every route those sites name is registered on the root stack.
//
// An unattributable site is a FAILURE, not a skip. The way this gate would
// otherwise rot is a getParent call in a file the import walk can't reach —
// so that case is red by construction, and the fix is to teach the gate,
// not to let it shrink its own universe quietly.
//
// SCOPE OF THE CLAIM. This reads the static import graph. A screen rendered
// through a dynamic import, a registry, or a prop would not be modelled —
// none exist in `src/` today, and assertion 1 is what makes that survivable:
// any new navigator lands red here regardless of how it was wired.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'App.js');

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
const rel = (p) => path.relative(ROOT, p);

// --- 0. Enumerate off disk, not off a list -------------------------------
// A gate that has to be *told* about a file has the hole it exists to close.
const jsFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const files = [ENTRY, ...(await jsFiles(path.join(ROOT, 'src')))];

const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    walk(node[key], visit);
  }
};

// `./Foo` -> absolute path of the file it means, or null if unresolvable.
const resolveImport = async (fromFile, source) => {
  if (!source.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), source);
  for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
};

const isGetParentCall = (node) =>
  (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') &&
  (node.callee.type === 'MemberExpression' || node.callee.type === 'OptionalMemberExpression') &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'getParent';

// Route names a `.reset({ index, routes: [{ name: 'X' }] })` targets.
const resetRouteNames = (arg) => {
  const names = [];
  if (!arg) return names;
  walk(arg, (n) => {
    if (
      n.type === 'ObjectProperty' &&
      n.key.type === 'Identifier' &&
      n.key.name === 'name' &&
      n.value.type === 'StringLiteral'
    ) {
      names.push(n.value.value);
    }
  });
  return names;
};

const modules = new Map(); // absolute path -> { imports, sites, navigators, screens }

for (const file of files) {
  const src = await readFile(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    bad(`${rel(file)} parses`, err.message);
    continue;
  }

  const imports = new Map(); // local binding name -> absolute path
  const importPaths = [];
  const sites = []; // { line, method, targets }
  const getParentLines = []; // every getParent() call, modelled or not
  const navigators = []; // { line, name }
  const screens = []; // { navigator, routeName, componentLocal, line }

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const resolved = await resolveImport(file, node.source.value);
    if (!resolved) continue;
    importPaths.push(resolved);
    for (const spec of node.specifiers) imports.set(spec.local.name, resolved);
  }

  walk(ast.program, (node) => {
    // `create*Navigator()` — the census that makes assertion 1 possible.
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      /^create\w*Navigator$/.test(node.callee.name)
    ) {
      navigators.push({ line: node.loc.start.line, name: node.callee.name });
    }

    // `<Foo.Screen name="X" component={Y} />` and the render-prop form,
    // `<Foo.Screen name="X">{(props) => <Y {...props} />}</Foo.Screen>`.
    // Five of App.js's thirteen root routes use the second shape. Reading
    // only the first would leave those five unmodelled as *owners*, so a
    // getParent() call inside a file they render could be attributed to a
    // tab screen that also imports it and pass — while the root-screen path
    // has no parent navigator at all.
    if (node.type === 'JSXElement' && node.openingElement.name.type === 'JSXMemberExpression') {
      const { object, property } = node.openingElement.name;
      if (object.type !== 'JSXIdentifier' || property.name !== 'Screen') return;
      let routeName = null;
      let componentLocal = null;
      for (const attr of node.openingElement.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        if (attr.name.name === 'name' && attr.value?.type === 'StringLiteral') {
          routeName = attr.value.value;
        }
        if (
          attr.name.name === 'component' &&
          attr.value?.type === 'JSXExpressionContainer' &&
          attr.value.expression.type === 'Identifier'
        ) {
          componentLocal = attr.value.expression.name;
        }
      }
      if (!componentLocal) {
        // First capitalised element rendered by the render prop. `{...props}`
        // spreads and text nodes are not elements, so this lands on the screen
        // component itself.
        walk(node.children, (child) => {
          if (
            !componentLocal &&
            child.type === 'JSXOpeningElement' &&
            child.name.type === 'JSXIdentifier' &&
            /^[A-Z]/.test(child.name.name)
          ) {
            componentLocal = child.name.name;
          }
        });
      }
      screens.push({
        navigator: object.name,
        routeName,
        componentLocal,
        line: node.loc.start.line,
      });
    }

    if (isGetParentCall(node)) getParentLines.push(node.loc.start.line);

    // `<anything>.getParent()?.navigate('X')` / `.reset({ routes: [...] })`
    if (
      (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') &&
      (node.callee.type === 'MemberExpression' || node.callee.type === 'OptionalMemberExpression') &&
      isGetParentCall(node.callee.object) &&
      node.callee.property.type === 'Identifier'
    ) {
      const method = node.callee.property.name;
      const first = node.arguments[0];
      const targets =
        method === 'reset'
          ? resetRouteNames(first)
          : first?.type === 'StringLiteral'
            ? [first.value]
            : [];
      sites.push({ line: node.loc.start.line, method, targets, static: !!first });
    }
  });

  modules.set(file, { imports, importPaths, sites, navigators, screens, getParentLines });
}

// --- 1. The navigator census ---------------------------------------------
// This is the load-bearing one. Every other assertion below describes the
// shape of a two-navigator app; this is what notices a third.
const navHosts = [...modules.entries()].filter(([, m]) => m.navigators.length > 0);
// Count the navigators, not the files that hold them. Counting hosts is the
// same defect one level up: two files holding three navigators reads as two,
// and the second navigator in MainTabs.js is exactly how Garden would nest.
const navCalls = navHosts.flatMap(([f, m]) => m.navigators.map((n) => `${rel(f)}:${n.line} ${n.name}()`));

if (navCalls.length === 2) {
  ok(`exactly two navigators exist app-wide — ${navCalls.join(' | ')}`);
} else {
  bad(
    'exactly two navigators exist app-wide',
    `found ${navCalls.length}: ${navCalls.join(' | ') || '(none)'}. A third navigator re-points every ` +
      "getParent() call underneath it; re-read this gate's header before changing it.",
  );
}

const rootMod = modules.get(ENTRY);
const rootScreens = rootMod ? rootMod.screens.filter((s) => s.navigator === 'Stack') : [];
const rootRouteNames = new Set(rootScreens.map((s) => s.routeName).filter(Boolean));

// --- 2. The tab navigator sits directly on the root stack ----------------
const tabHostEntry = navHosts.find(([f]) => f !== ENTRY);
const tabHost = tabHostEntry ? tabHostEntry[0] : null;

const rootScreenModules = new Map(); // absolute path -> routeName
for (const s of rootScreens) {
  const resolved = s.componentLocal ? rootMod.imports.get(s.componentLocal) : null;
  if (resolved) rootScreenModules.set(resolved, s.routeName);
}

if (!tabHost) {
  bad('the root stack registers the tab navigator directly', 'no tab navigator found outside App.js');
} else if (rootScreenModules.has(tabHost)) {
  ok(
    `the root stack registers the tab navigator directly — <Stack.Screen name="${rootScreenModules.get(tabHost)}" ` +
      `component={${rel(tabHost)}}>`,
  );
} else {
  bad(
    'the root stack registers the tab navigator directly',
    `${rel(tabHost)} is not a direct component of any root <Stack.Screen>. If it moved one level deeper, ` +
      'every getParent() below it now resolves to the wrong navigator.',
  );
}

// --- Tab screens ----------------------------------------------------------
const tabMod = tabHost ? modules.get(tabHost) : null;
const tabScreenModules = new Map(); // absolute path -> routeName
if (tabMod) {
  for (const s of tabMod.screens.filter((x) => x.navigator === 'Tab')) {
    const resolved = s.componentLocal ? tabMod.imports.get(s.componentLocal) : null;
    if (resolved) tabScreenModules.set(resolved, s.routeName);
  }
}

// --- 3. Every getParent site is reached by a direct tab screen -----------
// Walk the import graph *upward*: who imports the file the call lives in,
// and who imports them, stopping at anything registered as a screen. A call
// inside DevVersionTag is the Garden tab's call, because Garden is the only
// screen that renders it.
const importedBy = new Map(); // absolute path -> Set of importers
for (const [file, m] of modules) {
  for (const dep of m.importPaths) {
    if (!importedBy.has(dep)) importedBy.set(dep, new Set());
    importedBy.get(dep).add(file);
  }
}

const owningScreens = (file) => {
  const found = new Set();
  const seen = new Set();
  const queue = [file];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    if (tabScreenModules.has(current)) {
      found.add(`tab:${tabScreenModules.get(current)}`);
      continue; // a screen owns its subtree; don't climb past it
    }
    if (rootScreenModules.has(current) && current !== tabHost) {
      found.add(`root:${rootScreenModules.get(current)}`);
      continue;
    }
    for (const importer of importedBy.get(current) ?? []) queue.push(importer);
  }
  return found;
};

const allSites = [...modules.entries()].flatMap(([file, m]) =>
  m.sites.map((s) => ({ file, ...s })),
);

// Empty-universe guard: zero sites means the detector broke (a syntax the
// walker no longer recognises), not that the hazard went away.
if (allSites.length > 0) {
  ok(`found ${allSites.length} getParent() call sites to check`);
} else {
  bad(
    'found getParent() call sites to check',
    'zero detected — every assertion below this line is vacuous. The AST shape changed, not the risk.',
  );
}

// The detector above only matches the fluent shape, `getParent()?.navigate(…)`.
// Assign the result to a variable first and the site would leave this gate's
// universe *silently* — the hole a shrinking universe always has. So every
// getParent() call on disk is counted independently, and any call this gate
// cannot follow is red rather than absent. The fix for a red here is to write
// the call inline, which is also the shape the four existing sites use.
const modelledLines = new Set(allSites.map((s) => `${s.file}:${s.line}`));
const unmodelled = [...modules.entries()].flatMap(([file, m]) =>
  m.getParentLines.filter((line) => !modelledLines.has(`${file}:${line}`)).map((line) => `${rel(file)}:${line}`),
);
if (unmodelled.length === 0) {
  ok('every getParent() call on disk is one this gate can follow');
} else {
  bad(
    'every getParent() call on disk is one this gate can follow',
    `${unmodelled.join(', ')} — result is not navigated inline, so its target and depth go unchecked`,
  );
}

for (const site of allSites) {
  const where = `${rel(site.file)}:${site.line}`;
  const owners = owningScreens(site.file);
  const tabOwners = [...owners].filter((o) => o.startsWith('tab:'));
  const rootOwners = [...owners].filter((o) => o.startsWith('root:'));

  if (owners.size === 0) {
    bad(
      `${where} getParent().${site.method} is reached only by direct tab screens`,
      'no registered screen imports this file — the gate cannot place this call, so it cannot vouch for it',
    );
  } else if (rootOwners.length) {
    bad(
      `${where} getParent().${site.method} is reached only by direct tab screens`,
      `also reached by root-stack screen(s) ${rootOwners.join(', ')}, where getParent() is undefined and ` +
        'the call silently does nothing',
    );
  } else {
    ok(
      `${where} getParent().${site.method} is reached only by direct tab screens — ${tabOwners.join(', ')}`,
    );
  }

  // --- 4. …and names a route the root stack actually registers ----------
  if (!site.targets.length) {
    if (site.static) {
      bad(
        `${where} getParent().${site.method} names a route the root stack registers`,
        'target is not a string literal — this gate cannot follow it, so the route is unchecked',
      );
    } else {
      ok(`${where} getParent().${site.method}() takes no route argument`);
    }
    continue;
  }
  for (const target of site.targets) {
    if (rootRouteNames.has(target)) {
      ok(`${where} → '${target}' is registered on the root stack`);
    } else {
      bad(
        `${where} → '${target}' is registered on the root stack`,
        `no <Stack.Screen name="${target}"> in App.js. Known root routes: ${[...rootRouteNames].join(', ')}`,
      );
    }
  }
}

console.log(`\ncheck-nav-depth: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
