-- 8b.2 (Create private hive flow) needs somewhere to put the two choices
-- the flow collects beyond a name: the cover theme (Deezine's design
-- language, GUIDES/PRIVATE_HIVE_DESIGN_LANGUAGE.md §1) and the review
-- cadence (Slices doc 8b.2's own row). Neither existed on `private_hives`
-- (20260815000001) -- that migration only ever added owner_id/subject_name.
--
-- private_hives has zero rows on prod (20260815000002's own comment, still
-- true -- the table has had no reader or writer anywhere in `src/` until
-- this PR), so both columns are safe as `not null default` rather than a
-- nullable-then-backfill dance.
--
-- Four selectable theme ids, matching GUIDES/PRIVATE_HIVE_DESIGN_LANGUAGE.md
-- §1 exactly -- golden-honey is NOT one of them, §1's own note reserves it
-- for the sealed-state wax seal badge (§9), never a creation-time cover
-- choice, and §1's own Default line names sunlit-honey.
-- PLANS/PRIVATE_HIVES_COVER_THEMES.md predates the design-language doc
-- Deezine posted as "ready for implementation" today and is superseded by
-- it; not used here.
alter table public.private_hives
  add column cover_theme text not null default 'sunlit-honey',
  add column review_cadence text not null default 'yearly';

alter table public.private_hives
  add constraint private_hives_cover_theme_check
    check (cover_theme in ('sunlit-honey', 'wildflower', 'starlight', 'cream-gold'));

alter table public.private_hives
  add constraint private_hives_review_cadence_check
    check (review_cadence in ('monthly', 'yearly', 'manual'));

-- Merge gate (Sage's standing rule): this migration must be applied to
-- production before the client code that writes cover_theme/review_cadence
-- (HiveStore.createHive) merges. See PR body.
