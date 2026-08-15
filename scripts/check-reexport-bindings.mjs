// Gate for the class of bug Bumble found capturing LoadState.js frames
// (2026-08-15): `export { LOAD_STATES, resolveListView } from '../utils/loadState'`
// forwards those names to IMPORTERS of this file but creates no LOCAL binding
// — so every reference to LOAD_STATES inside LoadState.js itself threw
// `ReferenceError: Property 'LOAD_STATES' doesn't exist` the moment the
// component actually rendered.
//
//   npm run check:reexport-bindings
//
// WHY THIS WENT UNCAUGHT
//
// `check-load-state.mjs` executes `utils/loadState.js` directly — that file
// is plain JS with zero imports, so Node runs it fine and the pure function
// it gates is genuinely correct. `LoadState.js` is JSX; this repo has no
// renderer, so nothing ever calls the component function, and the four
// LOAD_STATES references inside its body (all past the export-from line) sit
// dead until a real render exercises them. Green suite, broken component —
// the "failure path has no green coverage" shape, one level up: the gap
// wasn't an untested branch, it was an untested *file*.
//
// WHY A STATIC CHECK AND NOT A RENDERER
//
// The right long-term fix is real render coverage (react-test-renderer or
// equivalent) — out of scope for this fix, a dependency decision for the
// team, not a solo call to make while patching one file. This gate closes
// the specific hole cheaply in the meantime: the defect is syntactic (a name
// used with no local binding), so it doesn't need a render to be provable.
//
// WHAT IT ASSERTS
//
// For every `export { A, B as C } from 'source'` in a file, the LOCAL name
// (`A`) creates no binding. If that same name is referenced anywhere else in
// the file as a plain identifier — and the file has no import or local
// declaration that binds it — the reference is dead code that only fires
// when it runs, exactly like LOAD_STATES was. Flags the read site, not just
// the export line, because the export-from is legal on its own; it is only
// a bug paired with a same-file reference.
//
// SCOPE OF THE CLAIM. Property access (`foo.LOAD_STATES`), object keys, JSX
// tag/attribute names, and import/export specifier positions are excluded —
// those aren't reads of a bare binding and re-exporting a re-export (a name
// forwarded again with no local use) is legal and common. A name shadowed by
// a function parameter is not modelled and would false-negative; none exist
// in `src/` today.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
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

// --- Enumerate off disk, not off a list -----------------------------------
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

const walk = (node, visit, parent = null) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit, parent));
    return;
  }
  if (typeof node.type === 'string') visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    walk(node[key], visit, node);
  }
};

let filesChecked = 0;

for (const file of files) {
  const src = await readFile(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    bad(`${rel(file)} parses`, err.message);
    continue;
  }
  filesChecked += 1;

  const reexportOnly = new Map(); // name -> line of the export-from statement
  const bound = new Set(); // names with a real local binding

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) bound.add(spec.local.name);
      continue;
    }
    if (node.type === 'ExportNamedDeclaration' && node.source) {
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier') reexportOnly.set(spec.local.name, node.loc.start.line);
      }
      continue;
    }
    // Top-level declarations (`const X = …`, `export const X = …`,
    // `function X() {}`, `class X {}`) all create real local bindings.
    const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (!decl) continue;
    if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        walk(d.id, (n) => {
          if (n.type === 'Identifier') bound.add(n.name);
        });
      }
    } else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
      if (decl.id) bound.add(decl.id.name);
    }
  }

  // A name that's both re-exported-only AND locally bound (redundant, but
  // not the bug this gate closes) is safe — drop it from the danger set.
  for (const name of bound) reexportOnly.delete(name);

  if (reexportOnly.size === 0) continue; // nothing risky in this file

  const isReadPosition = (node, parent) => {
    if (!parent) return true;
    // `export { A } from 'x'` / `import { A } from 'x'` specifier names —
    // not reads, this is the declaration itself.
    if (
      (parent.type === 'ExportSpecifier' || parent.type === 'ImportSpecifier') &&
      (parent.local === node || parent.exported === node || parent.imported === node)
    ) {
      return false;
    }
    // `foo.LOAD_STATES` — property access, not a bare-name read.
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
    // `{ LOAD_STATES: 1 }` — object key, not a read (computed keys DO read).
    if (
      (parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod') &&
      parent.key === node &&
      !parent.computed
    ) {
      return false;
    }
    // Declaration/binding positions (param names, catch bindings, etc.) —
    // `bound` already absorbed top-level decls; this excludes the rest.
    if (parent.type === 'VariableDeclarator' && parent.id === node) return false;
    if (
      (parent.type === 'FunctionDeclaration' ||
        parent.type === 'FunctionExpression' ||
        parent.type === 'ArrowFunctionExpression') &&
      parent.params.includes(node)
    ) {
      return false;
    }
    return true;
  };

  for (const [name, exportLine] of reexportOnly) {
    const reads = [];
    walk(ast.program, (node, parent) => {
      if (node.type !== 'Identifier' || node.name !== name) return;
      // The specifier inside the export-from statement itself is excluded
      // by isReadPosition's ExportSpecifier check — that's the legal
      // forward, not a use.
      if (isReadPosition(node, parent)) reads.push(node.loc.start.line);
    });

    if (reads.length === 0) {
      ok(`${rel(file)}:${exportLine} re-exports '${name}' with no same-file read`);
    } else {
      bad(
        `${rel(file)}:${exportLine} re-export of '${name}' has no local binding`,
        `referenced as a bare identifier at line(s) ${reads.join(', ')} — ` +
          `'export { ${name} } from …' does not create a local '${name}'; ` +
          `add 'import { ${name} } from …' alongside it or this throws ReferenceError at call time`,
      );
    }
  }
}

if (filesChecked > 0) {
  ok(`parsed ${filesChecked} files`);
} else {
  bad('parsed files', 'zero files found — the enumerator broke, not that the codebase is empty');
}

console.log(`\ncheck-reexport-bindings: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
