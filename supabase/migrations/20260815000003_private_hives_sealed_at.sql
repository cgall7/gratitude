-- WP-1/WP-2's gold register (Pixel, thread 37fb8ef6): a hive card is gold
-- only if it's finished, kept, and singular. "Finished" is an act on the
-- hive, not a derived count of its entries -- Sage's decoupling ruling
-- (packaging produces an author-owned keepsake) means sealing has to be a
-- fact the hive itself carries, not a query over entries.visibility.
--
-- null = in progress (the cream card). Set once, on seal; this migration
-- only adds the column, it doesn't decide who calls the setter.
alter table public.private_hives
  add column sealed_at timestamptz;

comment on column public.private_hives.sealed_at is
  'When the hive was sealed (packaged as a finished keepsake). Null while '
  'still being authored. Drives WP-2''s gold-vs-cream register in the '
  'Today shelf -- see thread 37fb8ef6, Pixel''s admission test (finished, '
  'kept, singular).';
