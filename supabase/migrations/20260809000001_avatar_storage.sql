-- Avatar storage for Honeycomb profiles.
--
-- profiles.avatar_url (existing column) holds one of three shapes, decided at
-- the app layer rather than a new enum column — keeps the schema flat:
--   null              -> render initials
--   'bee:<preset-id>'  -> render a bundled bee illustration, no network fetch
--   https://...        -> an uploaded photo served from this bucket
--
-- Photos live in the public 'avatars' bucket, one object per user at
-- `<user_id>/avatar.<ext>`, so a re-upload overwrites cleanly instead of
-- accumulating orphans. Avatars are low-sensitivity (a profile picture a
-- user chose to share with their honeycomb) so public read keeps the feed
-- simple; write is locked to the owning user via the folder-name convention.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatar_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
