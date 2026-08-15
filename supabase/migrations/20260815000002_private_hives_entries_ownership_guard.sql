-- Follow-up to 20260815000001 (Project 8b). Sage's review of that migration
-- (thread be984506, same day): entries_insert_own / entries_update_own only
-- ever checked `auth.uid() = user_id`. The new entries.hive_id FK requires
-- the referenced hive to EXIST; nothing required the writer to OWN it. Any
-- authenticated user who learns another user's private_hives.id (a UUID,
-- not guessable today, but exactly what "send" will hand a recipient) could
-- insert or move an entry into someone else's hive. The owner can't see it
-- (entries_select_own hides it) and, worse, can't delete her own hive
-- afterward — entries_hive_id_fkey is ON DELETE RESTRICT, so the stranger's
-- row pins it. Same class of gap as the shares/owns_entry hatch closed in
-- 0001: a column that authorizes something, with no check that the writer
-- owns the referent. Verified with embedded-postgres before and after this
-- migration — see .scratch/sage-8b-review/rig.js.
--
-- Not exploitable via any shipped API path today (private_hives_select_own
-- is owner-only), but it becomes exploitable the moment "send" hands a
-- recipient a hive_id. Closing it now, before that ships, is one clause;
-- closing it after means a security migration plus re-verifying everything
-- built on top in the meantime.
drop policy "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
  with check (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid()
      )
    )
  );

drop policy "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      hive_id is null
      or exists (
        select 1 from public.private_hives h
        where h.id = hive_id and h.owner_id = auth.uid()
      )
    )
  );

-- A plain subquery, not owns_entry()-style SECURITY DEFINER: private_hives'
-- own policies don't reference entries, so there's no 42P17 cycle to break
-- here (unlike the shares -> entries -> shares recursion 20260809000004
-- fixed). If a future migration ever adds a private_hives policy that reads
-- entries, this clause becomes that recursion and needs the same fix.

-- entries.hive_id has no index. Postgres never indexes the referencing side
-- of a FK on its own. Two costs without one: every hive read (Bumble's
-- PrivateHiveStore, entirely `where hive_id = $1`) is a sequential scan, and
-- `on delete restrict` above has to scan entries unindexed on every hive
-- delete. Partial on `is not null` — private_hives has no rows anywhere yet,
-- so this is instant.
create index entries_hive_id_idx
  on public.entries (hive_id, entry_date desc)
  where hive_id is not null;

-- subject_name is the same shape of column 20260810000001 capped on every
-- other client-written text field (that migration's own words: "RLS
-- controls who can write a row, not how big it is") and the only one added
-- since that audit left uncapped. private_hives has no rows on prod yet
-- (unlike the tables 20260810000001 capped), so a plain CHECK is enough —
-- no NOT VALID/VALIDATE scan-and-lock dance needed for a table nobody has
-- written to.
alter table public.private_hives
  add constraint private_hives_subject_name_length check (char_length(subject_name) <= 100);

-- owns_entry() as of 0001 means "owns the entry AND it's a journal entry
-- (hive_id is null)" — a rename would be correct but create-or-replace
-- (required to keep the 20260813000005 anon revoke, same-signature only)
-- can't rename. The database is where the next reader checking what this
-- function actually guards will look.
comment on function public.owns_entry(uuid) is
  'True iff auth.uid() owns entry p_entry_id AND it is a personal-journal '
  'entry (hive_id is null) — not true for hive entries, even the owner''s '
  'own. Fails closed: an unrecognized or hive-scoped entry returns false. '
  'SECURITY DEFINER to break the shares<->entries RLS recursion '
  '(20260809000004); only caller is shares_insert_own.';
