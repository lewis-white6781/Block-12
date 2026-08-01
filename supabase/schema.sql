-- BLOCK 12 v2.0 — Multi-device cloud sync schema
-- Run this once in the Supabase Dashboard → SQL Editor against a fresh project.
-- Idempotent via IF NOT EXISTS / CREATE OR REPLACE so it is safe to re-run.

create table if not exists public.block_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version int not null,
  settings jsonb not null,
  daily_entries jsonb not null,
  session_logs jsonb not null,
  benchmark_entries jsonb not null,
  progression_events jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.block_state enable row level security;

-- Allow users to select only their own row
drop policy if exists "select own state" on public.block_state;
create policy "select own state" on public.block_state
  for select using (auth.uid() = user_id);

-- Allow users to insert their own row
drop policy if exists "insert own state" on public.block_state;
create policy "insert own state" on public.block_state
  for insert with check (auth.uid() = user_id);

-- Allow users to update their own row
drop policy if exists "update own state" on public.block_state;
create policy "update own state" on public.block_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: this single-user app never deletes the cloud row from client code.
-- If a wipe is ever needed, do it from the Supabase dashboard.
