-- Security audit follow-up: nothing stopped a client from writing an
-- unbounded blob into a text column (entries/comments content, display
-- name). RLS controls *who* can write a row, not *how big* it is. These
-- caps are generous for legitimate use but block abuse/accidental-bloat —
-- picked to comfortably fit the longest realistic input for each field.
alter table public.profiles
  add constraint display_name_length check (char_length(display_name) <= 100);

alter table public.entries
  add constraint content_length check (char_length(content) <= 10000);

alter table public.comments
  add constraint content_length check (char_length(content) <= 2000);
