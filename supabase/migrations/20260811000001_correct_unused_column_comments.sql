-- Correct two schema comments that describe behaviour the client does not have.
--
-- 20260808000001:18 says phone_hash is "set by the client at signup". It never
-- has been — there is exactly one occurrence of `phone_hash` in the whole repo
-- and it is that schema line. That false comment is almost certainly what fed
-- the drafting brief for the privacy policy with "hashed phone number for
-- contact discovery", a data practice that does not exist. A wrong comment in
-- a migration is not a tidiness problem here: it propagates into the one
-- artifact where being wrong is a liability rather than a bug report.
--
-- Same shape for profiles.avatar_url: 20260809000001 documents three value
-- shapes and an upload path, and nothing in src/ writes the column or uploads
-- to the bucket. Avatar.js only renders a URL that is already there.
--
-- Applied migrations cannot be edited, so this states the correction in the
-- catalog, where the next person reading the column will actually see it.
-- Catalog-only: no data is read or written and no table is rewritten. Re-running
-- is safe — COMMENT ON replaces rather than appends.
--
-- Note on the wrapping below: COMMENT ON takes a string *constant*, so `||` is
-- not allowed. The multi-line form relies on the SQL rule that two string
-- constants separated by whitespace containing at least one newline are
-- concatenated into one constant. That is why each fragment ends mid-sentence
-- with a trailing space rather than being joined by an operator.

comment on column public.profiles.phone_hash is
  'UNUSED — no writer anywhere in the client. The 20260808000001 comment saying '
  '"set by the client at signup" is false and always has been. Real discovery is '
  'an exact email match via find_connectable_profile. Wiring this up requires '
  'src/constants/legalCopy.js to change in the same commit: the policy currently '
  'promises we do not ask for phone numbers.';

comment on column public.profiles.avatar_url is
  'READ-ONLY in the client — three read sites, no writer, and nothing uploads to '
  'the avatars bucket. The value shapes described in 20260809000001 are a design '
  'not yet built. Adding an image picker requires src/constants/legalCopy.js to '
  'change in the same commit: the policy currently promises the app never '
  'requests camera roll access.';
