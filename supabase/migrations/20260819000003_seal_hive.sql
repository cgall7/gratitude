-- Closes the gap found building the seal/send UI (thread b57ad406,
-- 2026-08-19): send_hive() (20260819000001) only flips entries from
-- 'packaged' to 'sent' — `update entries set visibility = 'sent' where
-- hive_id = p_hive_id and visibility = 'packaged'`. Nothing anywhere ever
-- wrote 'packaged'. sealed_at (20260815000003) has been a plain
-- client-settable column since it shipped — the column's own migration
-- says as much ("this migration only adds the column, it doesn't decide
-- who calls the setter") — so a bare client UPDATE could set sealed_at
-- without ever touching entries.visibility. Net effect if the seal button
-- had shipped against today's schema: send_hive() would succeed, sent_at
-- would get set, and the recipient's reveal would show the hive with zero
-- entries — the exact "empty reveal" failure 20260819000001's own comment
-- says its single-RPC design exists to avoid, one step earlier than it
-- guarded against.
--
-- Same fix shape as send_hive() itself: one SECURITY DEFINER RPC, one
-- transaction, so the flag and the entries it depends on can't split.
-- Hive-scoped entries can only ever be 'private' at seal time — they can
-- never reach 'shared' (owns_entry(), 20260815000001, requires hive_id is
-- null before a shares row can attach) and 'packaged'/'sent' don't exist
-- yet on an unsealed hive — so the only entries this touches are the ones
-- the hive actually owns.
create function public.seal_hive(p_hive_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_sealed_at timestamptz;
begin
  select owner_id, sealed_at
    into v_owner_id, v_sealed_at
  from public.private_hives
  where id = p_hive_id;

  if not found or v_owner_id <> auth.uid() then
    raise exception 'seal_hive: hive not found';
  end if;

  if v_sealed_at is not null then
    raise exception 'seal_hive: hive has already been sealed';
  end if;

  update public.entries
    set visibility = 'packaged'
    where hive_id = p_hive_id and visibility = 'private';

  update public.private_hives
    set sealed_at = now()
    where id = p_hive_id;
end;
$$;

-- House revoke pattern (20260813000005): a new function is anon-executable
-- at birth by two independent mechanisms (PUBLIC's own default, and
-- Supabase's named default-privilege grant to anon) — both lines are
-- required, revoking either alone leaves the other standing.
revoke all on function public.seal_hive(uuid) from public;
revoke execute on function public.seal_hive(uuid) from anon;
grant execute on function public.seal_hive(uuid) to authenticated;

notify pgrst, 'reload schema';
