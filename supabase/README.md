# Connecting this app to a Supabase project

1. **App side (already done on this branch):** `.env.example` lists the two
   values the app needs. Copy it to `.env` and fill in Project URL + anon key
   from the Supabase dashboard → Settings → API. Never put the `service_role`
   key here — it bypasses Row Level Security and must never ship in the app.
2. **Database side:** apply the migrations in `migrations/` to the project.
   Every merge to `main` that adds a file here needs this step run again —
   a migration living in the repo does not mean it's live. Two ways:
   - `SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> npm run deploy:migrations`
     (wraps `supabase link` + `supabase db push`; safe to re-run, already-applied
     migrations are skipped via the CLI's own history table on the project).
   - Or paste each file into the dashboard's SQL Editor, in filename order.
3. **Auth:** email + password (Supabase Auth → Providers → Email). Phone-OTP
   was the original plan but needs a paid SMS provider, so connections are
   discovered by exact email match via the `find_connectable_profile` RPC
   (see `migrations/20260809000002_find_profile_by_email.sql`) instead.
4. Restart `expo start` after adding `.env` — Expo only inlines
   `EXPO_PUBLIC_*` vars at bundle time, not on hot reload.
