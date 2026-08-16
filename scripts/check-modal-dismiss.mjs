// Gate for the trap Colin hit on his own phone (2026-08-15): a modal screen
// with no way out.
//
//   npm run check:modal-dismiss
//
// WHY THIS EXISTS
//
// The root navigator runs `headerShown: false` globally (App.js), so no
// screen anywhere gets a system back button — every modal has to draw its
// own exit. Seeds and Notes didn't, and nothing could notice: both adopted
// `ScreenHeader`, a component built for tabs ("one header treatment for
// every tab"), which at the time had a title and ONE action slot. A modal
// needs two controls — an exit and an action — and both screens spent the
// single slot on the action. The exit didn't get lost; there was nowhere to
// put it. A tab component adopted by a modal is trapped by construction,
// which is why it was two screens and not two mistakes.
//
// The class is invisible to every other check we have: the screen renders,
// navigation succeeds, `expo export` is green, and a screenshot looks
// correct. The only statement that catches it is the one this gate makes.
//
// WHAT IT ASSERTS
//
//   1. App.js declares at least one `presentation: 'modal'` screen — the
//      empty-universe guard. Zero found means the detector broke (the JSX
//      shape moved), not that the app stopped having modals.
//   2. Every modal screen is one this gate can resolve to code it can read.
//      An options object it cannot statically evaluate, or a component it
//      cannot trace to a file, is a FAILURE, not a skip — the gate must not
//      shrink its own universe quietly.
//   3. Every modal screen has a dismiss call — `.goBack()`, `.pop()`,
//      `.popToTop()`, or `.dismiss()` — whose enclosing function is the
//      VALUE OF A JSX ATTRIBUTE, either in the render-prop body at the
//      registration site (Wrapped wires `onComplete` to `goBack` right in
//      App.js) or in the resolved component file. Attribute-value, not
//      "anywhere in the file": a compose-style modal always has a `goBack`
//      on its submit path (`ComposeNote.handleSend`, `PlantSeed`'s
//      equivalent), so the screens most likely to trap a user who changed
//      their mind satisfy a file-scoped predicate for free — Sage proved it
//      by deleting ComposeNote's close control and watching the file-scoped
//      version stay green. Attribute-value, not `onPress`-value: Wrapped's
//      exit hangs off `onComplete`, and an `onPress`-name rule would break
//      the one screen the enumerator was built to find.
//   4. Every press-shaped dismiss attribute (`onPress`/`onLongPress`) sits
//      on an element carrying a non-empty `accessibilityLabel` — the exit
//      must exist for a screen-reader user too. Non-press exit wirings
//      (Wrapped's `onComplete` on a component, not a pressable) are outside
//      this assertion; their label lives inside the child component.
//
// SCOPE OF THE CLAIM. Asserted by AST walk (never by regex — half these
// files discuss navigation in comments). Two shapes this predicate does not
// model, and BOTH fail in the safe direction — red on correct code, never
// green on a trap:
//   - a screen that delegates its dismissal to an imported child component;
//   - a handler declared in the module body and passed by reference
//     (`onPress={close}` where `close` calls `goBack`) — only inline
//     function values and bare method references (`onPress={navigation.goBack}`)
//     are read.
// Neither shape occurs on `main` today. If one lands red here, the fix is
// to teach the gate the indirection, not to let the screen out of the
// universe.
//
// And one limit in the DANGEROUS direction — green on a trap (Sage, review
// of b318e60): this predicate proves a dismiss handler is WIRED as a JSX
// attribute value, not that the wiring is REACHABLE in every state the
// screen renders. Executed instance: Wrapped's exit is `onComplete`, called
// only on advancing past the last slide — in its failed-load branch the
// screen renders <LoadState> alone, no slides to advance, so the handler
// this gate credits is unreachable and the only exits are the invisible
// system gestures. The gate stays green, correctly by its own rule.
// Reachability across render branches is not something a static walk can
// settle, so the remedy is a product standard rather than a tighter
// predicate: every failure/empty branch of a modal renders a visible
// dismiss control (the left-slot chevron idiom). When reviewing a modal's
// failure states, do not read this gate's green as evidence the user can
// leave from where they are actually standing.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
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

const DISMISS_METHODS = new Set(['goBack', 'pop', 'popToTop', 'dismiss']);

// A `.goBack()`-shaped call, on anything. Matching the property alone (not
// `navigation.` specifically) is deliberate: the healthy modals reach it as
// `navigation.goBack()` and `props.navigation.goBack()`, and narrowing to
// one receiver spelling would false-fail the other.
const dismissCallsIn = (node) => {
  const found = [];
  walk(node, (n) => {
    if (
      (n.type === 'CallExpression' || n.type === 'OptionalCallExpression') &&
      (n.callee.type === 'MemberExpression' || n.callee.type === 'OptionalMemberExpression') &&
      n.callee.property.type === 'Identifier' &&
      DISMISS_METHODS.has(n.callee.property.name)
    ) {
      found.push({ line: n.loc.start.line, method: n.callee.property.name });
    }
  });
  return found;
};

// A dismiss call wired where a user can reach it: a JSX attribute whose
// value is an inline function containing a dismiss call, or a bare method
// reference to one (`onPress={navigation.goBack}`). Returns the attribute
// site, not the call site — `ComposeNote.js` has a `goBack` in `handleSend`
// too, and citing that line sent an auditor into the submit path.
const dismissExitsIn = (node) => {
  const found = [];
  walk(node, (n) => {
    if (n.type !== 'JSXOpeningElement') return;
    for (const attr of n.attributes) {
      if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
      if (attr.value?.type !== 'JSXExpressionContainer') continue;
      const expr = attr.value.expression;
      let method = null;
      if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
        method = dismissCallsIn(expr.body)[0]?.method ?? null;
      } else if (
        (expr.type === 'MemberExpression' || expr.type === 'OptionalMemberExpression') &&
        expr.property.type === 'Identifier' &&
        DISMISS_METHODS.has(expr.property.name)
      ) {
        method = expr.property.name;
      }
      if (method) {
        found.push({ attrName: attr.name.name, line: attr.loc.start.line, method, element: n });
      }
    }
  });
  return found;
};

// Assertion 4: the element owning a press-shaped exit must be labelled for
// a screen reader. Returns the label string, or null if absent/empty.
const accessibilityLabelOf = (openingElement) => {
  for (const attr of openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'accessibilityLabel' &&
      attr.value?.type === 'StringLiteral' &&
      attr.value.value.trim() !== ''
    ) {
      return attr.value.value;
    }
  }
  return null;
};

const PRESS_ATTRS = new Set(['onPress', 'onLongPress']);

const src = await readFile(ENTRY, 'utf8');
const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });

const imports = new Map(); // local binding name -> absolute path
for (const node of ast.program.body) {
  if (node.type !== 'ImportDeclaration') continue;
  const resolved = await resolveImport(ENTRY, node.source.value);
  if (!resolved) continue;
  for (const spec of node.specifiers) imports.set(spec.local.name, resolved);
}

// --- Enumerate the modal screens off the AST, not off a list -------------
// A gate that has to be *told* which screens are modal has the exact hole
// it exists to close: the next modal added to App.js must land in this
// universe with no registration step.
const modals = []; // { routeName, line, componentLocal, renderBody, optionsReadable }
walk(ast.program, (node) => {
  if (node.type !== 'JSXElement' || node.openingElement.name.type !== 'JSXMemberExpression') return;
  const { object, property } = node.openingElement.name;
  if (object.type !== 'JSXIdentifier' || object.name !== 'Stack' || property.name !== 'Screen') return;

  let routeName = null;
  let componentLocal = null;
  let optionsAttr = null;
  for (const attr of node.openingElement.attributes) {
    if (attr.type !== 'JSXAttribute') continue;
    if (attr.name.name === 'name' && attr.value?.type === 'StringLiteral') routeName = attr.value.value;
    if (attr.name.name === 'options') optionsAttr = attr;
    if (
      attr.name.name === 'component' &&
      attr.value?.type === 'JSXExpressionContainer' &&
      attr.value.expression.type === 'Identifier'
    ) {
      componentLocal = attr.value.expression.name;
    }
  }

  if (!optionsAttr) return; // no options at all — not presented as a modal

  // `options={{ presentation: 'modal', ... }}` is the only shape on main.
  // Anything else (a function, a spread, a variable) is a shape this gate
  // cannot read, and a modal declared through it would silently leave the
  // universe — so unreadable options on a Screen are red, not skipped.
  const expr = optionsAttr.value?.type === 'JSXExpressionContainer' ? optionsAttr.value.expression : null;
  let optionsReadable = expr?.type === 'ObjectExpression';
  let isModal = false;
  if (optionsReadable) {
    for (const prop of expr.properties) {
      if (prop.type !== 'ObjectProperty') {
        optionsReadable = false; // a spread could smuggle `presentation` in
        continue;
      }
      if (
        prop.key.type === 'Identifier' &&
        prop.key.name === 'presentation' &&
        prop.value.type === 'StringLiteral' &&
        prop.value.value === 'modal'
      ) {
        isModal = true;
      }
    }
  }

  if (!optionsReadable) {
    bad(
      `App.js:${node.loc.start.line} <Stack.Screen name="${routeName ?? '?'}"> options are statically readable`,
      'not a plain object of plain properties — a modal declared this way would escape this gate unchecked',
    );
    return;
  }
  if (!isModal) return;

  modals.push({ routeName, line: node.loc.start.line, componentLocal, renderBody: node.children });
});

// --- 1. Empty-universe guard ---------------------------------------------
if (modals.length > 0) {
  ok(`App.js declares ${modals.length} modal screen(s): ${modals.map((m) => m.routeName).join(', ')}`);
} else {
  bad(
    'App.js declares at least one modal screen',
    'zero detected — every assertion below is vacuous. The JSX shape changed, not the risk.',
  );
}

// --- 2, 3 & 4. Every modal has an exit a user can press ------------------
const assertLabelled = (exit, file) => {
  const where = `${file}:${exit.line}`;
  if (!PRESS_ATTRS.has(exit.attrName)) return; // exit wired through a child component's callback
  const a11y = accessibilityLabelOf(exit.element);
  if (a11y) {
    ok(`dismiss control at ${where} has accessibilityLabel "${a11y}"`);
  } else {
    bad(
      `dismiss control at ${where} has a non-empty accessibilityLabel`,
      'none found on the element owning the exit — the only way out of this modal is unlabelled for a screen reader',
    );
  }
};

for (const modal of modals) {
  const label = `modal '${modal.routeName}' (App.js:${modal.line}) has a JSX-attribute dismiss`;

  // Render-prop form first: Wrapped's exit is wired at the registration
  // site (`onComplete={() => props.navigation.goBack()}`), so the attribute
  // lives in App.js, not in PollinateWrapped.js.
  const inline = dismissExitsIn(modal.renderBody);
  if (inline.length) {
    ok(`${label} — ${inline[0].attrName}={… .${inline[0].method}()} at the registration site, App.js:${inline[0].line}`);
    assertLabelled(inline[0], 'App.js');
    continue;
  }

  if (!modal.componentLocal) {
    bad(label, 'no dismiss at the registration site and no component={…} identifier to follow');
    continue;
  }
  const file = imports.get(modal.componentLocal);
  if (!file) {
    bad(label, `component '${modal.componentLocal}' does not resolve to an imported file`);
    continue;
  }

  let componentAst;
  try {
    componentAst = parse(await readFile(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    bad(label, `${rel(file)} failed to parse: ${err.message}`);
    continue;
  }
  const exits = dismissExitsIn(componentAst.program);
  if (exits.length) {
    ok(
      `${label} — ${exits
        .map((e) => `${e.attrName}={… .${e.method}()} at ${rel(file)}:${e.line}`)
        .join(', ')}`,
    );
    exits.forEach((e) => assertLabelled(e, rel(file)));
  } else {
    bad(
      label,
      `${rel(file)} has no JSX attribute whose value dismisses (.goBack()/.pop()/.popToTop()/.dismiss()). ` +
        'A dismiss call elsewhere in the file does not count — ComposeNote\'s submit path has one, and a ' +
        'user who changed their mind cannot reach it. With headerShown:false global, this screen has no ' +
        'system chrome — the Seeds/Notes trap.',
    );
  }
}

console.log(`\ncheck-modal-dismiss: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
