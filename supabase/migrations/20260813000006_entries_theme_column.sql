-- P0-2's client half (thread 19e90cf8): EntryStore.js is moving from
-- AsyncStorage to this table. The AsyncStorage record always carried a
-- `theme` field (client-computed via themeTagger.js, shown on TodayTab,
-- HoneycombTab's share carry, MonthlyRecap's reveal, and PollinateWrapped's
-- insight cards) but no migration ever added a column for it — the local
-- store just held it as a plain object field. Nullable, no check constraint:
-- themeTagger.js's THEMES list is free to grow without a migration, same
-- looseness the AsyncStorage version had.
alter table public.entries add column theme text;
