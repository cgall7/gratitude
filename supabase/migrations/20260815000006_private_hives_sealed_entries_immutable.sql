-- Pixel's finding (thread 37fb8ef6, replying to 20260815000005, running
-- check-private-hives-seal at a250309 with two probes appended): WITH
-- CHECK constrains the row you land, USING constrains the row you touch.
-- 20260815000005 only added the seal check to WITH CHECK, so two removal
-- paths survived RLS as the owner -- reparenting an entry OUT of a sealed
-- hive (`update entries set hive_id = null ...`, which lands in the
-- always-legal `hive_id is null` branch and so passes WITH CHECK clean)
-- and deleting it outright (entries_delete_own never mentioned seal state
-- at all). Pixel measured both against the sealed hive and it ended the
-- run with zero entries.
--
-- "Contents cannot change" has three verbs: add, revise, remove. Add is
-- entries_insert_own (000005). Revise is entries_update_own's WITH CHECK
-- (000005) -- an edit that keeps the row in the same sealed hive lands
-- there and correctly fails. Remove is the gap this migration closes:
-- reparenting out is an UPDATE whose LANDING row is legal on its own, so
-- only the TOUCHED row -- the pre-update row USING evaluates against --
-- can reject it. Same clause, added to USING on both entries_update_own
-- and entries_delete_own.
--
-- Pixel's ruling that ships alongside this: "you may destroy a keepsake,
-- you may not revise one." Per-entry removal from a sealed hive closes
-- here. Deleting the WHOLE hive (a delete on private_hives itself, already
-- impossible today regardless -- entries_hive_id_fkey is ON DELETE
-- RESTRICT per 20260815000002) stays a deliberate, separate, not-yet-built
-- decision; this migration only touches entries, not private_hives.
drop policy "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid() and h.sealed_at is null
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid() and h.sealed_at is null
      )
    )
  );

drop policy "entries_delete_own" on public.entries;
create policy "entries_delete_own"
  on public.entries for delete
  using (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid() and h.sealed_at is null
      )
    )
  );
