// Gate 1 of the luxury pass (Lumen, thread 6596d9c2, Lane G): no raw color
// literal outside `src/constants/theme.js`.
//
//   npm run check:token-literals
//
// WHY THIS EXISTS
//
// Lumen's audit (dae6685) found the same failure in four shapes across the
// tree: two inks doing one scrim's job (`rgba(34,27,3,·)` /
// `rgba(26,21,0,·)`), three whites standing in for one glass fill plus a
// drifting rim, `accent` hand-copied as `rgba(255,210,0,0.6)` — the exact
// trap `theme.js`'s own opening comment warns about — and, found only in her
// follow-up correction, alpha spliced onto a token by string concatenation
// (`theme.colors.surface + 'D9'`), which is invisible to a scan keyed on
// `rgba(` or `#RRGGBB` because it never contains either. A gate that only
// caught the first three shapes would go green while the fourth kept
// shipping.
//
// WHAT THIS GATE ASSERTS, IN THREE PARTS
//
//   1. No string literal (or template-literal quasi) anywhere in `src/`,
//      `theme.js` excluded, contains a `#RRGGBB`/`#RGB` hex color or an
//      `rgba(...)`/`rgb(...)` call.
//   2. No `theme.colors.X + '<2 hex chars>'` / `colors.X + '<2 hex chars>'`
//      — alpha belongs in the token, never spliced at the call site.
//   3. Both sweeps are AST-driven (StringLiteral / TemplateElement /
//      BinaryExpression nodes), not raw-text regex — which is what makes
//      (1) immune to the false-positive class this repo already hit once:
//      every `#RRGGBB` this gate's own calibration run turns up outside
//      `theme.js` today is prose inside a `//` comment doing ΔE/contrast
//      arithmetic (Onboarding.js:1036, RecapTab.js:392-398, PlantSeed.js:405,
//      SeedsInbox.js:398-433, revealSequencer.js:341-342,
//      HoneycombGrid.js:153). A text-regex sweep would have to name every one
//      of those as an exclusion, and the list only grows as more ΔE
//      commentary gets written. Walking StringLiteral nodes instead means a
//      comment is never in the universe to begin with — nothing to exclude,
//      because a `//` line was never a candidate.
//
// ONE NAMED EXCLUSION — CODE, NOT A COMMENT, THAT STILL MATCHES THE PATTERN
//
// A comment is structurally invisible to an AST string-literal walk, so it
// needs no exclusion.
//
//   - revealSequencer.js:332 is itself inside a `//` comment (dead code for
//     the hex sweep per the point above), listed here only so the
//     self-check below has something to confirm against if that ever
//     changes.
//
// PollinateWrapped.js:261 was excluded here originally, on Lumen's word that
// `rgba(34,27,3,0.15)` was an interpolation endpoint rather than a scrim. Her
// own follow-up correction (thread 6596d9c2) reread the call site: it is
// `ProgressSegment`'s track background, the exact component §23.11 already
// ruled, shipping the exact alpha §23.11 ruled a defect (1.36:1 against a
// 3:1 floor) — not a defect-free exclusion at all. Her token commit fixes it
// to `theme.colors.trackDim`, so once that commit lands the literal is gone
// from source and the exclusion has nothing left to be grounded against.
// Removed rather than left in place: this gate's own "exclusion must still
// match" self-check caught the staleness the moment I re-checked it against
// her correction — proof the check-then-list design was worth having. Until
// her commit merges, removing this exclusion makes the gate correctly red on
// the real defect instead of green over it.
//
// Each exclusion is verified present in the raw candidate set before it is
// subtracted (`EXCLUSIONS not found in the candidate set` below) — an
// exclusion that stops matching anything is a stale exclusion, and silently
// keeping it would let the gate's own coverage shrink without anyone
// noticing (the same trap Lumen's A2 correction names from the other side:
// an exclusion this gate can't prove is grounded is not safe to keep).
//
// CALIBRATION (Lumen: "calibrate before you trust its reds")
//
// Two synthetic fixtures below, parsed independently of `src/`:
//   - a RECALL fixture containing one hex literal, one rgba literal and one
//     alpha-concat expression — the detector must find all three, proving it
//     isn't silently broken.
//   - a PRECISION fixture built only from `theme.colors.*` references and a
//     `//` comment that itself contains an rgba string — the detector must
//     find nothing, proving a token reference and a comment don't false-fire.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const THEME_FILE = path.join(SRC, 'constants', 'theme.js');

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') walk(val, visit);
  }
};

const HEX_RE = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/;
const RGBA_RE = /\brgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/;
const ALPHA_HEX_RE = /^[0-9A-Fa-f]{2}$/;

// Root of a `theme.colors.X` / `colors.X` member chain: object is
// `theme.colors` or bare `colors`, property is any identifier.
const isColorsMember = (n) => {
  if (n?.type !== 'MemberExpression' || n.computed) return false;
  const obj = n.object;
  const bareColors = obj?.type === 'Identifier' && obj.name === 'colors';
  const themeColors =
    obj?.type === 'MemberExpression' &&
    !obj.computed &&
    obj.property?.name === 'colors' &&
    obj.object?.type === 'Identifier';
  return (bareColors || themeColors) && n.property?.type === 'Identifier';
};

// Scans a parsed AST for both defect shapes. Returns raw candidates —
// caller applies exclusions and reports.
const scanAst = (ast, rel, source) => {
  const hits = [];
  walk(ast, (n) => {
    if ((n.type === 'StringLiteral' && typeof n.value === 'string') && (HEX_RE.test(n.value) || RGBA_RE.test(n.value))) {
      hits.push({ file: rel, line: n.loc.start.line, kind: 'literal', text: n.value });
    }
    if (n.type === 'TemplateElement' && typeof n.value?.cooked === 'string' && (HEX_RE.test(n.value.cooked) || RGBA_RE.test(n.value.cooked))) {
      hits.push({ file: rel, line: n.loc.start.line, kind: 'literal', text: n.value.cooked });
    }
    if (
      n.type === 'BinaryExpression' &&
      n.operator === '+' &&
      isColorsMember(n.left) &&
      n.right?.type === 'StringLiteral' &&
      ALPHA_HEX_RE.test(n.right.value)
    ) {
      hits.push({
        file: rel,
        line: n.loc.start.line,
        kind: 'alpha-concat',
        text: source.slice(n.left.start, n.right.end),
      });
    }
  });
  return hits;
};

// --- calibration: recall fixture -------------------------------------------
const RECALL_FIXTURE = `
const styles = {
  a: { backgroundColor: '#FF00AA' },
  b: { backgroundColor: 'rgba(1, 2, 3, 0.4)' },
  c: { backgroundColor: theme.colors.surface + 'D9' },
};
`;
const recallAst = parse(RECALL_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
const recallHits = scanAst(recallAst, 'fixture', RECALL_FIXTURE);
check('calibration: recall fixture finds the hex literal', recallHits.some((h) => h.text === '#FF00AA'), true);
check('calibration: recall fixture finds the rgba literal', recallHits.some((h) => h.text.startsWith('rgba(')), true);
check('calibration: recall fixture finds the alpha-concat', recallHits.some((h) => h.kind === 'alpha-concat'), true);
check('calibration: recall fixture finds exactly 3, nothing extra', recallHits.length, 3);

// --- calibration: precision fixture (a comment must not false-fire) -------
const PRECISION_FIXTURE = `
// scrim used to be rgba(0,0,0,0.4) before it was tokenized
const styles = {
  a: { backgroundColor: theme.colors.scrim },
  b: { borderColor: colors.surfaceBorder },
};
`;
const precisionAst = parse(PRECISION_FIXTURE, { sourceType: 'module', plugins: ['jsx'] });
check('calibration: precision fixture (token refs + a literal-bearing comment) finds nothing', scanAst(precisionAst, 'fixture', PRECISION_FIXTURE).length, 0);

// --- the real sweep ---------------------------------------------------------
const files = [];
(function walkDir(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (/\.jsx?$/.test(name) && p !== THEME_FILE) files.push(p);
  }
})(SRC);

check('source files found under src/ (theme.js excluded)', files.length > 0, true);

const candidates = [];
const parseErrors = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  try {
    const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    candidates.push(...scanAst(ast, rel, fs.readFileSync(file, 'utf8')));
  } catch (e) {
    parseErrors.push(`${rel}: ${e.message}`);
  }
}
check('every file parsed', parseErrors, []);

const EXCLUSIONS = [];

for (const ex of EXCLUSIONS) {
  const grounded = candidates.some((c) => c.file === ex.file && c.line === ex.line);
  check(`exclusion is grounded: ${ex.file}:${ex.line} actually matched the pattern (${ex.reason})`, grounded, true);
}

const violations = candidates.filter((c) => !EXCLUSIONS.some((ex) => ex.file === c.file && ex.line === c.line));

console.log(`\n--- raw color literals outside theme.js (${violations.length}) ---`);
for (const v of violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.log(`  ${v.file}:${v.line}  [${v.kind}]  ${v.text}`);
}
check('no raw color literal (or alpha-concat) outside theme.js', violations, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
