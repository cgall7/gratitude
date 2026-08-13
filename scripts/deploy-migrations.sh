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

# `migration list` shows the local/remote *diff*. It does not show what push
# would do with that diff, and the gap between those two is where this goes
# wrong: `db push` without --include-all applies only migrations newer than
# the newest version in the remote history table, so a migration that landed
# on main *behind* an already-applied version is in the diff and is silently
# not in the push. That happens whenever branches merge out of timestamp
# order, which is normal, or whenever a deploy runs between two merges.
#
# --dry-run prints the exact list push would apply, against the real remote,
# without applying it. It turns "is anything going to be skipped?" from
# something you have to reason about into something you read. Same flags as
# the real push below, so what it prints is what the next command does.
echo
echo "Dry run — exactly the migrations 'db push' would apply. Anything listed as"
echo "local-only above but absent here is a migration push will skip; re-run with"
echo "--include-all after checking why:"
echo
# Not allowed to abort the script under `set -e`. A dry run that errors is
# information for the human at the prompt below, not a reason to refuse a
# deploy — the real push is about to report the same problem with the same
# words, and this step was added to show more, never to block more.
if ! npx --yes supabase db push --dry-run; then
  echo
  echo "!! The dry run itself failed. Nothing has been applied. Read its error above" >&2
  echo "!! before pressing Enter — 'db push' is about to hit the same thing." >&2
fi
echo
read -r -p "Both lists match expectations? Press Enter to run 'supabase db push', or Ctrl-C to stop and repair history first. "

npx --yes supabase db push
