-- 8b.7 (Sage, thread b57ad406, 2026-08-19 — filed as a gap in her original
-- 8b.5/8b.6 dispatch): "Colin sent gratitude to [Name]" in the honeycomb
-- feed, contents never revealed. Not a one-line add to send_hive() —
-- HoneycombStore.listFeed() reads exclusively from `shares`, and
-- 20260819000001's mirror guard deliberately walls private-hive entries off
-- from ever getting a `shares` row (that's direction two of the feed/hive
-- coupling closing). Reusing `shares` here would reopen exactly the leak
-- that guard exists to close: a `shares` row is what makes an entry
-- reachable through `entries_select_via_share`. So this is its own table,
-- content-free by construction — it has no entry_id/hive_id column, so
-- there is no join path from a row here to what was actually written.

create table public.hive_send_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.hive_send_events enable row level security;

-- Visibility is neither `shares`' shape (own-or-connections-of-author) nor
-- `notes`' shape (participants only) — it's both. The two participants
-- always see their own event (an unfriend afterward must not un-deliver the
-- announcement, same "a delivered keepsake is a gift" ruling
-- 20260819000001 already applied to the hive/entries read grant), and the
-- sender's wider connections see it too, same as any other feed card,
-- subject to their live connection status like everything else in the feed.
create policy "hive_send_events_select_party_or_connections"
  on public.hive_send_events for select
  using (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
    or exists (
      select 1 from public.honeycomb_connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = hive_send_events.sender_id)
          or (c.addressee_id = auth.uid() and c.requester_id = hive_send_events.sender_id)
        )
    )
  );

-- No insert/update/delete policy at all — this table has exactly one writer,
-- send_hive() below, running SECURITY DEFINER as the table owner, which is
-- exempt from RLS the same way its existing writes to `entries` and
-- `private_hives` already are (neither table grants INSERT to the caller
-- either; the owner-bypass is what makes SECURITY DEFINER the choke point,
-- not a coincidence of the owner policies also matching). Nobody — not even
-- the two participants — can write this table directly.

create index hive_send_events_sender_created_idx on public.hive_send_events (sender_id, created_at desc);
create index hive_send_events_recipient_created_idx on public.hive_send_events (recipient_id, created_at desc);

-- send_hive() (20260819000001) is redefined, not touched in place — past
-- migration files don't get edited retroactively, same rule that made
-- point 7 of that migration a `comment on column` here instead. Only
-- change from the shipped body: one insert into hive_send_events, in the
-- same transaction as the entries/private_hives writes, so a sent hive and
-- its feed announcement can never come apart.
create or replace function public.send_hive(p_hive_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_subject_id uuid;
  v_sealed_at timestamptz;
  v_sent_at timestamptz;
begin
  select owner_id, subject_profile_id, sealed_at, sent_at
    into v_owner_id, v_subject_id, v_sealed_at, v_sent_at
  from public.private_hives
  where id = p_hive_id;

  if not found or v_owner_id <> auth.uid() then
    raise exception 'send_hive: hive not found';
  end if;

  if v_sealed_at is null then
    raise exception 'send_hive: hive must be sealed before it can be sent';
  end if;

  if v_sent_at is not null then
    raise exception 'send_hive: hive has already been sent';
  end if;

  if v_subject_id is null then
    raise exception 'send_hive: hive has no subject to send to';
  end if;

  if not exists (
    select 1 from public.honeycomb_connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = v_owner_id and c.addressee_id = v_subject_id)
        or (c.addressee_id = v_owner_id and c.requester_id = v_subject_id)
      )
  ) then
    raise exception 'send_hive: owner and subject are not a connected friend';
  end if;

  update public.entries
    set visibility = 'sent'
    where hive_id = p_hive_id and visibility = 'packaged';

  update public.private_hives
    set sent_at = now()
    where id = p_hive_id;

  insert into public.hive_send_events (sender_id, recipient_id)
    values (v_owner_id, v_subject_id);
end;
$$;

notify pgrst, 'reload schema';
