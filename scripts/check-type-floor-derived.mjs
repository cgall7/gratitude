// Companion to check-type-floor (thread 37fb8ef6, WP-8): Sage's audit of
// that gate found the hole its own design admits to — "a literal is the
// same number whether or not..." only holds for `fontSize: N`. Four sites
// write `fontSize: propName * multiplier` instead (Avatar.js, HoneycombGrid
// .js x2, StreakBadge.js), and a literal-only gate is blind to all four by
// construction, not by oversight.
//
//   npm run check:type-floor-derived
//
// The floor for a derived size isn't the multiplier alone — it's
// min(every value the prop can actually take at a call site) * multiplier.
// So this gate does the thing check-nav-depth already established as the
// house rule for exactly this shape of claim: ENUMERATE the call sites off
// the tree, don't hardcode the numbers Sage measured today. Hardcoding
// `34 * 0.36 = 12.24` would make this gate a comment with a checksum — it
// would stay green forever, including the day someone adds
// `<Avatar size={20}>` two lines below the one it was written to guard.
//
// ONE LEVEL OF INDIRECTION IS MODELLED, BECAUSE ONE EXISTS TODAY.
// HexCell and EmptyCell are never rendered from outside HoneycombGrid.js —
// HoneycombGrid renders them itself, threading its own `cellSize` prop in
// as their `size`. A call-site search for `<HexCell` or `<EmptyCell` across
// src/ finds exactly one hit each, inside their own file, passing an
// IDENTIFIER (`cellSize`) rather than a literal. Resolving that identifier
// means: is it a local `const`? A prop of the component that's doing the
// rendering? If the latter, the search recurses onto THAT component's own
// call sites. Capped at a few hops and memoised per component so a cycle
// can't spin it forever — not because one is expected, but because an
// unbounded recursive gate that hangs looks identical to a hung test run,
// and the person debugging that has no way to tell which they're looking
// at from the outside.
//
// FAILS CLOSED. A value this gate cannot resolve — a runtime expression, an
// import from another module, a prop with no default that no call site
// supplies — is reported as its own failure line, the same call check-
// nav-depth makes for an unattributable getParent() site: unreadable is
// not the same as passing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FLOOR = 11;

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(name)) files.push(p);
  }
})(SRC);

const fileText = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const rel = (f) => path.relative(ROOT, f);

// A React functional component defined as `const Name = ({ props }) => {`.
// The destructure can and does span many lines with `//` comments inside
// it (HoneycombGrid's `cellSize` block) — one of those comments contains a
// stray `)`, which broke a first version of this scan that looked for the
// nearest `)` rather than balancing braces. Braces are balanced with
// line-comments stripped instead, so a parenthetical aside in a comment
// can't be mistaken for the destructure's own close.
const COMPONENT_START_RE = /^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*\(\{/gm;

function componentsIn(text) {
  const out = [];
  for (const m of text.matchAll(COMPONENT_START_RE)) {
    const braceStart = m.index + m[0].length - 1; // the `{` itself
    let depth = 0;
    let i = braceStart;
    for (; i < text.length; i += 1) {
      if (text[i] === '/' && text[i + 1] === '/') {
        const nl = text.indexOf('\n', i);
        i = nl === -1 ? text.length : nl;
        continue;
      }
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue; // unbalanced — not a shape this gate can read
    const after = text.slice(i + 1, i + 20);
    if (!/^\s*\)\s*=>/.test(after)) continue; // not `}) => {` — some other brace
    out.push({ name: m[1], propsText: text.slice(braceStart + 1, i), index: m.index });
  }
  return out;
}

// The component whose body contains `index` — approximated as "the last
// component start at or before index", which holds as long as components
// in a file are sequential top-level consts and not nested. True for every
// file this gate has looked at; a file that broke the assumption would
// misattribute a site to its predecessor, not crash, so the risk is a wrong
// component name in a report — checkable by a human reading the failure —
// not a silent pass.
function enclosingComponent(text, index) {
  const comps = componentsIn(text);
  let owner = null;
  for (const c of comps) {
    if (c.index <= index) owner = c;
    else break;
  }
  return owner;
}

function propDefault(propsText, propName) {
  const m = propsText.match(new RegExp(`\\b${propName}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) : null;
}

function localConst(text, ident) {
  const m = text.match(new RegExp(`\\bconst\\s+${ident}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`));
  return m ? Number(m[1]) : null;
}

// Every self-closing JSX use of `componentName` across the whole tree,
// as { file, index, attrsText }. Deliberately whole-tree, not "everywhere
// except this file" — HexCell's only call site IS inside its own file, and
// excluding it would make the indirection case unresolvable by
// construction instead of by what's actually on disk.
function callSites(componentName) {
  const sites = [];
  const tagRe = new RegExp(`<${componentName}\\b`, 'g');
  for (const f of files) {
    const text = fileText.get(f);
    for (const m of text.matchAll(tagRe)) {
      const close = text.indexOf('/>', m.index);
      if (close === -1) {
        sites.push({ file: f, index: m.index, attrsText: null, unresolvedReason: 'not self-closing' });
        continue;
      }
      sites.push({ file: f, index: m.index, attrsText: text.slice(m.index, close) });
    }
  }
  return sites;
}

// Resolve what value `propName` takes at a single call site: a literal, a
// local const, or (one hop) a prop of the component rendering that call
// site, in which case the answer becomes "the minimum across THAT
// component's own call sites" and this function recurses.
function resolveAtCallSite(site, propName, depth, seen) {
  if (site.attrsText === null) {
    return { ok: false, reason: `${rel(site.file)}: ${site.unresolvedReason}` };
  }
  const attrM = site.attrsText.match(new RegExp(`\\b${propName}\\s*=\\s*\\{([^}]+)\\}`));
  if (!attrM) {
    // Not passed at this call site — falls through to whatever this
    // function's own default resolves to, handled by the caller.
    return { ok: true, usesDefault: true };
  }
  const expr = attrM[1].trim();
  if (/^-?\d+(?:\.\d+)?$/.test(expr)) {
    return { ok: true, value: Number(expr) };
  }
  const text = fileText.get(site.file);
  const asConst = localConst(text, expr);
  if (asConst !== null) return { ok: true, value: asConst };

  // Not a literal, not a local const — is it a prop of the component that's
  // rendering this call site? If so, recurse onto THAT component's call
  // sites, one hop closer to something concrete.
  const owner = enclosingComponent(text, site.index);
  if (owner && new RegExp(`(^|[,{])\\s*${expr}\\b`).test(owner.propsText)) {
    const sub = resolveDerived(owner.name, expr, propDefault(owner.propsText, expr), depth + 1, seen);
    if (!sub.ok) {
      return { ok: false, reason: `${rel(site.file)}: \`${propName}={${expr}}\` via ${owner.name}.${expr} — ${sub.problems.join('; ')}` };
    }
    return { ok: true, value: sub.min };
  }
  return { ok: false, reason: `${rel(site.file)}: \`${propName}={${expr}}\` — not a literal, local const, or traceable prop` };
}

// The value range a `componentName`'s `propName` can take, as the minimum
// over every call site plus the component's own default (a call site that
// omits the prop uses it). Memoised and depth-capped: not because a cycle
// is expected in five files, but because a recursive gate that hangs is
// indistinguishable from a hung test run to whoever is staring at it.
function resolveDerived(componentName, propName, ownDefault, depth = 0, seen = new Set()) {
  const key = `${componentName}.${propName}`;
  if (seen.has(key) || depth > 4) {
    return { ok: false, reason: `${key}: indirection too deep or cyclic (>4 hops)` };
  }
  seen.add(key);

  const sites = callSites(componentName);
  const candidates = [];
  const problems = [];

  if (ownDefault !== null) candidates.push(ownDefault);

  for (const site of sites) {
    const r = resolveAtCallSite(site, propName, depth, seen);
    if (!r.ok) {
      problems.push(r.reason);
    } else if (r.usesDefault) {
      if (ownDefault === null) problems.push(`${rel(site.file)}: omits \`${propName}\` and ${componentName} has no default for it`);
      // else already counted via ownDefault above
    } else {
      candidates.push(r.value);
    }
  }

  if (sites.length === 0 && ownDefault === null) {
    problems.push(`${componentName} is never used as JSX anywhere in src/, and has no default for \`${propName}\``);
  }

  return { ok: problems.length === 0, min: candidates.length ? Math.min(...candidates) : null, problems };
}

// --- Find every `fontSize: prop * multiplier` site --------------------
const DERIVED_RE = /fontSize:\s*([A-Za-z_$][\w$]*)\s*\*\s*(-?\d+(?:\.\d+)?)/g;
const sites = [];
for (const f of files) {
  const text = fileText.get(f);
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = DERIVED_RE.exec(line);
    DERIVED_RE.lastIndex = 0;
    if (!m) return;
    const [, propName, multStr] = m;
    const multiplier = Number(multStr);
    const charIndex = lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
    const owner = enclosingComponent(text, charIndex);
    sites.push({ file: f, line: i + 1, propName, multiplier, owner });
  });
}

let pass = 0;
let fail = 0;
const failures = [];

for (const s of sites) {
  const loc = `${rel(s.file)}:${s.line}`;
  if (!s.owner) {
    fail += 1;
    failures.push(`${loc} — \`fontSize: ${s.propName} * ${s.multiplier}\` has no enclosing component this gate recognises`);
    continue;
  }
  const ownDefault = propDefault(s.owner.propsText, s.propName);
  const result = resolveDerived(s.owner.name, s.propName, ownDefault);

  if (!result.ok) {
    fail += 1;
    failures.push(`${loc} — ${s.owner.name}.${s.propName} * ${s.multiplier}: cannot verify\n` +
      result.problems.map((p) => `      ${p}`).join('\n'));
    continue;
  }

  const minFontSize = result.min * s.multiplier;
  if (minFontSize < FLOOR) {
    fail += 1;
    failures.push(`${loc} — ${s.owner.name}.${s.propName} * ${s.multiplier}: min ${s.propName} is ${result.min} ` +
      `→ fontSize ${minFontSize} (floor is ${FLOOR})`);
  } else {
    pass += 1;
  }
}

if (sites.length === 0) {
  console.log('No `fontSize: prop * multiplier` sites found — nothing to check.');
} else if (failures.length) {
  console.log('Below floor or unverifiable:');
  failures.forEach((f) => console.log(`  FAIL ${f}`));
} else {
  sites.forEach((s) => console.log(`  ok   ${rel(s.file)}:${s.line} — ${s.owner.name}.${s.propName} * ${s.multiplier}`));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
