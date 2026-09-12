-- BLOCK 12 v5.1 — analytics case-study columns.
-- Run once in Supabase Dashboard -> SQL Editor on the existing project
-- BEFORE deploying the v5.1 app build. Idempotent; safe to re-run.
-- Without these columns, the v5.1 client's push fails with a missing-column
-- error (sync shows it in More -> Sync) and no data is lost — local storage
-- remains the source of truth until the migration is applied.
alter table public.block_state add column if not exists decision_entries jsonb;
alter table public.block_state add column if not exists case_study_protocol jsonb;
