// Shared AST helpers for gates that ask questions about RENDERED STRINGS —
// the text a user actually reads off a screen — rather than about source
// lines (Sage, thread 4510c5c8: "collect rendered string literals, then ask
// a question about them. One walker, two questions").
//
// Two consumers, and they take DIFFERENT SLICES of the same collection:
//   - check-demo-content-callsites asks "is this rendered string inside a
//     DEMO_CONTENT guard?"     → jsx-text, jsx-expr
//   - check-copy-rules asks "does this rendered string contain a forbidden
//     word?"                   → all five positions
//
// THE WALKER ENUMERATES POSITIONS; THE QUESTION CHOOSES THEM.
//
// This file used to hardcode its own scope — text positions only — and that
// decision was invisible from inside either gate. It cost both of them
// (thread 4510c5c8, measured at c364c4c):
//
//   - the copy gate could not see its own frozen placeholder. R15's
//     "Today I was given…" is a `placeholder` prop, so a text-only universe
//     cannot satisfy the assertion that it is still rendered — and the four
//     `sin` false positives that are the entire measured argument for that
//     gate's per-word patterns are all in `constant` position, outside a
//     text-only universe too.
//   - the demo gate's rule 1 could not see a demo affordance whose only
//     rendered string is an Alert argument. That is how DevVersionTag — a
//     flow picker on a shipping tab — passed twenty gates.
//
// So scope is now a PARAMETER, and both arguments are required: a caller
// states which positions its question is about, and gets exactly those. A
// collector that picks its own scope is making its other consumer's
// decision silently, which is how a gate stays green by never looking.
//
// THE FIVE POSITIONS, each here because something real occupies it:
//
//   jsx-text   <Text>Pause.</Text>
//   jsx-expr   <Text>{sending ? 'Sending…' : 'Send'}</Text>
//   prop       placeholder="Today I was given…", accessibilityLabel=…
//   alert      Alert.alert('Delete this?', …)
//   constant   src/constants/* — the prompt deck, the spark chips, the legal
//              pages: authored prose no screen file contains
//
// `constant` is a position of the FILE as much as of the node, which is why
// `file` is required rather than optional: a caller that forgot to pass it
// would silently lose 191 strings, and a silently smaller universe is the
// one failure this module exists to prevent.
//
// WHAT IS STILL EXCLUDED, with direction. Non-copy JSX attributes
// (testID, style, variant) are not collected — `testID="demo-toggle"` is
// not something a user reads, and taking it would red the demo gate on a
// test id. TEXT_ATTRS is therefore a NAMED LIST — but it is no longer an
// UNBOUNDED hole: check-copy-rules §A2 partitions every attribute name in
// the tree that carries a string literal into TEXT_ATTRS or its own
// NOT_COPY_ATTRS, so an unclassified name reds. See TEXT_ATTRS below.
//
// OVER-INCLUSION, and why it is the safe direction here. `jsx-expr` takes
// every string inside a child expression, including operands of a
// comparison (`{mode === 'demo' ? … }`). For the copy gate a false member
// costs one re-read. For the demo gate it can only ever red code that is
// correct — never pass code that is wrong — which is the direction both
// gates already commit to in their headers (isUnderGuard's note below,
// check-demo-mode-env's computed-member note). Measured at c364c4c: 2 of
// the 76 jsx-expr strings are comparison operands, and zero of them match
// /demo/i.
//
// WHAT MOVED WHEN THE TWO COLLECTORS BECAME ONE (measured at b5e7754,
// every figure from a side-by-side run of both implementations over the
// same trees, diffed string by string — not read off either gate's total):
//
//   The copy gate's set: 451 → 446 strings, 26 files unchanged, and NO OLD
//   STRING IS LOST — every one is still readable in the new set, in the
//   same file and position. The five are two effects, both corrections:
//
//     - a nested `Alert.alert` inside another Alert's button handler was
//       collected TWICE (Account.js:74's two strings), once by the outer
//       call's recursive sweep and once by the inner call's own visit.
//       Classifying at the NEAREST settling frame gives each string one
//       membership, so a string cannot be counted by two positions or by
//       one position twice.
//     - a template literal was collected as one string PER QUASI, so
//       `Filled the last ${n} days with entries.` entered the set as
//       "Filled the last" and "days with entries." — two fragments of a
//       sentence no user ever reads in halves. It is now joined on the
//       interpolation, which is what the shared walker already did for the
//       demo gate. Joining on a SPACE cannot manufacture a word across the
//       seam, so no matcher can fire on a join that would not fire on the
//       fragments; three templates, all in `alert`/`jsx-expr`.
//
//   The demo gate's set: 105 → 225 strings, and this is the finding rather
//   than the bookkeeping. The old extractor required the
//   JSXExpressionContainer to be the string's IMMEDIATE parent, which only
//   `{'a literal'}` satisfies — so every string rendered through a
//   ternary was outside rule 1's universe: `{sending ? 'Sending…' :
//   'Send'}`, `{tab === 'today' ? 'Today' : 'Last 7 days'}`, and 72 more.
//   Walking outward to the nearest settling frame takes them. /demo/i hits
//   before and after: the same 2, both already guarded — so rule 1's
//   verdict is unchanged and it now stands over a universe 114% larger.
//   Decomposed from the gate's own array, because the first published
//   figure (180) was jsx-text + jsx-expr and silently dropped the third
//   position the same change added:
//
//     jsx-text 105 + jsx-expr 75 + prop 45 = 225
//
// THE VOCABULARY IS PINNED, AND HERE IS WHY A BEHAVIOURAL CONTROL CANNOT
// DO IT. Every instrument in both gates is derived from POSITIONS — the
// per-position control loops, the demo gate's `POSITIONS.filter(…)`, the
// classifier's own refusal to emit an undeclared position. So the edit
// that deletes a member from POSITIONS *and* from `positionFor` is
// coherent: the two halves still agree, every derived control simply has
// one fewer row, and both gates report a clean verdict over a universe
// they quietly shrank (Sage measured it, thread 4510c5c8: dropping
// `jsx-expr` takes 75 strings out of each gate — 33% of rule 1 — with zero
// reds). An enumerator over the classifier's source cannot see it either,
// for the same reason: agreement is exactly what the coherent edit
// preserves.
//
// So check-copy-rules pins the literal five. It is a TRIPWIRE, NOT A
// PROOF — the same instrument, and the same admission, as the demo gate's
// note about its inclusions being a judgement.

export const POSITIONS = ['jsx-text', 'jsx-expr', 'prop', 'alert', 'constant'];
const POSITION_SET = new Set(POSITIONS);

// Thrown when the CLASSIFIER emits a position the VOCABULARY does not
// declare. That is the one failure a `positions` filter would otherwise
// swallow in silence — an undeclared position is never in any caller's
// `wanted` set, so its strings would simply stop being collected and every
// assertion downstream would stay green over a quietly smaller universe.
// Distinguishable from a parse error on purpose: a caller catching both
// must be able to say which one it caught, because "this file is
// unreadable" and "this module's two halves disagree" are different
// findings and an assertion name may only state one of them.
export class PositionVocabularyError extends Error {}

// Attributes a user reads or hears. Exported so check-copy-rules can assert
// against THIS set rather than a second copy of it — a gate matching names
// off a typed list proves a property of the list, not of the walker.
//
// It is still a NAMED LIST, and it shipped with the hole a named list has:
// `title` was here and `eyebrow` was not, so ScreenHeader.js:20-24 rendered
// one collected string and one invisible one, from the same call site,
// through the same <Text> (Sage, thread 4510c5c8). What was outside both
// gates: LoadState's `body`/`actionLabel`/`staleLabel`/`staleActionLabel`
// and four `retryAccessibilityLabel`s — i.e. THE WHOLE §23 ERROR-STATE
// SURFACE on all three screens that carry it, plus `eyebrow` and App.js's
// `gratitudeText`. 21 strings, measured at 6c0c4b8.
//
// The list is no longer the whole defence: check-copy-rules now partitions
// EVERY attribute name that carries a string literal into this set or its
// own NOT_COPY_ATTRS, and an unclassified name reds. So a copy-bearing
// attribute added in November cannot ship unseen — it can only ship after
// somebody has written down which half it belongs to.
export const TEXT_ATTRS = new Set([
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityRoleDescription',
  'retryAccessibilityLabel',
  'title',
  'label',
  'eyebrow',
  'body',
  'actionLabel',
  'staleLabel',
  'staleActionLabel',
  'gratitudeText',
]);

const SKIP_KEYS = new Set([
  'loc', 'start', 'end', 'range', 'extra',
  'leadingComments', 'trailingComments', 'innerComments', 'comments',
]);

// Depth-first walk carrying the ancestor chain. Each ancestry entry is
// { node, key }: the ancestor node and the child slot descended through to
// reach the visited node (arrays are transparent — a JSXElement's children
// all report key 'children'). The slot matters because guard questions are
// about WHICH side of an expression a node sits on, not just what encloses
// it: `DEMO_CONTENT && x` guards its `right`, never its `left`.
export function walkWithAncestry(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) walkWithAncestry(n, visit, ancestors);
    return;
  }
  if (typeof node.type !== 'string') return;
  visit(node, ancestors);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = node[key];
    if (val && typeof val === 'object') {
      walkWithAncestry(val, visit, [...ancestors, { node, key }]);
    }
  }
}

const templateText = (node) =>
  node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(' ');

// A colour or a font token is not prose; everything else prose-shaped in
// src/constants/ is authored copy.
const isProse = (v) =>
  /\s/.test(v) && /[a-z]{2}/.test(v) && !/^(rgba?\(|#[0-9a-f]{3,8}\b)/i.test(v);

const isConstantsFile = (file) =>
  /(^|[\\/])src[\\/]constants[\\/][^\\/]+$/.test(file);

// Which position does a string node occupy? Decided by walking the ancestor
// chain from NEAREST outward and stopping at the first frame that settles
// it — so a string is classified exactly once, and an inner frame always
// wins over an outer one. `<A label={<B>x</B>} />` reaches the inner
// element's children first and is jsx-text, not prop; `<View style={{…}}>`
// hits a non-copy attribute and stops there rather than continuing out to
// the enclosing children slot.
function positionFor(ancestors, file) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const { node, key } = ancestors[i];

    if (node.type === 'JSXAttribute') {
      return TEXT_ATTRS.has(node.name?.name) ? 'prop' : null;
    }
    if (
      node.type === 'JSXExpressionContainer' &&
      ancestors[i - 1]?.key === 'children'
    ) {
      return 'jsx-expr';
    }
    if (
      node.type === 'CallExpression' &&
      key === 'arguments' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.object?.name === 'Alert'
    ) {
      return 'alert';
    }
  }
  return isConstantsFile(file) ? 'constant' : null;
}

// All rendered strings in a parsed file, each as
// { value, line, position, node, ancestors }. `ancestors` is the walk's
// chain for the value node itself, so a caller can ask positional questions
// (guards); callers that only want the words read `value` and ignore the
// rest.
//
// Both options are required. `positions` must be a non-empty subset of
// POSITIONS — an unknown one throws rather than returning quietly less,
// because the whole point of this signature is that a caller cannot end up
// with a smaller universe than it thinks it asked for.
export function collectRenderedStrings(ast, { file, positions } = {}) {
  if (typeof file !== 'string' || !file) {
    throw new Error('collectRenderedStrings: `file` is required (constant position is file-scoped)');
  }
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error('collectRenderedStrings: `positions` is required — the question chooses its scope');
  }
  const unknown = positions.filter((p) => !POSITION_SET.has(p));
  if (unknown.length) {
    throw new Error(`collectRenderedStrings: unknown position(s) ${JSON.stringify(unknown)}; known: ${JSON.stringify(POSITIONS)}`);
  }
  const wanted = new Set(positions);

  const found = [];
  const take = (value, position, node, ancestors) => {
    // Vocabulary before filter, always — see PositionVocabularyError. If
    // this ran after `wanted`, a classifier emitting an undeclared position
    // would be invisible to every caller that didn't ask for it, which is
    // every caller.
    if (!POSITION_SET.has(position)) {
      throw new PositionVocabularyError(
        `classifier emitted position ${JSON.stringify(position)} at ${file}:${node.loc?.start.line}; POSITIONS declares ${JSON.stringify(POSITIONS)}`
      );
    }
    if (!wanted.has(position)) return;
    const v = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!v) return;
    found.push({ value: v, line: node.loc?.start.line, position, node, ancestors });
  };

  walkWithAncestry(ast.program, (node, ancestors) => {
    if (node.type === 'JSXText') {
      take(node.value, 'jsx-text', node, ancestors);
      return;
    }
    if (node.type !== 'StringLiteral' && node.type !== 'TemplateLiteral') return;
    const position = positionFor(ancestors, file);
    if (!position) return;
    // `constant` is the one position with no syntactic evidence that a
    // string is copy — src/constants/ also holds colour and token strings —
    // so it carries a prose filter the other four don't need.
    //
    // THE FILTER IS ON THE TEXT, NOT ON THE NODE TYPE. This previously read
    // `node.type === 'StringLiteral' && isProse(node.value)`, which dropped
    // EVERY template literal in src/constants/ by type: twelve privacy-policy
    // and terms bodies plus one token, unguarded, with `hallelujah` provably
    // shippable inside `PRIVACY_POLICY` at a green gate (Pixel, `c84e3b61`;
    // control by Sage at `8f4466df` — the same word as a StringLiteral in the
    // same file reds correctly).
    //
    // Quasis are joined with '' rather than templateText's ' ' ON PURPOSE:
    // the question is whether THE COPY has whitespace, not whether the
    // RECONSTRUCTION does. Joining with ' ' inserts a space at every
    // interpolation, so `demo-${id}` reconstructs as "demo- " and passes the
    // whitespace test — a token admitted as prose, and the filter quietly
    // stops meaning anything for templates. Measured on this tree: join(' ')
    // admits 13 (including demoHive.js:88's token), join('') admits 12 (all
    // twelve legalCopy bodies, token correctly rejected).
    if (position === 'constant') {
      const text = node.type === 'StringLiteral'
        ? node.value
        : node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
      if (!isProse(text)) return;
    }
    const value = node.type === 'StringLiteral' ? node.value : templateText(node);
    take(value, position, node, ancestors);
  });
  return found;
}

// Is a node (given its ancestry) inside a conditional guarded by `flagName`?
// Recognises the two shapes in use on this tree:
//   {FLAG && <X/>}                      — node under the `right` of the &&
//   FLAG ? withDemo : without           — node under the `consequent`
//
// Any other guard shape — a negated ternary, `FLAG && a && b`'s outer arm,
// an `if (!FLAG) return null` early return — reds the caller's assertion on
// code that may be correct. That is the safe direction (red-on-correct-code,
// never green-on-a-trap, same convention as check-demo-mode-env's computed-
// member note): extend this recogniser when a legitimate shape appears,
// against this comment, rather than pre-approving shapes nothing uses.
export function isUnderGuard(ancestors, flagName) {
  return ancestors.some(({ node, key }) =>
    (node.type === 'LogicalExpression' &&
      node.operator === '&&' &&
      key === 'right' &&
      node.left.type === 'Identifier' &&
      node.left.name === flagName) ||
    (node.type === 'ConditionalExpression' &&
      key === 'consequent' &&
      node.test.type === 'Identifier' &&
      node.test.name === flagName)
  );
}
