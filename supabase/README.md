# Connecting this app to a Supabase project

1. **App side (already done on this branch):** `.env.example` lists the two
   values the app needs. Copy it to `.env` and fill in Project URL + anon key
   from the Supabase dashboard → Settings → API. Never put the `service_role`
   key here — it bypasses Row Level Security and must never ship in the app.
2. **Database side:** apply the migrations in `migrations/` to the project —
   either paste each file into the dashboard's SQL Editor in order, or with
   the Supabase CLI:
   ```
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. **Auth:** email + password (Supabase Auth → Providers → Email). Phone-OTP
   was the original plan but needs a paid SMS provider, so connections are
   discovered by exact email match via the `find_connectable_profile` RPC
   (see `migrations/20260809000002_find_profile_by_email.sql`) instead.
4. Restart `expo start` after adding `.env` — Expo only inlines
   `EXPO_PUBLIC_*` vars at bundle time, not on hot reload.
