// Gate for the defect Sage found by reading, not running (thread ba3783a7,
// 2026-08-13): `gratitude_entries_v1` has never been scoped to a user, and
// migrateLegacyJournal() turned that into a PERMANENT SERVER WRITE — sign
// out, sign in as someone else on the same device (the demo, not an edge
// case), and the second identity's session uploads the first identity's
// private entries under its own user_id. Nothing clears the key on
// sign-out (verified: zero AsyncStorage.clear/removeItem calls in the app).
//
//   npm run check:legacy-journal-identity
//
// WHY THIS RUNS THE REAL FUNCTION AGAINST FAKES INSTEAD OF READING IT.
//
// check-legacy-journal.mjs already gates the pure decision logic
// (legacyEntriesToMigrate, legacyDateKeyToDate) directly. What it can't
// catch is exactly what went wrong here: the pure logic was correct in
// isolation, and the defect was in the STATEFUL wiring around it — which
// identity gets to claim a device-global key, and when. That needs the
// actual function executed across two simulated sessions sharing one
// AsyncStorage backing store, the same shape as the real bug. Sage's own
// rule from earlier today applies here as much as it did to the gate
// itself: a mechanism traced by reading is not evidence, a discriminating
// test is (thread ba3783a7, "Mechanism is not evidence").
//
// Fakes are injected via migrateLegacyJournal's second argument
// (`{ storage, entryStore }`), which defaults to the real modules in
// production — AuthContext's call sites are unchanged. Importing the real
// legacyJournalMigration.js still pulls in EntryStore.js's `./supabase`,
// which pulls in `react-native-url-polyfill` — an RN/Expo module that will
// not load in plain Node. Same seam check-plant-seed.mjs/check-seeds-contract.mjs
// already use: stub `./supabase` at resolve time, untouched and unaware from
// the modules under test's point of view. The real DefaultEntryStore built
// from that stub is never called here — every test below injects the fake
// entryStore instead — so the stub only has to be import-safe, not correct.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof registerHooks !== 'function') {
  console.error('Needs Node >= 22.15 for module.registerHooks(). Found ' + process.version);
  process.exit(1);
}

const STUB_SOURCE = `
export const isSupabaseConfigured = false;
export const supabase = null;
`;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './supabase' || spec === './supabase.js') {
      return { url: 'legacy-journal-stub:supabase', shortCircuit: true };
    }
    if (spec.startsWith('.') && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'legacy-journal-stub:supabase') {
      return { format: 'module', source: STUB_SOURCE, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

const { migrateLegacyJournal } = await import(
  pathToFileURL(path.join(ROOT, 'src/services/legacyJournalMigration.js')).href
);
const { toISODate } = await import(pathToFileURL(path.join(ROOT, 'src/utils/dateRanges.js')).href);

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
const eq = (label, got, want) =>
  got === want ? ok(label) : bad(label, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// One AsyncStorage-shaped backing store, shared across every "session" in a
// test the same way a real device's AsyncStorage is shared across every
// account that ever signs in on it.
const makeFakeStorage = () => {
  const store = new Map();
  return {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
  };
};

// EntryStore-shaped fake, scoped by an explicit `asUser` rather than a
// session — `getAllEntries`/`saveEntry` only ever see the rows belonging to
// whichever user id is "current" at call time, same as the real store's
// requireUserId does via Supabase auth.
const makeFakeEntryStore = () => {
  const rows = []; // { userId, date, text, theme }
  let currentUser = null;
  let saveCallCount = 0;
  return {
    asUser(userId) {
      currentUser = userId;
    },
    currentUserIs(userId) {
      return currentUser === userId;
    },
    async getAllEntries() {
      return rows
        .filter((r) => r.userId === currentUser)
        .map((r) => ({ date: r.date, text: r.text, theme: r.theme }));
    },
    async saveEntry(date, text, theme) {
      saveCallCount += 1;
      const key = toISODate(date);
      const existing = rows.find((r) => r.userId === currentUser && r.date === key);
      if (existing) {
        existing.text = text;
        existing.theme = theme;
        return;
      }
      rows.push({ userId: currentUser, date: key, text, theme });
    },
    rowsFor(userId) {
      return rows.filter((r) => r.userId === userId);
    },
    get saveCallCount() {
      return saveCallCount;
    },
  };
};

// ---------------------------------------------------------------------------
console.log(
  '\n  §0 — a DIFFERENT user is locked out even while the first attempt is still failing ' +
    '(claim happens before any write, not after success)',
);

{
  // The case §1 below cannot exercise on its own: if A's attempt fully
  // succeeds, MIGRATED_KEY gets set too, and a naive test could pass for the
  // wrong reason — B blocked by "already fully migrated" rather than by
  // "claimed by someone else." Forcing every write to fail keeps
  // MIGRATED_KEY unset, so the ONLY thing that can be blocking B here is the
  // claim.
  const storage = makeFakeStorage();
  const entryStore = makeFakeEntryStore();
  await storage.setItem(
    'gratitude_entries_v1',
    JSON.stringify({ '2026-04-01': { text: "A's entry, upload always fails", theme: null } }),
  );
  entryStore.asUser('user-A');
  // Fails ONLY for A. If B's later call is a real discriminating test of the
  // claim guard rather than of this stub, B's write must be able to succeed
  // — the guard is what has to stop it, nothing else can.
  const realSave = entryStore.saveEntry.bind(entryStore);
  entryStore.saveEntry = async (...args) => {
    if (entryStore.currentUserIs('user-A')) throw new Error('simulated total failure — A never succeeds');
    return realSave(...args);
  };

  const resultA = await migrateLegacyJournal('user-A', { storage, entryStore });
  eq('A: nothing migrated (every write failed)', resultA.migrated, 0);
  eq(
    'MIGRATED_KEY is still unset — this scenario proves nothing via "already done"',
    await storage.getItem('gratitude_entries_v1_migrated'),
    null,
  );
  eq('but the claim was already taken by A', await storage.getItem('gratitude_entries_v1_claimed_by'), 'user-A');

  entryStore.asUser('user-B');
  const resultB = await migrateLegacyJournal('user-B', { storage, entryStore });
  eq("B: nothing migrated — locked out by A's claim, not by completion", resultB.migrated, 0);
  eq("B's account gets none of A's rows", entryStore.rowsFor('user-B').length, 0);
}

// ---------------------------------------------------------------------------
console.log("\n  §1 — Sage's exact scenario: sign out, sign in as someone else, same device");

{
  const storage = makeFakeStorage();
  const entryStore = makeFakeEntryStore();
  await storage.setItem(
    'gratitude_entries_v1',
    JSON.stringify({ '2026-01-05': { text: "A's private entry", theme: 'gratitude' } }),
  );

  // Person A signs in first and the recovery runs under their identity.
  entryStore.asUser('user-A');
  const resultA = await migrateLegacyJournal('user-A', { storage, entryStore });
  eq('A: one entry migrated', resultA.migrated, 1);
  eq('A now owns exactly one row', entryStore.rowsFor('user-A').length, 1);

  // A signs out (no local storage is ever cleared — verified against the
  // real app). Person B signs in on the SAME device.
  entryStore.asUser('user-B');
  const resultB = await migrateLegacyJournal('user-B', { storage, entryStore });
  eq('B: nothing migrated — the claim already belongs to A', resultB.migrated, 0);
  eq(
    "B's account gets none of A's rows — this is the exact defect Sage found",
    entryStore.rowsFor('user-B').length,
    0,
  );
  eq('A still owns exactly one row, untouched by B', entryStore.rowsFor('user-A').length, 1);
}

// ---------------------------------------------------------------------------
console.log('\n  §2 — the claiming identity can still retry after a failure');

{
  const storage = makeFakeStorage();
  const entryStore = makeFakeEntryStore();
  await storage.setItem(
    'gratitude_entries_v1',
    JSON.stringify({ '2026-02-01': { text: 'entry one', theme: null } }),
  );
  entryStore.asUser('user-A');

  // Break saveEntry for the first attempt only, simulating an offline write.
  const realSave = entryStore.saveEntry.bind(entryStore);
  let failNext = true;
  entryStore.saveEntry = async (...args) => {
    if (failNext) {
      failNext = false;
      throw new Error('simulated offline write');
    }
    return realSave(...args);
  };

  const first = await migrateLegacyJournal('user-A', { storage, entryStore });
  eq('first attempt: nothing migrated (write failed)', first.migrated, 0);
  eq('first attempt: not treated as fully migrated', first.skipped, 0);

  const second = await migrateLegacyJournal('user-A', { storage, entryStore });
  eq('retry by the SAME identity succeeds', second.migrated, 1);
  eq('the entry landed under A after the retry', entryStore.rowsFor('user-A').length, 1);
}

// ---------------------------------------------------------------------------
console.log('\n  §3 — a corrupt legacy blob does not spend the one recovery attempt');

{
  const storage = makeFakeStorage();
  const entryStore = makeFakeEntryStore();
  await storage.setItem('gratitude_entries_v1', '{not valid json');
  entryStore.asUser('user-A');

  await migrateLegacyJournal('user-A', { storage, entryStore });
  eq(
    'the migrated marker is NOT set on a parse failure',
    await storage.getItem('gratitude_entries_v1_migrated'),
    null,
  );
  eq('the raw legacy blob is untouched, still there to retry', await storage.getItem('gratitude_entries_v1'), '{not valid json');
}

// ---------------------------------------------------------------------------
console.log('\n  §4 — concurrent calls for the same identity do not double-run');

{
  const storage = makeFakeStorage();
  const entryStore = makeFakeEntryStore();
  await storage.setItem(
    'gratitude_entries_v1',
    JSON.stringify({ '2026-03-01': { text: 'entry', theme: null } }),
  );
  entryStore.asUser('user-A');

  // Mirrors GoTrueClient firing INITIAL_SESSION to both getSession().then()
  // and onAuthStateChange within the same tick — two calls kicked off before
  // either has resolved.
  const [r1, r2] = await Promise.all([
    migrateLegacyJournal('user-A', { storage, entryStore }),
    migrateLegacyJournal('user-A', { storage, entryStore }),
  ]);
  eq('both callers observe the one run that actually happened', r1.migrated, 1);
  eq('both callers share the exact same result object (memoised, not just equal)', r1 === r2, true);
  eq('saveEntry was only ever called once', entryStore.saveCallCount, 1);
}

console.log(`\ncheck-legacy-journal-identity: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
