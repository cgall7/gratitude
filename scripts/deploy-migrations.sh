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
# `db push` only skips what's already applied if the remote's own history
# table (supabase_migrations.schema_migrations) says so. If earlier schema
# on this project was ever applied by hand through the dashboard SQL editor
# instead of this CLI, that table won't have those versions — push then
# starts from the oldest local migration, hits `42P07 relation already
# exists` on the first `create table`, and stops before touching the
# migrations you actually wanted applied. `migration list` below shows the
# local/remote diff *before* push runs, specifically so that failure mode is
# visible instead of looking like a broken script. See supabase/README.md
# for the repair command if local and remote disagree on the old versions.
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

echo
echo "Local vs. remote migration history — check every pre-existing version below"
echo "shows applied on both sides before continuing:"
echo
npx --yes supabase migration list
echo
read -r -p "Matches expectations? Press Enter to run 'supabase db push', or Ctrl-C to stop and repair history first. "

npx --yes supabase db push
