-- Security audit follow-up: nothing stopped a client from writing an
-- unbounded blob into a text column (entries/comments content, display
-- name). RLS controls *who* can write a row, not *how big* it is. These
-- caps are generous for legitimate use but block abuse/accidental-bloat —
-- picked to comfortably fit the longest realistic input for each field.
--
-- NOT VALID + a separate VALIDATE CONSTRAINT: a plain ADD CONSTRAINT scans
-- and checks every existing row under an ACCESS EXCLUSIVE lock, and aborts
-- the whole migration if one row already exceeds the cap. NOT VALID makes
-- the ADD itself instant (no scan), and VALIDATE CONSTRAINT then does the
-- scan under SHARE UPDATE EXCLUSIVE, which doesn't block concurrent reads
-- or writes. Guarded with pg_constraint checks so a re-run doesn't error
-- on "constraint already exists".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'display_name_length'
  ) then
    alter table public.profiles
      add constraint display_name_length check (char_length(display_name) <= 100) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'entries_content_length'
  ) then
    alter table public.entries
      add constraint entries_content_length check (char_length(content) <= 10000) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'comments_content_length'
  ) then
    alter table public.comments
      add constraint comments_content_length check (char_length(content) <= 2000) not valid;
  end if;
end $$;

alter table public.profiles validate constraint display_name_length;
alter table public.entries validate constraint entries_content_length;
alter table public.comments validate constraint comments_content_length;
