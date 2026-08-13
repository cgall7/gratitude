-- Should-fix from Sage's P0-2 review (thread 19e90cf8, 2026-08-13):
-- EntryStore.js:40-43's own comment says shareEntry depends on there being
-- exactly one row per day, but nothing enforced it. Two ways in: the
-- duplicate-tap bug that was live on prod between the 20260813000004
-- deploy and this PR's shareEntry fix (each tap inserted a fresh row), and
-- saveEntry's own find-then-insert with nothing atomic between the two
-- steps (two rapid taps or two devices race the same way). Once a date
-- holds two hive_id-IS-NULL rows, postgrest-js's .maybeSingle() throws
-- PGRST116 for that date forever, with no repair path in EntryStore.
--
-- Dedupe first, per 20260810000001's own header: a unique index built on
-- dirty data aborts the scan the same way VALIDATE CONSTRAINT does. Keep
-- the row a `shares` insert already points at — deleting the others is the
-- recovery an author would want anyway, since the version their hive
-- already saw is the one that stays. When no duplicate in a group has a
-- share, or more than one does, keep the most recently created row: the
-- most recent save is the one EntryStore's own find-then-update path would
-- have shown the user last. Deleting a losing row cascades to any `shares`/
-- `likes`/`comments` hanging off it (20260808000001's on delete cascade),
-- which is the correct outcome for a row nobody should have been able to
-- create in the first place.
with ranked as (
  select
    e.id,
    row_number() over (
      partition by e.user_id, e.entry_date
      order by
        (exists (select 1 from public.shares s where s.entry_id = e.id))::int desc,
        e.created_at desc
    ) as rn
  from public.entries e
  where e.hive_id is null
)
delete from public.entries
where id in (select id from ranked where rn > 1);

create unique index if not exists entries_one_journal_per_day
  on public.entries (user_id, entry_date)
  where hive_id is null;
