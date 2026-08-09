-- STEP 6 (Pixel finding 2, Sage approved): pending requesters were invisible
-- under profiles RLS, so incoming request cards read "Someone" instead of a
-- name. A pending requester already proved they know your email by sending
-- the request — their display name is low-sensitivity to reveal here.
-- Blocked connections stay excluded; only pending + accepted counterparties.
drop policy if exists "profiles_select_connections" on public.profiles;
create policy "profiles_select_connections" on public.profiles for select
  using (
    exists (
      select 1 from public.honeycomb_connections c
      where c.status in ('pending', 'accepted')
        and (
          (c.requester_id = auth.uid() and c.addressee_id = profiles.id)
          or (c.addressee_id = auth.uid() and c.requester_id = profiles.id)
        )
    )
  );
