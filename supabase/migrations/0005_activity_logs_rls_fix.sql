-- Fixes activity logs not persisting: the table exists and is readable, but inserts/upserts from
-- the browser's anon key are rejected with 42501 ("new row violates row-level security policy").
-- This means row level security is enabled on public.activity_logs with no policy actually in
-- effect permitting writes - most likely because the table was created (via the dashboard table
-- editor, or by only partially running 0004_activity_logs.sql) without 0004's policy section ever
-- actually executing. Confirmed directly against the live project: select returns 200 with an
-- empty array, but insert returns 42501.
--
-- Idempotent re-statement of 0004's intended policy, safe to run even if some of it already
-- applied. Run this directly in the Supabase SQL editor - don't wait for a deploy, the app can't
-- apply this itself.

create table if not exists public.activity_logs (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_anon_all" on public.activity_logs;
create policy "activity_logs_anon_all" on public.activity_logs
  for all
  to anon, authenticated
  using (true)
  with check (true);
