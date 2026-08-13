-- Gratitude Notes (Project 7, no-tip variant): a directed message from one
-- user to another, distinct from `entries`/`shares` (a private journal entry
-- broadcast to the whole honeycomb). A note always has exactly one recipient
-- and is never visible to anyone else.
--
-- tip_amount/tip_status/image_url are intentionally NOT in this migration —
-- 7.3 (Lightning tip) and 7.7 (image attachment) aren't built yet, and this
-- table shouldn't carry columns no code path writes or reads. Add them in a
-- follow-up migration when those slices land.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self_note check (sender_id <> recipient_id),
  constraint notes_content_length check (char_length(content) <= 500)
);

alter table public.notes enable row level security;

-- A note is only ever visible to the two people it's between.
create policy "notes_select_participant"
  on public.notes for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "notes_insert_sender"
  on public.notes for insert
  with check (auth.uid() = sender_id);

-- Only the recipient can mark a note read — the sender has no field to update.
create policy "notes_update_recipient_read"
  on public.notes for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- RLS policies gate which ROWS an update can touch, not which COLUMNS —
-- `notes_update_recipient_read` alone would let a recipient rewrite
-- `content` on a note addressed to them by calling Supabase directly
-- (nothing in this app's UI does that, but RLS has to hold against anyone
-- hitting the table, not just this client). This trigger is the column-level
-- half: any update that changes anything but `read_at` is rejected outright.
create function public.notes_recipient_read_only()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.sender_id <> old.sender_id
    or new.recipient_id <> old.recipient_id
    or new.content <> old.content
    or new.created_at <> old.created_at
  then
    raise exception 'notes: recipients may only set read_at';
  end if;
  return new;
end;
$$;

create trigger notes_recipient_read_only_trigger
  before update on public.notes
  for each row execute function public.notes_recipient_read_only();

create index notes_recipient_created_idx on public.notes (recipient_id, created_at desc);
create index notes_sender_created_idx on public.notes (sender_id, created_at desc);
