# Connecting this app to a Supabase project

1. **App side (already done on this branch):** `.env.example` lists the two
   values the app needs. Copy it to `.env` and fill in Project URL + anon key
   from the Supabase dashboard → Settings → API. Never put the `service_role`
   key here — it bypasses Row Level Security and must never ship in the app.
2. **Database side:** apply the migrations in `migrations/` to the project.
   Every merge to `main` that adds a file here needs this step run again —
   a migration living in the repo does not mean it's live. Two ways:
   - `SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> npm run deploy:migrations`
     (wraps `supabase link` + `supabase db push`, and before pushing shows both
     `supabase migration list` and a `db push --dry-run` — see the two warnings below).
   - Or paste each file into the dashboard's SQL Editor, in filename order.

   **Before the first run**, confirm the project's migration history actually
   matches what's live. `db push` only skips a migration if the remote's
   `supabase_migrations.schema_migrations` table lists its version — if any
   of this project's tables were ever created by hand through the dashboard
   SQL editor instead of the CLI, that table won't know about them, and
   `db push` will try to re-run `create table` from the oldest local
   migration and fail on `42P07 relation already exists` before it reaches
   the migrations you actually wanted applied. Check first, in the SQL editor:
   ```sql
   select version from supabase_migrations.schema_migrations order by version;
   ```
   If a version that's already live (e.g. an early one like `20260808000001`)
   is missing from that list, tell the CLI it's already applied instead of
   trying to re-run it: `supabase migration repair --status applied <version>`,
   once per missing version, oldest first — then push.

   **Deploy once per merge batch, not between merges.** `db push` applies
   migrations *newer* than the newest version in the remote history table.
   So if two branches merge in an order that isn't their timestamp order —
   or if a deploy runs after the first of them lands and before the second —
   the older file ends up behind an already-applied version and push skips
   it, permanently and silently: `main` says the schema has it, the database
   doesn't. That is why `deploy-migrations.sh` now runs `db push --dry-run`
   before the real push. The dry run prints the exact list push will apply;
   anything shown as local-only by `migration list` but absent from the dry
   run is being skipped. The fix is `supabase db push --include-all` once
   you've checked why, not a second plain push.
3. **Auth:** email + password (Supabase Auth → Providers → Email). Phone-OTP
   was the original plan but needs a paid SMS provider, so connections are
   discovered by exact email match via the `find_connectable_profile` RPC
   (see `migrations/20260809000002_find_profile_by_email.sql`) instead.
4. Restart `expo start` after adding `.env` — Expo only inlines
   `EXPO_PUBLIC_*` vars at bundle time, not on hot reload.
