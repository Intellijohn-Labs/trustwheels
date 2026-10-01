-- Activity / audit log for the Managing Partner's Activity Log panel (/audit-logs).
--
-- Same { id, data, created_at } shape as every other collection in this app (vehicles,
-- gps_attendance, ...): one row per log entry, the full record stored as a jsonb blob keyed by
-- the app's own id. `data` holds (camelCase, matching src/lib/activity-log.ts's ActivityLog
-- type): at (ISO timestamp), actorName, actorRole, actionType, targetEntity, details.
--
-- Entries are written by logActivity() from inside the store functions that already enforce the
-- real permission checks (stock-store.ts, employees) - this table only ever needs to be read back,
-- never written to directly from the UI.

create table if not exists public.activity_logs (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Supports filtering the log by date, actor role, and action type.
create index if not exists activity_logs_at_idx on public.activity_logs (((data ->> 'at')));
create index if not exists activity_logs_role_idx on public.activity_logs (((data ->> 'actorRole')));
create index if not exists activity_logs_action_idx on public.activity_logs (((data ->> 'actionType')));
create index if not exists activity_logs_data_gin_idx on public.activity_logs using gin (data);

-- Permissive RLS, matching every other table in this app: the browser talks to Supabase with the
-- anon key directly, no server-side auth layer yet. Access to the /audit-logs screen itself is
-- gated client-side to the Managing Partner role (rbac.ts's "audit.view" permission).
alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_anon_all" on public.activity_logs;
create policy "activity_logs_anon_all" on public.activity_logs
  for all
  to anon, authenticated
  using (true)
  with check (true);
