-- 8b.5, the Send half (Sage, thread b57ad406, 2026-08-19 — the read-access
-- ruling block Lumen wrote 2026-08-17, closing the gap Fizz filed and
-- Pixel's §31.6 constraint). Seal (sealed_at, 20260815000003/000004) already
-- ships; flipping entries.visibility to 'sent' today delivers nothing — the
-- only SELECT policies on entries are entries_select_own,
-- entries_select_via_share (20260808000001), and the restrictive
-- entries_select_respect_visibility (20260813000004); private_hives_select_own
-- is owner-only. This migration is the one file the ruling requires: no new
-- addressing surface (subject_profile_id already names the recipient),
-- sent_at, two subject-scoped SELECT policies, the send_hive RPC, the
-- connection check living only in that RPC, the feed/hive coupling's second
-- direction, and the two comments this migration expires.

-- 1. No new addressing surface. private_hives.subject_profile_id
-- (20260815000001) already names the hive's subject, singular by product
-- definition. 'sent' names a state on the entry; the hive it belongs to
-- names the person. shares is not reused as a delivery rail — no addressee
-- column, UNIQUE shares.entry_id, feed-coupled trigger entries_mark_shared.

-- 2. private_hives.sent_at — the send act's timestamp, mirroring
-- private_hives.sealed_at (20260815000003). Needed because the recipient's
-- hive-row grant needs a hive-level fact: a private_hives policy that
-- subqueries entries — whose policies subquery private_hives — is the
-- 42P17 recursion class 20260809000004 fixed, and 20260815000002's own
-- comment warns of exactly this. Not the banned sent_to (Slices doc 8b.5):
-- it stores no address, only a timestamp; the address stays derived from
-- subject_profile_id. Per-entry entries.visibility remains the only record
-- of which entries rode in the package.
--
-- No CHECK enforcing "sent implies has subject" — subject_profile_id's FK
-- is ON DELETE SET NULL, so a row CHECK over it would make the subject's
-- account deletion fail on any already-sent hive. send_hive() (point 4)
-- enforces the precondition at write time instead, where a failed deletion
-- can't result.
alter table public.private_hives
  add column sent_at timestamptz;

comment on column public.private_hives.sent_at is
  'When the hive was sent (delivered in-app to its subject). Null until '
  'send_hive() sets it. One-directional, same guard as sealed_at got '
  '(20260815000004) — see private_hives_sent_at_immutable_trigger.';

-- Same one-directional shape as private_hives_sealed_at_immutable
-- (20260815000004): null -> timestamp is legal and stays legal forever;
-- timestamp -> anything is not. A separate trigger function rather than
-- widening the sealed_at one — one column, one guard, same as the sealed_at
-- precedent set for itself.
create function public.private_hives_sent_at_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.sent_at is not null and new.sent_at is distinct from old.sent_at then
    raise exception 'private_hives: sent_at cannot be changed once set';
  end if;
  return new;
end;
$$;

create trigger private_hives_sent_at_immutable_trigger
  before update on public.private_hives
  for each row execute function public.private_hives_sent_at_immutable();

-- 3. Two new permissive SELECT policies, both subject-scoped and pinned on
-- both subject_profile_id and sent_at — no subquery recursion. private_hives'
-- own policies stay subquery-free (own owner_id only), so
-- entries_select_as_hive_subject's one-directional reference (entries ->
-- private_hives) can't cycle back.
create policy "private_hives_select_as_subject"
  on public.private_hives for select
  using (auth.uid() = subject_profile_id and sent_at is not null);

-- The restrictive entries_select_respect_visibility (20260813000004) passes
-- this because 'sent' <> 'private'; this permissive policy is what actually
-- admits the row.
create policy "entries_select_as_hive_subject"
  on public.entries for select
  using (
    visibility = 'sent'
    and exists (
      select 1 from public.private_hives h
      where h.id = entries.hive_id
        and h.subject_profile_id = auth.uid()
        and h.sent_at is not null
    )
  );

-- 4. The send act is one SECURITY DEFINER RPC. Two client-side writes would
-- let sent_at get set without the entries actually flipping — the recipient
-- opens an empty reveal, the exact failure Slice 1 exists to avoid — so both
-- happen in this one function, one transaction. Validates: caller owns the
-- hive, it's sealed, it has a subject, that subject is an accepted
-- connection, and it hasn't already been sent (checked here, not left to the
-- trigger, so the caller gets a clear "already sent" instead of a generic
-- immutability exception). "Hive not found" covers both a nonexistent id and
-- one the caller doesn't own — same non-owner-can't-distinguish shape as
-- find_connectable_profile's self-exclusion (20260813000005's own finding on
-- why that clause matters).
--
-- Pricing (D1, 2026-08-19 lifetime ruling — supersedes the 2026-08-17
-- "pricing gates send, never seal" framing by moving the meter upstream of
-- both acts): this RPC carries NO paywall check. The paywall gates hive
-- *creation* at the private_hives insert path (Slices doc row 12.5); seal
-- and send stay free and unconditional on every tier. send_hive remains the
-- single choke point for send *integrity* only.
create function public.send_hive(p_hive_id uuid)
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

  -- 5. Connection checked at send time only, never at read time. A
  -- delivered keepsake is a gift — a later unfriend does not revoke it, and
  -- private_hives_select_as_subject / entries_select_as_hive_subject above
  -- read sent_at, never honeycomb_connections.
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
end;
$$;

-- House revoke pattern (20260813000005): a new function is anon-executable
-- at birth by two independent mechanisms (PUBLIC's own default, and
-- Supabase's named default-privilege grant to anon) — both lines are
-- required, revoking either alone leaves the other standing.
revoke all on function public.send_hive(uuid) from public;
revoke execute on function public.send_hive(uuid) from anon;
grant execute on function public.send_hive(uuid) to authenticated;

-- 6. Direction two of the feed/hive coupling closes here. Direction one is
-- already closed on github/main: owns_entry() (20260815000001) requires
-- e.hive_id is null, so no hive entry can acquire a shares row via
-- shares_insert_own's WITH CHECK. Direction two was still open:
-- entries_update_own (live definition 20260815000006) let an author move an
-- already-shared entry — live shares row — into an unsealed hive, after
-- which entries_select_via_share exposes it to every accepted connection
-- and listFeed/listFeedSince (no hive_id filter) render it in the week
-- view. WITH CHECK only, matching the asymmetry 20260815000005/000006
-- established: WITH CHECK constrains the landing row (this is exactly a
-- landing-state question — did the row that resulted from the update
-- acquire a hive_id while still carrying a shares row), so USING (the
-- touched row) is untouched. A plain inline `not exists` against shares,
-- not a SECURITY DEFINER wrapper — private_hives' policies don't reference
-- entries and shares' policies don't reference private_hives, so nothing
-- cycles back; the subquery runs under shares_select_own_or_connections
-- like any other caller and refuses with 42501, not owns_entry()'s 42P17
-- (measured, r118-send-path/probe-r118.mjs, Pixel 2026-08-17, re-run by
-- Lumen the same day).
drop policy "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid() and h.sealed_at is null
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      hive_id is null
      or (
        exists (
          select 1 from public.private_hives h
          where h.id = hive_id and h.owner_id = auth.uid() and h.sealed_at is null
        )
        and not exists (select 1 from public.shares s where s.entry_id = entries.id)
      )
    )
  );

-- 7. Two shipped comments expire on this migration. Past migration files
-- are never edited retroactively, so the correction lands here, as real
-- `comment on column` DB metadata rather than a source-only note — the
-- same move 20260815000002 made for owns_entry(): "The database is where
-- the next reader checking what this function actually guards will look."
comment on column public.private_hives.subject_profile_id is
  'The hive''s subject, when they''re a registered user; null otherwise. '
  'As of this migration (send_hive), this profile CAN gain read access: '
  'once owner-initiated send_hive() sets sent_at, '
  'private_hives_select_as_subject and entries_select_as_hive_subject '
  'admit it. 20260815000001''s original comment on this column — "nothing '
  'here grants that profile any access" — predates this migration and is '
  'no longer true.';

comment on column public.entries.visibility is
  'private | shared | packaged | sent. As of this migration (send_hive), '
  '''sent'' is a real grant, not just a label: entries_select_as_hive_subject '
  'reads visibility = ''sent'' (plus the owning hive''s sent_at) to admit '
  'the hive''s subject. 20260813000004''s original comment on this column — '
  '"visibility is a display/state label, not a new grant" — predates this '
  'migration and is no longer true for the ''sent'' state (private/shared/'
  'packaged remain display-only).';

notify pgrst, 'reload schema';
