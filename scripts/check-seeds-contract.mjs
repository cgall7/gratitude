// Gate for the Seeds client contract (src/services/SeedsStore.js), §22.1–22.3.
//
//   npm run check:seeds-contract
//
// Distinct from check-seeds-rls.mjs, which proves the *database* keeps the seal.
// This proves the *client* reports it honestly, and it is the half that has no
// Postgres in it at all — so unlike the RLS gates it has no heavy dependency
// and no skip path to get wrong. It runs everywhere, always.
//
// What it is defending, in one line: **`content` is what you may read right
// now; `hasBloomed(seed)` is whether the seed is sealed.** §22.1 ruled those
// apart after I had conflated them, and the conflation is easy to reintroduce
// because it is true in the single case anyone tests by hand (a received,
// still-sealed seed). It is false in three others, which is why they are the
// cases below.
//
// Two rules this file tries to keep:
//
//   1. RUN THE REAL MODULE. `SeedsStore.js` is imported and executed, never
//      re-implemented. Its one dependency (`./supabase`) is an RN/Expo module
//      that cannot load in plain Node, so it is stubbed at RESOLVE time via the
//      same registerHooks seam check-demo-hive.mjs already uses — the module
//      under test is untouched and unaware.
//   2. DRIVE IT THROUGH THE PUBLIC SURFACE. `shapeSeed` is private and stays
//      private; it is exercised through `plantSeed`/`listReceived` with a
//      scripted client, so this gate breaks if the normalisation moves but not
//      if it is merely renamed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof registerHooks !== 'function') {
  console.error('Needs Node >= 22.15 for module.registerHooks(). Found ' + process.version);
  process.exit(1);
}

// The scripted client the store will talk to. Each test sets `nextRpc` /
// `nextSelect` to the exact row shape PostgREST would return.
const stub = { nextRpc: null, nextSelect: null, lastRpcArgs: null, lastUpdate: null };

const STUB_SOURCE = `
export const isSupabaseConfigured = true;
export const supabase = globalThis.__SEEDS_STUB_CLIENT__;
`;

// Resolve './supabase' to a virtual module; bridge Metro-style extensionless
// specifiers for everything else, exactly as check-demo-hive.mjs does.
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './supabase' || spec === './supabase.js') {
      return { url: 'seeds-stub:supabase', shortCircuit: true };
    }
    if (spec.startsWith('.') && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'seeds-stub:supabase') {
      return { format: 'module', source: STUB_SOURCE, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

const USER = { id: 'user-sender' };

globalThis.__SEEDS_STUB_CLIENT__ = {
  auth: { getUser: async () => ({ data: { user: USER } }) },
  rpc: async (_fn, args) => {
    stub.lastRpcArgs = args;
    return { data: stub.nextRpc, error: null };
  },
  from() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: async () => ({ data: stub.nextSelect, error: null }),
      update(values) {
        stub.lastUpdate = values;
        return chain;
      },
      delete: () => chain,
      then: undefined,
    };
    return chain;
  },
};

const { SeedsStore, hasBloomed, SEED_CONTENT_MAX } = await import(
  pathToFileURL(path.join(ROOT, 'src/services/SeedsStore.js')).href
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

const FUTURE = new Date(Date.now() + 86400000);
const PAST = new Date(Date.now() - 86400000);
const envelope = (bloomAt) => ({
  id: 'seed-1',
  bloom_at: bloomAt.toISOString(),
  created_at: new Date().toISOString(),
  opened_at: null,
  sender_id: USER.id,
  recipient_id: 'user-recipient',
});

console.log('\n  §22.1 — the five embed shapes normalise to two values');

// PostgREST's answer depends on how it reads a PK-that-is-also-an-FK, and a
// broken/renamed embed drops the key entirely. All five must land on text or
// null, never undefined and never an array leaking through.
const SHAPES = [
  ['to-one object', { content: 'the text' }, 'the text'],
  ['to-many array', [{ content: 'the text' }], 'the text'],
  ['explicit null', null, null],
  ['empty array (RLS filtered)', [], null],
  ['key absent entirely (broken embed)', undefined, null],
];
for (const [label, embed, want] of SHAPES) {
  const row = envelope(PAST);
  if (embed !== undefined) row.seed_contents = embed;
  stub.nextSelect = [row];
  const [seed] = await SeedsStore.listReceived();
  eq(`${label} -> ${JSON.stringify(want)}`, seed.content, want);
  if ('seed_contents' in seed) bad(`${label}: join table dropped from the shape`, 'seed_contents leaked to the view layer');
}

console.log('\n  §22.1 — sealed is bloom_at, NOT content == null');

{
  // The case that disproves the conflation: a seed you SENT, still sealed,
  // returns its text — the select policy names sender_id with no bloom
  // condition (check-seeds-rls.mjs asserts it green).
  stub.nextSelect = [{ ...envelope(FUTURE), seed_contents: { content: 'my own sealed words' } }];
  const [sent] = await SeedsStore.listSent();
  eq('a sealed seed you sent still returns its text', sent.content, 'my own sealed words');
  eq('...and hasBloomed still reports it sealed', hasBloomed(sent), false);
  if (sent.content !== null && !hasBloomed(sent)) ok('content-null and sealed are independent — the conflation is disproven here');
  else bad('content-null and sealed are independent', 'this row no longer demonstrates the split');
}

{
  // The inverse: a bloomed seed whose content is missing. §22.1's tripwire —
  // no legitimate meaning, must read as sealed rather than as an opened seal
  // over nothing.
  stub.nextSelect = [{ ...envelope(PAST), seed_contents: [] }];
  const [broken] = await SeedsStore.listReceived();
  eq('tripwire row: bloomed by date', hasBloomed(broken), true);
  eq('tripwire row: but no content arrived', broken.content, null);
  ok('tripwire is detectable by the view (hasBloomed && content == null)');
}

console.log('\n  §22.3 — plantSeed returns the text the caller typed');

{
  // plant_seed is `returns public.seeds`, which has no seed_contents column,
  // so the RPC can never carry the embed. Shaping the RPC row alone would
  // report null for text typed a millisecond earlier.
  stub.nextRpc = envelope(FUTURE);
  const planted = await SeedsStore.plantSeed('user-recipient', '  a seed I just wrote  ', FUTURE);
  eq('planted seed carries its own text', planted.content, 'a seed I just wrote');
  eq('...trimmed, matching what was sent to the RPC', stub.lastRpcArgs.p_content, 'a seed I just wrote');
  eq('...and is still sealed by date', hasBloomed(planted), false);
  if (!('seed_contents' in planted)) ok('spliced embed does not leak into the shape');
  else bad('spliced embed does not leak', 'seed_contents present on the returned seed');
}

console.log('\n  hasBloomed — the boundary, and what it refuses');

eq('bloom_at in the past -> bloomed', hasBloomed({ bloom_at: PAST.toISOString() }), true);
eq('bloom_at in the future -> sealed', hasBloomed({ bloom_at: FUTURE.toISOString() }), false);
eq('exactly now -> bloomed (<=)', hasBloomed({ bloom_at: new Date(1000).toISOString() }, 1000), true);
eq('one ms before -> sealed', hasBloomed({ bloom_at: new Date(1001).toISOString() }, 1000), false);
eq('no bloom_at -> not bloomed, never throws', hasBloomed({}), false);
eq('null seed -> not bloomed, never throws', hasBloomed(null), false);

console.log('\n  input guards (the compose screen leans on these)');

const rejects = async (label, fn) => {
  try {
    await fn();
    bad(label, 'expected a throw, got none');
  } catch (e) {
    ok(`${label} [${e.message.slice(0, 54)}]`);
  }
};
stub.nextRpc = envelope(FUTURE);
await rejects('empty text is refused', () => SeedsStore.plantSeed('r', '   ', FUTURE));
await rejects('over-length text is refused', () => SeedsStore.plantSeed('r', 'x'.repeat(SEED_CONTENT_MAX + 1), FUTURE));
await rejects('a past bloom date is refused', () => SeedsStore.plantSeed('r', 'hi', PAST));
await rejects('an unparseable date is refused', () => SeedsStore.plantSeed('r', 'hi', 'not a date'));
// `new Date(null)` is the epoch, not NaN, so a missing date used to reach the
// future-date guard and be reported as a past date the caller never picked.
const noDate = await SeedsStore.plantSeed('r', 'hi', null).then(() => null, (e) => e.message);
eq('a missing date is refused AS MISSING, not as a past date', noDate, 'Pick a date for this seed to bloom');
eq(`SEED_CONTENT_MAX is 500, matching the CHECK constraint`, SEED_CONTENT_MAX, 500);

console.log(`\ncheck-seeds-contract: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
