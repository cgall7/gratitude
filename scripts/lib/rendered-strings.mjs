// Shared AST helpers for gates that ask questions about RENDERED STRINGS —
// the text a user actually reads off a screen — rather than about source
// lines (Sage, thread 4510c5c8: "collect rendered string literals, then ask
// a question about them. One walker, two questions").
//
// Two consumers by design:
//   - check-demo-content-callsites asks "is this rendered string inside a
//     DEMO_CONTENT guard?"
//   - the copy gate (Pixel's lane, same thread) asks "does this rendered
//     string contain a forbidden word?" — it should import
//     collectRenderedStrings from here rather than re-extracting, so the two
//     gates can never disagree about what "rendered" means.
//
// WHAT COUNTS AS RENDERED — text position only:
//   - JSXText with non-whitespace content
//   - StringLiteral / TemplateLiteral inside a JSXExpressionContainer that
//     sits in a children slot ({`...`} or {'...'} between tags)
//
// Deliberately EXCLUDED, with direction:
//   - JSX attribute values. testID="demo-toggle" and accessibility ids are
//     not user-visible copy, and including attributes would red them falsely.
//     The cost runs the other way for the few attributes a user CAN read
//     (placeholder, accessibilityLabel): a "demo" placeholder would pass
//     unseen — green-on-a-trap, stated here rather than discovered later.
//   - Strings outside JSX entirely (Alert.alert copy, thrown messages).
//     Alert copy is user-visible but only reachable through whatever
//     affordance triggers it; the affordance is the gate's subject.

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

// All rendered strings in a parsed file, each as
// { value, line, node, ancestors }. `ancestors` is the walk's chain for the
// value node itself, so a caller can ask positional questions (guards);
// callers that only want the words read `value` and ignore the rest.
export function collectRenderedStrings(ast) {
  const found = [];
  walkWithAncestry(ast.program, (node, ancestors) => {
    if (node.type === 'JSXText') {
      const value = node.value.replace(/\s+/g, ' ').trim();
      if (value) found.push({ value, line: node.loc.start.line, node, ancestors });
      return;
    }
    if (node.type !== 'StringLiteral' && node.type !== 'TemplateLiteral') return;
    const container = ancestors[ancestors.length - 1];
    const slot = ancestors[ancestors.length - 2];
    if (
      container?.node.type === 'JSXExpressionContainer' &&
      slot?.key === 'children'
    ) {
      const value = node.type === 'StringLiteral' ? node.value : templateText(node);
      if (value.trim()) found.push({ value, line: node.loc.start.line, node, ancestors });
    }
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
