-- Harden search_path on the five SECURITY DEFINER functions that were
-- still on bare `search_path = public`. `plant_seed` (20260813000002)
-- already pins `public, pg_temp`; this brings the other five in line.
--
-- A SECURITY DEFINER function runs as its owner, able to bypass RLS and
-- read auth.users. If an attacker-controlled schema could resolve an
-- unqualified name ahead of `public`, the definer could be tricked into
-- running attacker code. `pg_temp` last (not first) means a session-local
-- temp object can't shadow a `public` one either. Today this is closed by
-- a Supabase default (no CREATE on public for unprivileged roles), so this
-- migration is defense-in-depth, not a fix for a reachable exploit.
--
-- Every function keeps `create or replace` with its existing body,
-- language, and volatility unchanged — same signature, so grants and the
-- anon revokes already in place (20260813000005) are preserved, matching
-- the note in 20260815000001:82-84.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'New user'));
  return new;
end;
$$;

create or replace function public.find_connectable_profile(lookup_email text)
returns table (id uuid, display_name text)
language plpgsql
security definer set search_path = public, pg_temp
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

create or replace function public.owns_entry(p_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.entries e
    where e.id = p_entry_id
      and e.user_id = auth.uid()
      and e.hive_id is null
  );
$$;

create or replace function public.entries_mark_shared()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.entries set visibility = 'shared'
    where id = new.entry_id and visibility = 'private';
  return new;
end;
$$;

notify pgrst, 'reload schema';
