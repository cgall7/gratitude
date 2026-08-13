-- P0-2 (thread 19e90cf8, Sage/Pixel/Colin, 2026-08-13). The Ruling: the
-- journal and every private hive must be readable as one date-ordered set,
-- target on each row — not a union of separate tables, since every reader
-- (Today, streak, Recap comb, Wrapped, Garden history) would have to union
-- forever and would drift. So this adds columns to the existing `entries`
-- table rather than creating a new one.
--
-- hive_id: nullable, no foreign key yet. Project 8b (the private-hive
-- table itself) hasn't started — same state list_hive_state() already
-- flagged for pending_seed_count. A follow-up migration adds the FK once
-- that table lands. null means "the personal journal", matching today's
-- only case.
--
-- visibility: private | shared | packaged | sent. For entries created
-- through today's flow, this mirrors what a `shares` row already means —
-- RLS (entries_select_via_share) is untouched by this migration and stays
-- the actual access-control surface. visibility is a display/state label,
-- not a new grant. packaged/sent are unused until 8b's package/send flows
-- exist; only private/shared are reachable today.
alter table public.entries
  add column hive_id uuid,
  add column visibility text not null default 'private';

alter table public.entries
  add constraint entries_visibility_check
    check (visibility in ('private', 'shared', 'packaged', 'sent'));

-- Backfill: any entry with an existing share is 'shared', matching the
-- only state reachable through today's shareEntry flow. Everything else
-- stays the column default.
update public.entries e
set visibility = 'shared'
where exists (select 1 from public.shares s where s.entry_id = e.id);

-- Sage's rig (thread 19e90cf8, 2026-08-13) caught this: the backfill above
-- is a one-time photograph. `visibility` had no other writer anywhere in
-- the repo (`git grep visibility -- src/ App.js` returns comments only),
-- so the first share made *after* this migration deploys stays
-- visibility='private' forever — shareEntry's insert takes the column
-- default, and entries_select_respect_visibility below then hides it from
-- the hive it was just published to. A column that gates reads needs its
-- writer in the same migration that creates it; this is that writer, and
-- it doubles as a repair for any row the backfill missed if shares land
-- between backfill and trigger creation in the same transaction.
create function public.entries_mark_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.entries set visibility = 'shared'
    where id = new.entry_id and visibility = 'private';
  return new;
end;
$$;

create trigger shares_mark_entry_shared
  after insert on public.shares
  for each row execute function public.entries_mark_shared();

-- has_shared_date RPC — replaces HoneycombStore.js's client-side
-- `.eq('entry_date', date).limit(1)` with no `.order()`, flagged by Sage
-- (thread 19e90cf8, 2026-08-13): once an entry_date can hold more than one
-- row (true since 20260808000001; guaranteed to happen once hive entries
-- share a day with a journal entry), that query returns an arbitrary row
-- instead of the shared one, and "did I share today?" becomes a coin
-- flip. This checks existence directly instead of reading an arbitrary
-- row's shares embed.
create or replace function public.has_shared_date(p_date date)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.entries e
    join public.shares s on s.entry_id = e.id
    where e.user_id = auth.uid()
      and e.entry_date = p_date
  );
$$;

-- Same revoke pattern as list_hive_state (20260813000003): PUBLIC alone
-- doesn't reach anon, which holds its own default-privilege grant.
revoke all on function public.has_shared_date(date) from public;
revoke execute on function public.has_shared_date(date) from anon;
grant execute on function public.has_shared_date(date) to authenticated;

-- Bumble's rig (thread 19e90cf8, 2026-08-13, T3) caught this before it
-- shipped: Postgres ORs permissive policies together, so a naive
-- `visibility`-checking SELECT policy could only ever widen access, never
-- restrict it — `entries_select_via_share` already grants read to every
-- accepted connection once a `shares` row exists, regardless of
-- `visibility`. `as restrictive` is required: it ANDs against every
-- permissive policy instead of ORing, so a row marked 'private' is closed
-- to everyone but its author even if a `shares` row also exists for it
-- (the exact state `shareEntry`'s duplicate-insert produces today, and
-- the state 8b's addressed hive delivery will produce going forward).
-- Verified against both directions in Bumble's rig: the leak closes, and
-- the author still reads her own private row.
create policy "entries_select_respect_visibility" on public.entries
  as restrictive for select
  using (auth.uid() = user_id or visibility <> 'private');
