-- Pixel's finding on this migration's own predecessor (thread 37fb8ef6,
-- 2026-08-15, replying to 20260815000004's write-once trigger): "your
-- migration guards the flag. The flag is half of it." 20260815000004 stops
-- sealed_at flipping back to null, but entries_insert_own/entries_update_own
-- (20260815000002) admit a hive entry on `h.owner_id = auth.uid()` alone --
-- no reference to seal state. So a sealed hive still accepted new entries
-- and edits to existing ones, and "finished" became a claim the hive's own
-- data contradicted.
--
-- Pixel's ruling: "after the seal, the hive's contents cannot change -- not
-- by insert, not by edit." Same enforcement point as 20260815000002 --
-- the same exists(...) subquery -- plus one clause: `and h.sealed_at is
-- null`. WITH CHECK only (not USING): an owner can still target an entry
-- in a sealed hive with an UPDATE statement (she owns the row), but the
-- resulting row is rejected because it still points at a hive whose
-- sealed_at is set -- the same shape 20260815000002 already used to gate
-- ownership rather than visibility.
--
-- personal-journal entries (hive_id is null) are untouched -- sealing a
-- hive says nothing about entries that were never in it.
drop policy "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
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

drop policy "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
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
