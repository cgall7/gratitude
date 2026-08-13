// Gate for 8.2's compose rules (src/utils/seedDraft.js), against the store
// they have to agree with (src/services/SeedsStore.js).
//
//   npm run check:plant-seed
//
// WHAT THIS IS FOR, and it is one thing.
//
// `PlantSeed.js` decides whether "Plant this seed" is pressable. `plantSeed`
// decides whether the same draft is sendable. Those are two files, two authors
// and two futures, and when they drift the user is the one who finds out: the
// button lights up, they press it, and the store throws the sentence the
// button existed to prevent. So this gate does not check either rule against a
// list I typed out — it runs BOTH and asserts they return the same answer, for
// the same draft, with the same words. A copy of the rules would drift with
// them; a comparison cannot.
//
// Same seam as check-seeds-contract.mjs: `./supabase` is an RN/Expo module
// that will not load in plain Node, so it is stubbed at RESOLVE time and the
// modules under test are untouched and unaware. Like that gate, there is no
// Postgres here and therefore no skip path — it runs everywhere, always.
//
// What it deliberately does NOT prove: that `PlantSeed.js` renders. It is JSX
// against React Native and there is no renderer in this repo. §5 asserts only
// that the screen imports the shared rule rather than re-inlining it, which is
// a source check and labelled as one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof registerHooks !== 'function') {
  console.error('Needs Node >= 22.15 for module.registerHooks(). Found ' + process.version);
  process.exit(1);
}

const STUB_SOURCE = `
export const isSupabaseConfigured = true;
export const supabase = globalThis.__PLANT_STUB_CLIENT__;
`;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './supabase' || spec === './supabase.js') {
      return { url: 'plant-stub:supabase', shortCircuit: true };
    }
    if (spec.startsWith('.') && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'plant-stub:supabase') return { format: 'module', source: STUB_SOURCE, shortCircuit: true };
    return next(url, ctx);
  },
});

// The happy path the store would take if its own guards let the draft through:
// `plant_seed` succeeds. That matters — it means every rejection this gate sees
// came from a guard, not from a stub that refuses everything.
const RECIPIENT = 'user-recipient';
globalThis.__PLANT_STUB_CLIENT__ = {
  auth: { getUser: async () => ({ data: { user: { id: 'user-sender' } } }) },
  rpc: async () => ({
    data: { id: 'seed-1', bloom_at: new Date().toISOString(), created_at: new Date().toISOString(), opened_at: null },
    error: null,
  }),
  from() {
    const chain = { select: () => chain, eq: () => chain, is: () => chain, order: async () => ({ data: [], error: null }), update: () => chain, delete: () => chain };
    return chain;
  },
};

const { SeedsStore, SEED_CONTENT_MAX } = await import(pathToFileURL(path.join(ROOT, 'src/services/SeedsStore.js')).href);
const { validateSeedDraft, bloomFloor, sealHint, bloomHint, bloomDateLabel, SEED_DRAFT_REASONS } = await import(
  pathToFileURL(path.join(ROOT, 'src/utils/seedDraft.js')).href
);

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label}\n         ${detail}`);
};
const eq = (label, got, want) =>
  got === want ? ok(label) : bad(label, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const NOW = new Date('2026-08-13T12:00:00.000Z');
const day = (n) => new Date(NOW.getTime() + n * 86400000);

// ---------------------------------------------------------------------------
console.log('\n  §1 — the button and the store agree, draft for draft');

// `now` is pinned so "tomorrow" means the same instant in both halves. The
// store reads the real clock, so every future date here is far enough out that
// the two clocks cannot disagree about which side of the line it falls on.
const DRAFTS = [
  ['a complete draft', { recipientId: RECIPIENT, content: 'thank you for the lift', bloomAt: day(30) }],
  ['empty text', { recipientId: RECIPIENT, content: '', bloomAt: day(30) }],
  ['whitespace-only text', { recipientId: RECIPIENT, content: '   \n  ', bloomAt: day(30) }],
  ['text at the cap', { recipientId: RECIPIENT, content: 'x'.repeat(SEED_CONTENT_MAX), bloomAt: day(30) }],
  ['text one over the cap', { recipientId: RECIPIENT, content: 'x'.repeat(SEED_CONTENT_MAX + 1), bloomAt: day(30) }],
  ['whitespace padding does not count toward the cap', { recipientId: RECIPIENT, content: `  ${'x'.repeat(SEED_CONTENT_MAX)}  `, bloomAt: day(30) }],
  ['a bloom date in the past', { recipientId: RECIPIENT, content: 'hi', bloomAt: day(-1) }],
  ['an unparseable bloom date', { recipientId: RECIPIENT, content: 'hi', bloomAt: 'next Thursday-ish' }],
  ['no bloom date at all', { recipientId: RECIPIENT, content: 'hi', bloomAt: null }],
];

for (const [label, draft] of DRAFTS) {
  const verdict = validateSeedDraft(draft, NOW);
  let thrown = null;
  try {
    await SeedsStore.plantSeed(draft.recipientId, draft.content, draft.bloomAt);
  } catch (e) {
    thrown = e;
  }

  if (verdict.ok === !thrown) {
    ok(`${label}: both ${verdict.ok ? 'accept' : 'refuse'}`);
  } else {
    bad(
      `${label}: they disagree`,
      verdict.ok
        ? `the button would enable, the store threw "${thrown.message}" — a user hits this as a failed send`
        : `the button is dead, the store would have accepted it — a user cannot send a valid seed`
    );
  }

  // A shared verdict is only half of it. If the two refuse for different
  // reasons, the screen is showing a sentence about a rule that isn't the one
  // that actually stopped it.
  if (!verdict.ok && thrown) {
    eq(`${label}: same words`, verdict.message, thrown.message);
  }
}

// ---------------------------------------------------------------------------
console.log('\n  §2 — the one asymmetry, pinned so it stays deliberate');

// `plantSeed` does not check the recipient: from anywhere but this screen the
// authority on that is Postgres (`no_self_seed`, the FK on recipient_id). The
// screen must, because an unpicked chip is the likeliest empty field on the
// form. Asserting it here means the asymmetry is a decision on the record
// rather than a hole someone closes by accident and someone else reopens.
const noRecipient = validateSeedDraft({ recipientId: null, content: 'hi', bloomAt: day(30) }, NOW);
eq('the screen refuses a draft with no recipient', noRecipient.ok, false);
eq('...and names that as the reason', noRecipient.reason, SEED_DRAFT_REASONS.NO_RECIPIENT);
let storeThrew = false;
try {
  await SeedsStore.plantSeed(undefined, 'hi', day(30));
} catch {
  storeThrew = true;
}
eq('the store does NOT — that rule is Postgres\'s, not the client\'s', storeThrew, false);

// ---------------------------------------------------------------------------
console.log('\n  §3 — the bloom floor is safe to hand the picker as minimumDate');

// `seeds_bloom_after_planting` is `bloom_at > created_at`. The picker's floor
// is the only thing standing between a user and a seed that blooms before it
// is planted, so picking the floor itself has to validate — if it did not, the
// picker would offer a date the CTA then refuses.
const floor = bloomFloor(NOW);
eq('the floor is strictly in the future', floor.getTime() > NOW.getTime(), true);
eq('the floor is a full day out, not a second', floor.getTime() - NOW.getTime(), 86400000);
eq(
  'a draft dated exactly at the floor is plantable',
  validateSeedDraft({ recipientId: RECIPIENT, content: 'hi', bloomAt: floor }, NOW).ok,
  true
);
eq(
  'one millisecond before the floor is still plantable (the floor is not the rule, "future" is)',
  validateSeedDraft({ recipientId: RECIPIENT, content: 'hi', bloomAt: new Date(floor.getTime() - 1) }, NOW).ok,
  true
);
eq(
  'the current instant is not',
  validateSeedDraft({ recipientId: RECIPIENT, content: 'hi', bloomAt: new Date(NOW.getTime()) }, NOW).reason,
  SEED_DRAFT_REASONS.DATE_IN_PAST
);

// ---------------------------------------------------------------------------
console.log('\n  §4 — the two hints read before a recipient is picked');

// GRATITUDE_COPY_LIBRARY §4 (8.2) interpolates a name into both. Deezine wrote
// them with a name in place; the screen renders them with no name for as long
// as the form is blank, and a sentence with a hole in it is worse than a
// vaguer one.
eq('seal hint, named', sealHint('Maya'), "Sealed until it blooms — Maya won't see this until then.");
eq('seal hint, nobody picked', sealHint(null), "Sealed until it blooms — they won't see this until then.");
eq('bloom hint, named', bloomHint('Maya', 'March 3, 2027'), "Maya won't see this until March 3, 2027.");
eq('bloom hint, nobody picked', bloomHint(null, 'March 3, 2027'), "They won't see this until March 3, 2027.");
// The fallback used to be picked by lower-casing the name and comparing it to
// "they", which would also have caught a person actually called They.
eq('a person named They keeps their capital', bloomHint('They', 'March 3, 2027'), "They won't see this until March 3, 2027.");
eq('no date -> no label, rather than "Invalid Date"', bloomDateLabel(null), null);

// ---------------------------------------------------------------------------
console.log('\n  §5 — source check (labelled: this proves wiring, not behaviour)');

const screen = fs.readFileSync(path.join(ROOT, 'src/screens/PlantSeed.js'), 'utf8');
eq('PlantSeed imports the shared rule', /validateSeedDraft/.test(screen), true);
eq(
  'PlantSeed does not re-inline the length rule',
  /content[^\n]*\.length\s*>\s*SEED_CONTENT_MAX/.test(screen),
  false
);
// This assertion used to read `/connectionsState === 'failed'/` — a variable
// spelling from an earlier draft of the screen. The screen was refactored to
// derive its view through `resolveListView`, the assertion was not, and it went
// red while the behaviour it names was in fact CORRECT. A false negative rather
// than a false green, but the same root as the one Sage has been marking all
// day: an assertion survives the code it was written about.
//
// So it no longer names an identifier. It names the two things §23.1 actually
// requires of a consumer, and both are properties a rename cannot fake:
eq('PlantSeed derives its view rather than choosing it', /resolveListView\(/.test(screen), true);
eq(
  'PlantSeed never renders a branch off a bare row count (§23.1)',
  /connections\.length\s*===\s*0/.test(screen),
  false
);
// The behaviour itself — that `empty` is unreachable without a read that
// returned — is executed, not grepped, in check-load-state.mjs.

console.log(`\ncheck-plant-seed: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
