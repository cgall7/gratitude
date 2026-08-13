-- Seeds (Project 8): a gratitude note addressed to one friend that stays
-- sealed until a future date. Distinct from `notes` (delivered immediately)
-- and from `entries`/`shares` (a private journal broadcast to the honeycomb).
--
-- The whole primitive rests on one claim: before `bloom_at`, the recipient
-- cannot read the seed's text. RLS gates ROWS, not COLUMNS — so if the text
-- lived on the same row as the countdown the recipient is meant to see, they
-- could select it out of the row directly and read a "time capsule" early.
-- Nothing in this app's UI would do that; RLS has to hold against anyone
-- hitting PostgREST, not just this client.
--
-- Hence the split: `seeds` is the sealed envelope (who, for whom, when it
-- opens) and is readable by both participants from the moment it's planted;
-- `seed_contents` is what's inside, and its select policy names `bloom_at`.
-- The text is unreachable until the date passes, at which point the same
-- query starts returning it with no write, no job, and no client change.
--
-- Deliberately absent: `tip_amount` / `escrow_status` (8.3, out of MVP1 with
-- Strike) and `image_url` (no upload path exists yet). Following the same
-- rule `notes` set — this table carries no column that no code path writes.
-- Both slot onto `seeds` later without touching anything written here.
--
-- Also deliberately absent: a stored `status` column. Whether a seed has
-- bloomed is a pure function of `bloom_at <= now()`, so it is derived, never
-- written. A stored flag would need a scheduler to flip it, and a scheduler
-- that missed a run would leave a due seed reading as sealed — the truth of
-- whether a seed is open must not depend on a cron job being healthy. When
-- 8.7/8.11 push notifications land, a scheduled job announces blooms; it
-- does not decide them, and an outage delays the notification, never the
-- bloom itself.

create table public.seeds (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  bloom_at timestamptz not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint no_self_seed check (sender_id <> recipient_id),
  -- A seed planted to bloom in the past is already open, which is just a
  -- note with extra steps. Comparing two columns (rather than calling now())
  -- keeps this expressible as a CHECK; `seeds_stamp_planting` below pins
  -- created_at to the server clock so a client cannot backdate its way past
  -- this by claiming to have planted the seed last year.
  constraint seeds_bloom_after_planting check (bloom_at > created_at)
);

create table public.seed_contents (
  seed_id uuid primary key references public.seeds (id) on delete cascade,
  content text not null,
  constraint seed_content_length check (char_length(content) <= 500)
);

alter table public.seeds enable row level security;
alter table public.seed_contents enable row level security;

-- The envelope is visible to both participants immediately — that is what
-- makes the teaser ("blooms in 47 days") possible without revealing anything.
create policy "seeds_select_participant"
  on public.seeds for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- The contents are visible to the sender (they wrote them) and to the
-- recipient only once the seed has bloomed. This single `bloom_at <= now()`
-- is the seal.
create policy "seed_contents_select_after_bloom"
  on public.seed_contents for select
  using (
    exists (
      select 1 from public.seeds s
      where s.id = seed_contents.seed_id
        and (
          s.sender_id = auth.uid()
          or (s.recipient_id = auth.uid() and s.bloom_at <= now())
        )
    )
  );

-- No INSERT policy on either table, by design. A seed with no content row is
-- a broken seed, and PostgREST cannot span two tables in one transaction, so
-- direct inserts are closed off entirely and `plant_seed` below is the only
-- door. It is SECURITY DEFINER for that reason and re-checks the caller
-- itself rather than inheriting a policy.

-- No UPDATE policy on `seed_contents`, by design. A time capsule the sender
-- can rewrite while it is sealed is not a time capsule; with no policy, RLS
-- denies every update, and with no DELETE policy the row cannot be replaced
-- via delete-then-insert either (the primary key would also refuse).

-- The recipient marks a seed opened (8.11 notifies the sender on this).
create policy "seeds_update_recipient_open"
  on public.seeds for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- The sender may un-plant a seed, but only while it is still sealed — once
-- it has bloomed it belongs to the recipient. The cascade takes the contents
-- row with it.
create policy "seeds_delete_sender_before_bloom"
  on public.seeds for delete
  using (auth.uid() = sender_id and bloom_at > now());

-- Pin the planting time to the server clock and refuse a seed that arrives
-- pre-opened. Without this, a client could post created_at far enough in the
-- past to satisfy seeds_bloom_after_planting with a bloom_at that has
-- already passed.
create function public.seeds_stamp_planting()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  new.opened_at := null;
  return new;
end;
$$;

create trigger seeds_stamp_planting_trigger
  before insert on public.seeds
  for each row execute function public.seeds_stamp_planting();

-- The column-level half of `seeds_update_recipient_open`: the policy decides
-- which rows a recipient may update, this decides which fields. Same shape as
-- `notes_recipient_read_only`, plus the rule that carries the seal — you
-- cannot open a seed that has not bloomed.
create function public.seeds_recipient_open_only()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.sender_id <> old.sender_id
    or new.recipient_id <> old.recipient_id
    or new.bloom_at <> old.bloom_at
    or new.created_at <> old.created_at
  then
    raise exception 'seeds: recipients may only set opened_at';
  end if;
  if new.opened_at is not null and new.bloom_at > now() then
    raise exception 'seeds: a seed cannot be opened before it blooms';
  end if;
  return new;
end;
$$;

create trigger seeds_recipient_open_only_trigger
  before update on public.seeds
  for each row execute function public.seeds_recipient_open_only();

-- Plant a seed: envelope and contents in one transaction, or neither.
--
-- SECURITY DEFINER because the tables have no INSERT policy (see above), so
-- this is the only path that can write them — which is exactly what
-- guarantees every seed has contents. Being definer, it does the caller
-- checks itself; the table's own constraints still fire underneath it, so
-- no_self_seed and seeds_bloom_after_planting hold here too.
create function public.plant_seed(
  p_recipient_id uuid,
  p_content text,
  p_bloom_at timestamptz
)
returns public.seeds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  planted public.seeds;
begin
  if auth.uid() is null then
    raise exception 'seeds: must be signed in to plant a seed';
  end if;
  if p_content is null or btrim(p_content) = '' then
    raise exception 'seeds: a seed needs something written in it';
  end if;

  insert into public.seeds (sender_id, recipient_id, bloom_at)
  values (auth.uid(), p_recipient_id, p_bloom_at)
  returning * into planted;

  insert into public.seed_contents (seed_id, content)
  values (planted.id, btrim(p_content));

  return planted;
end;
$$;

-- `anon` has to be named explicitly. Supabase's default privileges grant
-- EXECUTE on new public functions to anon, authenticated and service_role
-- *by name*, so `revoke ... from public` does not touch them — it revokes an
-- implicit grant that was never the one letting anon in. Verified by reading
-- proacl after applying this file: without the anon line below, the ACL still
-- reads `anon=X/postgres`. The `auth.uid() is null` check inside the function
-- is the second lock, not the only one.
revoke execute on function public.plant_seed(uuid, text, timestamptz) from public, anon;
grant execute on function public.plant_seed(uuid, text, timestamptz) to authenticated;

-- Recipient's list is ordered by when a seed opens, not when it was planted:
-- the next thing to bloom is the thing the Hive screen leads with.
create index seeds_recipient_bloom_idx on public.seeds (recipient_id, bloom_at);
create index seeds_sender_created_idx on public.seeds (sender_id, created_at desc);
