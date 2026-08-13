-- Project 6.7 (hive state endpoint). Ruled in thread e10d0fed (2026-08-13,
-- Sage): return facts, not derived states. `active`/`blooming` are recency
-- judgments relative to a clock, and there are three different clocks in
-- play here — the author's local time (how entries.entry_date gets
-- written), the viewer's local time (how the client decides what's
-- "today"), and the server's UTC clock. profiles carries no timezone
-- column, so a state computed server-side (e.g. entry_date = current_date)
-- would be a fourth, wrong answer that disagrees with the comb the viewer
-- is already looking at for part of every day, for every non-UTC user, and
-- there is no way to fix that here. So this returns the same raw facts the
-- client already derives "today" from — HoneycombTab.js's partitionHive
-- does this exact entry_date comparison client-side — and nothing else.
--
-- last_entry_date: the entry_date of the member's most recently *shared*
-- entry. A private, unshared entry is invisible to us regardless (RLS:
-- entries_select_via_share), so this can only ever reflect what the
-- viewer's own comb already shows. Stays a plain date — never cast to a
-- server-side "is it today" boolean. dateRanges.js already carries the
-- warning that a bare ISO date string parses as UTC and can land a day off
-- for a viewer west of Greenwich; that failure is one order of magnitude
-- cheaper to trigger at day granularity than at timestamp granularity.
--
-- last_note_received_at: the most recent note the CALLER received FROM
-- that member — not the member's own inbox, which nothing gives us the
-- right to see (notes_select_participant only exposes notes we're a party
-- to). A timestamptz, so it's an absolute instant with no clock ambiguity.
-- Read source is `notes` (Project 7): correct against this schema today,
-- but returns no rows on the live project until Project 1's pending
-- migrations actually reach prod.
--
-- pending_seed_count is deliberately NOT a column here. Project 8's schema
-- is still local, unposted WIP as of this migration — this function gets a
-- follow-up migration adding that column once it lands for review.
create or replace function public.list_hive_state()
returns table (
  member_id uuid,
  display_name text,
  avatar_url text,
  last_entry_date date,
  last_note_received_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as member_id,
    p.display_name,
    p.avatar_url,
    (
      select max(e.entry_date)
      from public.entries e
      join public.shares s on s.entry_id = e.id
      where e.user_id = p.id
    ) as last_entry_date,
    (
      select max(n.created_at)
      from public.notes n
      where n.sender_id = p.id
        and n.recipient_id = auth.uid()
    ) as last_note_received_at
  from public.profiles p
  where exists (
    select 1 from public.honeycomb_connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = auth.uid() and c.addressee_id = p.id)
        or (c.addressee_id = auth.uid() and c.requester_id = p.id)
      )
  );
$$;

-- `revoke ... from public` alone does not lock anon out: Supabase's default
-- privileges grant EXECUTE to `anon` by name, not through PUBLIC, so that
-- revoke removes a grant nothing was relying on and leaves anon's own grant
-- standing (Bumble's finding on plant_seed, thread e10d0fed, 2026-08-13 —
-- checked here per her ask). Revoke anon by name, explicitly.
revoke all on function public.list_hive_state() from public;
revoke execute on function public.list_hive_state() from anon;
grant execute on function public.list_hive_state() to authenticated;
