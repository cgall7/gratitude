-- Sage's SHOULD-FIX (thread 37fb8ef6, 2026-08-15): `private_hives_update_own`
-- is a full-row UPDATE policy, so it gates which ROW an owner can touch, not
-- which COLUMN -- the same gap `notes_recipient_read_only_trigger`
-- (20260813000001) closed for `notes`. Without this, a client can write
-- `sealed_at` back to null directly. Under Pixel's admission test
-- (finished/kept/singular), "finished" that can be undone isn't finished --
-- this is the column-level half RLS alone can't express.
--
-- One-directional only: null -> timestamp is the seal and stays legal;
-- timestamp -> anything (another timestamp, or back to null) is not. No
-- unseal flow exists yet, and this migration doesn't invent one -- if a
-- deliberate unseal ships later, it's a new migration that relaxes this,
-- not a silent gap left open today.
create function public.private_hives_sealed_at_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.sealed_at is not null and new.sealed_at is distinct from old.sealed_at then
    raise exception 'private_hives: sealed_at cannot be changed once set';
  end if;
  return new;
end;
$$;

create trigger private_hives_sealed_at_immutable_trigger
  before update on public.private_hives
  for each row execute function public.private_hives_sealed_at_immutable();
