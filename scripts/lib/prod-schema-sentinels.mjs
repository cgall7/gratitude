// Sentinels for prod-schema-check.mjs — one entry per migration file in
// supabase/migrations/, in version order.
//
// Lives in lib/ rather than inline in prod-schema-check.mjs because two
// consumers with opposite runtime constraints read it:
//
//   - scripts/prod-schema-check.mjs (manual, network, real credentials)
//     probes each entry against prod.
//   - scripts/check-migration-sentinels.mjs (npm test, pure disk, no
//     network) asserts this table and supabase/migrations/ enumerate each
//     other exactly.
//
// Importing the check script's data from the network script would run the
// network script's top-level env check inside `npm test`; this module has
// no side effects at all.
//
// Probe kinds:
//   column : GET /rest/v1/<table>?select=<column>&limit=1
//   rpc    : POST /rest/v1/rpc/<fn>; expect 'exists' (anything but PGRST202)
//            or an exact PostgREST error code that only the migration produces
//   storage: GET /storage/v1/object/public/<bucket>/<nonsense>; a live public
//            bucket answers "Object not found", a missing one "Bucket not found"
//   order  : no anon-visible surface; status comes from version order
//            (prod-schema-check rule 3)
//
// Sentinel names were read from the migration SQL, not the file names —
// 20260809000002's file says find_profile_by_email; the function it creates
// is find_connectable_profile.
export const SENTINELS = {
  '20260808000001_honeycombs_core_schema': { kind: 'column', table: 'entries', column: 'id' },
  '20260809000001_avatar_storage': { kind: 'storage', bucket: 'avatars' },
  '20260809000002_find_profile_by_email': { kind: 'rpc', fn: 'find_connectable_profile', args: { lookup_email: 'calibration@example.invalid' }, expect: 'exists' },
  '20260809000003_fix_likes_comments_visibility': { kind: 'order', reason: 'policy replace only' },
  '20260809000004_fix_shares_insert_recursion': { kind: 'order', reason: 'policy replace + function revoke' },
  '20260809000005_profiles_select_pending_counterparties': { kind: 'order', reason: 'policy replace only' },
  '20260810000001_content_length_caps': { kind: 'order', reason: 'check constraints; anon cannot insert to trip them' },
  '20260811000001_correct_unused_column_comments': { kind: 'order', reason: 'COMMENT ON only' },
  '20260813000001_notes_schema': { kind: 'column', table: 'notes', column: 'id' },
  '20260813000002_seeds_schema': { kind: 'column', table: 'seeds', column: 'id' },
  '20260813000003_hive_state_facts': { kind: 'rpc', fn: 'list_hive_state', args: {}, expect: 'exists' },
  '20260813000004_entries_hive_visibility': { kind: 'column', table: 'entries', column: 'hive_id' },
  // 42501 is this migration WORKING: it revokes definer-function execute from
  // anon, so the function answering "permission denied" to the anon key is the
  // observable. A 200 here would mean the revoke is NOT applied — but 'exists'
  // for 000003 above would still hold, which is why these are two rows.
  '20260813000005_revoke_definer_execute_from_anon': { kind: 'rpc', fn: 'list_hive_state', args: {}, expect: '42501' },
  '20260813000006_entries_theme_column': { kind: 'column', table: 'entries', column: 'theme' },
  '20260813000007_entries_one_per_day_dedupe': { kind: 'order', reason: 'unique index; anon cannot insert to trip it' },
  '20260815000001_private_hives': { kind: 'column', table: 'private_hives', column: 'owner_id' },
  '20260815000002_private_hives_entries_ownership_guard': { kind: 'order', reason: 'policy replace only' },
  '20260815000003_private_hives_sealed_at': { kind: 'column', table: 'private_hives', column: 'sealed_at' },
  '20260815000004_private_hives_sealed_at_guard': { kind: 'order', reason: 'trigger only' },
  '20260815000005_private_hives_sealed_entries_readonly': { kind: 'order', reason: 'policy replace only' },
  '20260815000006_private_hives_sealed_entries_immutable': { kind: 'order', reason: 'policy replace only' },
  '20260817000001_harden_definer_search_path': { kind: 'order', reason: 'ALTER FUNCTION SET search_path only' },
  '20260817000002_private_hives_cover_and_cadence': { kind: 'column', table: 'private_hives', column: 'cover_theme' },
  '20260819000001_private_hives_send': { kind: 'column', table: 'private_hives', column: 'sent_at' },
  '20260819000002_hive_send_events': { kind: 'column', table: 'hive_send_events', column: 'id' },
};
