-- Project 8b (the private-hive table). Ruled in thread be984506 (Sage,
-- 2026-08-15), delegated as "the spine" of Private Hives. Closes the hook
-- 20260813000004 left open: `entries.hive_id` has existed since that
-- migration as a nullable column with no foreign key, its own comment
-- pointing here.
--
-- subject_name / subject_profile_id: the subject of a private hive (e.g. a
-- child) usually has no account and no row anywhere in this schema —
-- `profiles.id references auth.users(id)`, and nothing else in the repo
-- points at a person who isn't a Pollinate user. subject_name is a plain
-- label, not an identity. subject_profile_id is nullable and only ever
-- set for the case where the subject *is* a registered user (e.g. a
-- private hive about a partner or an older kid with their own account) —
-- it is not required, and nothing here grants that profile any access.
create table public.private_hives (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_name text not null,
  subject_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.private_hives enable row level security;

-- The first OWNED entity in this schema. Every other RLS policy here is
-- mutual — `auth.uid() = requester_id or auth.uid() = addressee_id`,
-- `entries_select_via_share` opening to accepted connections — because
-- every prior table models a relationship between two accounts. A private
-- hive doesn't: subject_profile_id, when set, identifies who the hive is
-- about, not a party to it. It reads and writes nothing here. Full stop,
-- owner only, on every action.
create policy "private_hives_select_own"
  on public.private_hives for select
  using (auth.uid() = owner_id);

create policy "private_hives_insert_own"
  on public.private_hives for insert
  with check (auth.uid() = owner_id);

create policy "private_hives_update_own"
  on public.private_hives for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "private_hives_delete_own"
  on public.private_hives for delete
  using (auth.uid() = owner_id);

-- `restrict`, not `cascade`: no delete flow exists yet for either side, and
-- there's no ruling on what should happen to a hive's entries if the hive
-- itself is deleted (blank them back to the personal journal? delete them
-- too?). Restrict forces that to be a deliberate migration when a delete
-- flow is designed, instead of a silent side effect of this one.
alter table public.entries
  add constraint entries_hive_id_fkey
    foreign key (hive_id) references public.private_hives (id) on delete restrict;

-- Not touched: 20260813000007's `entries_one_journal_per_day` unique index
-- is `where hive_id is null` on purpose — a hive's own entries are a
-- separate per-day space from the personal journal, and from each other
-- hive. Widening that exemption is explicitly out of scope here.

-- Escape hatch closed (Sage, same thread). shares_insert_own's WITH CHECK
-- calls owns_entry(entry_id) — the function 20260809000004 introduced to
-- fix a recursion bug, which is what the policy actually runs today, not
-- the raw exists() from 20260808000001 that preceded it. owns_entry()
-- proves the caller owns the entry; it says nothing about which journal
-- that entry lives in. shareEntry() (HoneycombStore.js:160-176) doesn't
-- filter hive_id — its only protection today is that its one call site
-- (HoneycombTab.js:329) always passes an EntryStore-scoped (hive_id is
-- null) entry. That's provenance-based safety, the same class of gap
-- P0-2 closed elsewhere in this schema, and now that hive_id is a real
-- FK-backed column, it's worth closing structurally instead.
--
-- Widened inside owns_entry(), not with a sibling check beside it: a raw
-- `exists (select ... from entries ...)` inline in shares_insert_own
-- would re-trigger the exact 42P17 recursion 20260809000004 fixed,
-- because entries RLS (entries_select_via_share) subqueries shares —
-- SECURITY DEFINER is what breaks that cycle, so the check has to live
-- inside the function. owns_entry() has exactly one caller
-- (shares_insert_own), so widening its meaning doesn't affect anything
-- else. Same signature, so `create or replace` preserves the anon
-- revoke from 20260813000005 (drop+create would not — see that file's
-- own note on this).
create or replace function public.owns_entry(p_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.entries e
    where e.id = p_entry_id
      and e.user_id = auth.uid()
      and e.hive_id is null
  );
$$;
