-- Connection discovery. `profiles` RLS only exposes your own row and rows
-- belonging to *accepted* connections (see 20260808000001), so there's no
-- way for a user to find someone they aren't connected to yet in order to
-- send a request. This RPC is the narrow, intentional exception: given an
-- exact email match, it returns just enough (id, display_name) to start a
-- connection request. security definer so it can read auth.users, which
-- clients can never query directly; no listing/enumeration surface beyond
-- an exact match.
create or replace function public.find_connectable_profile(lookup_email text)
returns table (id uuid, display_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select p.id, p.display_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(lookup_email)
      and p.id <> auth.uid();
end;
$$;

revoke all on function public.find_connectable_profile(text) from public;
grant execute on function public.find_connectable_profile(text) to authenticated;
