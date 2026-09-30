-- GPS self check-in attendance for Trust Wheels.
--
-- Same { id, data, created_at } shape as every other collection in this app (vehicles,
-- ledger_entries, hr_employees, ...): one row per check-in, the full record stored as a jsonb
-- blob keyed by the app's own id. `data` holds (camelCase, matching src/lib/attendance-gps.ts's
-- GpsCheckin type): userId, userName, date, checkInTime, checkOutTime?, latitude, longitude,
-- googleMapsLink, status ("present" | "late").
--
-- This is a distinct table from the pre-existing, deliberately local-only HR attendance register
-- (an HR admin marking present/absent/leave for payroll) - that one is untouched by this feature.

create table if not exists public.gps_attendance (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Supports "who checked in on date X" and the daily attendance log query.
create index if not exists gps_attendance_date_idx on public.gps_attendance (((data ->> 'date')));
create index if not exists gps_attendance_user_idx on public.gps_attendance (((data ->> 'userId')));
create index if not exists gps_attendance_data_gin_idx on public.gps_attendance using gin (data);

-- Permissive RLS, matching every other table in this app: the browser talks to Supabase with the
-- anon key directly, no server-side auth layer yet.
alter table public.gps_attendance enable row level security;

drop policy if exists "gps_attendance_anon_all" on public.gps_attendance;
create policy "gps_attendance_anon_all" on public.gps_attendance
  for all
  to anon, authenticated
  using (true)
  with check (true);
