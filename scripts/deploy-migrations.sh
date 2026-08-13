#!/usr/bin/env bash
# Push everything in supabase/migrations/ that isn't live yet onto the real
# project. This step did not exist anywhere in the repo before Project 1 —
# migrations landed on main and stopped there, so every feature that added
# a table (Notes, and Seeds right behind it) shipped in code while the prod
# database silently stayed on the previous schema.
#
#   npm run deploy:migrations
#
# Needs two things this script deliberately does not default or hardcode:
#   SUPABASE_PROJECT_REF   — the project ref from the dashboard URL
#   SUPABASE_ACCESS_TOKEN  — a personal access token (supabase.com/dashboard/account/tokens)
#
# `supabase link` uses the CLI's own migration history table
# (supabase_migrations.schema_migrations) on the remote project to know what's
# already applied, so this is safe to run repeatedly — already-applied
# migrations are skipped, not re-run.
set -euo pipefail

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF is not set — find it in the dashboard URL (supabase.com/dashboard/project/<ref>)." >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set — generate one at supabase.com/dashboard/account/tokens." >&2
  exit 1
fi

npx --yes supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx --yes supabase db push
