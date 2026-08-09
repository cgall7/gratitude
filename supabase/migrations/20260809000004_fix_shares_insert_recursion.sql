-- Break the shares ↔ entries RLS recursion on INSERT.
--
-- Bug (caught by Pixel R8 live E2E): shares_insert_own WITH CHECK did
--   exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
-- Evaluating that subquery applies entries RLS, including entries_select_via_share
-- which subqueries shares → Postgres 42P17 "infinite recursion detected in policy
-- for relation 'shares'". Every share insert failed against the live DB.
--
-- Fix: security-definer owns_entry() evaluates as table owner (bypasses entries
-- RLS) with the same ownership rule. No cycle. Also NOTIFY PostgREST to reload
-- schema cache so recently-created RPCs (find_connectable_profile) are visible.

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
  );
$$;

revoke all on function public.owns_entry(uuid) from public;
grant execute on function public.owns_entry(uuid) to authenticated;

drop policy if exists "shares_insert_own" on public.shares;
create policy "shares_insert_own" on public.shares for insert
  with check (
    auth.uid() = user_id
    and public.owns_entry(entry_id)
  );

notify pgrst, 'reload schema';
