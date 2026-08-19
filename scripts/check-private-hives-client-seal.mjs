// Gate for the client-side half of the seal boundary check-private-hives-seal.mjs
// already proves at the database (20260815000005/000006). Pixel's review
// (thread b57ad406, 2026-08-17 12:33Z) measured `fizz/private-hives-rails`
// directly and found the DB fact unreachable from the client:
//
//   - HiveStore.js named its columns at all three `private_hives` selects
//     and `sealed_at` was at none of them — the fact was UNAVAILABLE, not
//     just unused.
//   - HiveDetail.js rendered the add-entry CTA unconditionally.
//   - ComposeHiveEntry.js reported a permanent RLS refusal (SQLSTATE 42501)
//     in the same copy register as a dropped connection ("Check your
//     connection and try again").
//
//   npm run check:private-hives-client-seal
//
// Nothing on this branch writes sealed_at yet (that's 8b.5), so this gate
// gets no DB and asserts on source text instead — it exists to keep the
// three fixes from rotting apart, not to re-prove the RLS policy itself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  ok ? passed++ : failed++;
};

const store = read('src/services/HiveStore.js');
const selects = [...store.matchAll(/\.from\('private_hives'\)[\s\S]{0,120}?\.select\('([^']*)'\)/g)].map((m) => m[1]);
// Five as of 8b.6 (`listReceivedPackages`/`getReceivedPackage` — the
// recipient's two subject-scoped reads, joining the owner-scoped
// createHive/listHives/getHive this gate originally counted). The count is
// not a ceiling; it exists so a new private_hives select added later has to
// touch this line, which is what keeps it from carrying sealed_at by
// omission the way the original three did.
check('HiveStore.js has exactly five private_hives selects', selects.length === 5);
check(
  'every private_hives select names sealed_at',
  selects.length > 0 && selects.every((cols) => cols.split(',').map((c) => c.trim()).includes('sealed_at'))
);
check(
  'listHives and getHive map sealed_at onto sealedAt for callers',
  (store.match(/sealedAt: h\.sealed_at/) ?? []).length === 1 && (store.match(/sealedAt: data\.sealed_at/) ?? []).length === 1
);

const detail = read('src/screens/HiveDetail.js');
check(
  'HiveDetail.js gates the add-entry CTA on hive.sealedAt',
  /hive\.sealedAt/.test(detail) && /\+ Add Entry/.test(detail)
);

const compose = read('src/screens/ComposeHiveEntry.js');
check(
  "ComposeHiveEntry.js distinguishes SQLSTATE 42501 from a generic failure",
  /42501/.test(compose) && /'sealed'/.test(compose) && /'unknown'/.test(compose)
);
check(
  'the sealed-hive message does not reuse the connection-retry copy',
  /can't accept new entries/.test(compose) && !/sealed[\s\S]{0,80}Check your connection/.test(compose)
);

console.log(`\ncheck-private-hives-client-seal: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
