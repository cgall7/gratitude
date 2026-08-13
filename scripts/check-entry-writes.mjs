// Gate for the failure semantics P0-2 introduced and the call sites did not
// change to meet (2026-08-13, thread 3b8744e8).
//
//   npm run check:entry-writes
//
// WHY THIS EXISTS
//
// `EntryStore.saveEntry` used to be `AsyncStorage.setItem`: no identity, no
// network, effectively infallible. P0-2 made it a Supabase write behind
// `requireUserId`, so it now rejects — on a missing session, on a network
// blip, and (since …0007's partial unique index) on two rapid taps.
//
// The PR's stated safety property was "call sites are unchanged". That was
// the defect. Every failure the review found was at an unchanged call site:
//
//   Sage, 19:04Z:  Onboarding.js's write was unawaited and uncaught, so the
//                  first entry of every fresh install was discarded under a
//                  celebration animation.
//   Me,   19:20Z:  the *replacement* write, created in the commit that fixed
//                  that one, was handed to `setTimeout(() => onUnlock(text))`
//                  with its return discarded — a rejection stranded the user
//                  on a full-screen overlay with `unlocking` stuck true.
//
// Same shape twice in one day: a named defect got a try/catch and a
// paragraph of reasoning, and its unnamed sibling shipped.
//
// WHAT IT ASSERTS
//
//   1. `saveEntry` still exists on EntryStore, and the census found at least
//      one call site. A gate whose universe can quietly go empty — via a
//      rename, a move, a wrapper — is worse than no gate, because it reports
//      green while asserting nothing.
//   2. Every `EntryStore.saveEntry(...)` call site reaches a handler.
//
// ASSERTION 2 IS INTERPROCEDURAL, ON PURPOSE, AND THAT IS THE WHOLE POINT.
//
// The obvious gate — "the call site is inside a try/catch or has .catch()" —
// is RED on the correct code. `App.js`'s write is an `await` inside an async
// `onUnlock` prop with no local handler, and it is right: the rejection is
// caught one file over, by the component that invokes the prop. A file-scoped
// proxy would have failed the fix and passed the bug it replaced, because
// the bug and the fix differ in `CoreRitual.js`, not in `App.js`.
//
// So a site is green if the rejection is handled *anywhere it can reach*:
//
//   local     — awaited inside a try that has a handler, or `.catch()`-chained
//               (`Promise.resolve(x).catch()` and `.then(ok, err)` included).
//   escaping  — the promise leaves the enclosing function. The gate then
//               resolves that function's consumer: a JSX prop is followed to
//               the imported component, to the prop's own call sites inside
//               it, and each of those is classified the same way.
//
// An escape the gate cannot follow is a FAILURE, not a skip — same rule as
// check-nav-depth. The way this rots is a new indirection the walk does not
// model, so that case is red by construction and the fix is to teach the
// gate. Two shapes get a named diagnosis instead of the generic one, because
// they are the two that actually happened: a handler dropped into
// `setTimeout`, and a promise-returning call used as a bare statement.
//
// SCOPE OF THE CLAIM. This models one indirection: a function passed as a
// JSX attribute to a statically-imported component. It does not model a
// handler stored in state, put on a context, or routed through a registry —
// none exist on this path today, and any of them would land red here rather
// than silently unchecked.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The methods under gate. Reads reject for exactly the same reasons now that
// they run through `requireUserId` and the network, and adding them here is a
// one-line change — but not yet, for two measured reasons. Run at 5f94440
// with the reads added, this gate reports three reds:
//
//   PollinateWrapped.js:107  real — the async IIFE's return is discarded and
//                            `setSlides` only runs on success, so `slides`
//                            stays null and :132 spins forever. Pixel's §26.5.
//   RecapTab.js:126          real, and the same shape one screen over: no
//                            handler, and `setLoading(false)` is on the happy
//                            path only, so Garden's landing tab hangs.
//   HoneycombTab.js:223      FALSE POSITIVE. `loadAll` is handled at all five
//                            of its call sites (:267, :304, :313, :325, :334);
//                            the gate simply cannot follow a named local
//                            function, so it fails closed on correct code.
//
// So widening this list needs the escape-walk taught one more indirection
// first — a rejection leaving a named `const handler = async () => …` — or it
// would flag working code alongside the two genuine hangs.
const GATED_METHODS = ['saveEntry'];
const STORE = 'EntryStore';

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

// --- Enumerate off disk, not off a list ----------------------------------
const jsFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

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

const parentMap = (ast) => {
  const parents = new Map();
  const link = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => link(n, parent));
      return;
    }
    if (typeof node.type === 'string') parents.set(node, parent);
    const owner = typeof node.type === 'string' ? node : parent;
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      link(node[key], owner);
    }
  };
  link(ast.program, null);
  return parents;
};

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

const isFunctionNode = (n) =>
  n.type === 'ArrowFunctionExpression' ||
  n.type === 'FunctionExpression' ||
  n.type === 'FunctionDeclaration';

const calleeName = (node) => {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const obj = node.object.type === 'Identifier' ? node.object.name : '?';
    const prop = node.property.type === 'Identifier' ? node.property.name : '?';
    return `${obj}.${prop}`;
  }
  return null;
};

// Does the rejection of `call` reach a handler without leaving its function?
// Returns { handled, how } or { handled: false, escapes, fn, via }.
const classify = (call, parents) => {
  let cur = call;
  let awaited = false;

  for (;;) {
    const parent = parents.get(cur);
    if (!parent) return { handled: false, escapes: true, fn: null, via: 'module top level' };

    // `p.catch(fn)` / `p.then(ok, err)` — the handler is on the chain.
    if (
      (parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') &&
      parent.object === cur &&
      parent.property.type === 'Identifier'
    ) {
      const method = parent.property.name;
      const grand = parents.get(parent);
      const isCalled =
        grand &&
        (grand.type === 'CallExpression' || grand.type === 'OptionalCallExpression') &&
        grand.callee === parent;
      if (isCalled && method === 'catch') return { handled: true, how: '.catch()' };
      if (isCalled && method === 'then' && grand.arguments.length >= 2) {
        return { handled: true, how: '.then(ok, err)' };
      }
      if (isCalled && (method === 'then' || method === 'finally')) {
        cur = grand; // still a promise, still unhandled — keep climbing
        continue;
      }
      return { handled: false, escapes: true, fn: null, via: `.${method}` };
    }

    // Wrappers that pass the rejection straight through.
    if (parent.type === 'AwaitExpression') {
      awaited = true;
      cur = parent;
      continue;
    }
    if (
      (parent.type === 'CallExpression' || parent.type === 'OptionalCallExpression') &&
      ['Promise.resolve', 'Promise.all', 'Promise.allSettled', 'Promise.race'].includes(
        calleeName(parent.callee),
      )
    ) {
      if (calleeName(parent.callee) === 'Promise.allSettled') {
        return { handled: true, how: 'Promise.allSettled()' };
      }
      cur = parent;
      continue;
    }
    if (parent.type === 'ArrayExpression' || parent.type === 'TSNonNullExpression') {
      cur = parent;
      continue;
    }

    // try { await p } catch — only counts when the promise was awaited.
    if (parent.type === 'TryStatement' && parent.block === cur) {
      if (parent.handler && awaited) return { handled: true, how: 'try/catch around await' };
      if (parent.handler) {
        return {
          handled: false,
          escapes: false,
          fn: null,
          via: 'inside try/catch but not awaited — a rejected promise is not a thrown exception',
        };
      }
    }

    // Reached the enclosing function: the rejection escapes it.
    if (isFunctionNode(parent)) {
      return { handled: false, escapes: true, fn: parent };
    }

    cur = parent;
  }
};

// --- Parse everything once -----------------------------------------------
const files = [path.join(ROOT, 'App.js'), ...(await jsFiles(path.join(ROOT, 'src')))];
const modules = new Map(); // abs path -> { ast, parents, imports }

for (const file of files) {
  const src = await readFile(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    bad(`${rel(file)} parses`, err.message);
    continue;
  }
  const imports = new Map();
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const resolved = await resolveImport(file, node.source.value);
    if (!resolved) continue;
    for (const spec of node.specifiers) imports.set(spec.local.name, resolved);
  }
  modules.set(file, { ast, parents: parentMap(ast), imports });
}

// --- 1. The universe is non-empty ----------------------------------------
const storeFile = path.join(ROOT, 'src/services/EntryStore.js');
const storeMod = modules.get(storeFile);
if (!storeMod) {
  bad(`${STORE} defines the gated methods`, `${rel(storeFile)} not found or did not parse`);
} else {
  const defined = new Set();
  walk(storeMod.ast.program, (n) => {
    if (n.type === 'ObjectProperty' && n.key.type === 'Identifier') defined.add(n.key.name);
    if (n.type === 'ObjectMethod' && n.key.type === 'Identifier') defined.add(n.key.name);
  });
  for (const m of GATED_METHODS) {
    if (defined.has(m)) ok(`${STORE}.${m} is defined in ${rel(storeFile)}`);
    else
      bad(
        `${STORE}.${m} is defined in ${rel(storeFile)}`,
        'gated method is gone — renamed or moved. This gate is now asserting nothing; retarget it',
      );
  }
}

const sites = [];
for (const [file, mod] of modules) {
  if (file === storeFile) continue;
  walk(mod.ast.program, (n) => {
    if (n.type !== 'CallExpression' && n.type !== 'OptionalCallExpression') return;
    const name = calleeName(n.callee);
    if (!GATED_METHODS.some((m) => name === `${STORE}.${m}`)) return;
    sites.push({ file, mod, node: n, name, line: n.loc.start.line });
  });
}

if (sites.length) {
  ok(`census found ${sites.length} ${STORE}.{${GATED_METHODS.join(',')}} call site(s) outside the store`);
} else {
  bad(
    `census found ${STORE}.{${GATED_METHODS.join(',')}} call site(s) outside the store`,
    'zero sites. Either the writes moved behind a wrapper this gate does not follow, or they are gone — ' +
      'both make every assertion below vacuously green',
  );
}

// --- 2. Every site reaches a handler -------------------------------------
// Resolve one JSX-prop indirection: the escaping function is `onFoo={...}` on
// `<Component>`, so the consumer is `Component`'s own calls to `onFoo`.
const followJsxProp = (fn, file, mod) => {
  const container = mod.parents.get(fn);
  if (!container || container.type !== 'JSXExpressionContainer') return null;
  const attr = mod.parents.get(container);
  if (!attr || attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') return null;
  const element = mod.parents.get(attr);
  if (!element || element.type !== 'JSXOpeningElement') return null;
  if (element.name.type !== 'JSXIdentifier') return null;
  return { propName: attr.name.name, componentName: element.name.name };
};

// Calls to `propName` inside the component named `componentName`.
const propCallSites = (componentName, propName, targetFile) => {
  const mod = modules.get(targetFile);
  if (!mod) return null;
  let component = null;
  walk(mod.ast.program, (n) => {
    if (component) return;
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === componentName) {
      if (isFunctionNode(n.init)) component = n.init;
    }
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === componentName) component = n;
  });
  if (!component) return null;

  const param = component.params[0];
  const destructures =
    param &&
    param.type === 'ObjectPattern' &&
    param.properties.some(
      (p) => p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === propName,
    );
  if (!destructures) return null;

  const found = [];
  walk(component, (n) => {
    if (
      (n.type === 'CallExpression' || n.type === 'OptionalCallExpression') &&
      n.callee.type === 'Identifier' &&
      n.callee.name === propName
    ) {
      found.push(n);
    }
  });
  return { component, calls: found };
};

for (const site of sites) {
  const where = `${rel(site.file)}:${site.line}`;
  const label = `${where} ${site.name}() rejection reaches a handler`;
  const local = classify(site.node, site.mod.parents);

  if (local.handled) {
    ok(`${label} — ${local.how}, in place`);
    continue;
  }
  if (!local.escapes) {
    bad(label, local.via);
    continue;
  }
  if (!local.fn) {
    bad(label, `nothing encloses this call (${local.via ?? 'no function'}) — the rejection has nowhere to go`);
    continue;
  }

  const prop = followJsxProp(local.fn, site.file, site.mod);
  if (!prop) {
    // The two shapes that actually shipped get named, so the red line
    // diagnoses the defect instead of the gate's own uncertainty.
    const outer = site.mod.parents.get(local.fn);
    const outerCallee = outer && outer.type === 'CallExpression' ? calleeName(outer.callee) : null;
    if (outerCallee === 'setTimeout' || outerCallee === 'setInterval') {
      bad(
        label,
        `the enclosing function is an argument to ${outerCallee}(), which discards its return value — ` +
          'a rejection here is an unhandled promise rejection and no code after it runs',
      );
    } else {
      bad(
        label,
        `the rejection leaves the function at ${rel(site.file)}:${local.fn.loc.start.line} and this gate ` +
          'cannot find a consumer that handles it — that function is not an inline JSX prop it can follow. ' +
          'Handle the rejection where it escapes, or teach the gate this indirection',
      );
    }
    continue;
  }

  const targetFile = site.mod.imports.get(prop.componentName);
  if (!targetFile) {
    bad(
      label,
      `escapes into prop '${prop.propName}' of <${prop.componentName}>, which is not statically imported by ` +
        `${rel(site.file)} — the gate cannot find the consumer, so it cannot vouch for this call`,
    );
    continue;
  }

  const consumer = propCallSites(prop.componentName, prop.propName, targetFile);
  if (!consumer) {
    bad(
      label,
      `escapes into prop '${prop.propName}' of <${prop.componentName}>, but ${rel(targetFile)} has no ` +
        `component '${prop.componentName}' destructuring '${prop.propName}' — cannot place the consumer`,
    );
    continue;
  }
  if (!consumer.calls.length) {
    bad(
      label,
      `escapes into prop '${prop.propName}' of <${prop.componentName}>, and ${rel(targetFile)} never calls ` +
        `'${prop.propName}' — the write is unreachable, or it is invoked in a way this gate cannot see`,
    );
    continue;
  }

  const unhandled = [];
  for (const call of consumer.calls) {
    const outcome = classify(call, modules.get(targetFile).parents);
    if (outcome.handled) continue;

    const fn = outcome.fn;
    const outer = fn ? modules.get(targetFile).parents.get(fn) : null;
    const outerCallee = outer && outer.type === 'CallExpression' ? calleeName(outer.callee) : null;
    let why;
    if (outerCallee === 'setTimeout' || outerCallee === 'setInterval') {
      why = `handed to ${outerCallee}(), whose return value is discarded`;
    } else if (!outcome.escapes) {
      why = outcome.via;
    } else {
      why = 'the returned promise is neither awaited-in-try nor .catch()-chained';
    }
    unhandled.push(`${rel(targetFile)}:${call.loc.start.line} — ${why}`);
  }

  if (unhandled.length) {
    bad(
      label,
      `no local handler, so the rejection travels out through prop '${prop.propName}' of ` +
        `<${prop.componentName}> to ${rel(targetFile)}, where it is dropped: ${unhandled.join('; ')}`,
    );
  } else {
    ok(
      `${label} — escapes via prop '${prop.propName}' of <${prop.componentName}>, handled at ` +
        consumer.calls.map((c) => `${rel(targetFile)}:${c.loc.start.line}`).join(', '),
    );
  }
}

console.log(`\ncheck-entry-writes: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
