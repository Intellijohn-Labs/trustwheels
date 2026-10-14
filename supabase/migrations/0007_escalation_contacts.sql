-- Code Red alert contacts - same { id, data, created_at } row-store shape as every other
-- table in this app, plus updated_at to match this project's standard table shape.
--
-- Written for the self-hosted PostgreSQL backend (src/lib/server-db.ts, queried only from
-- src/app/api/sync/route.ts - a trusted server context), NOT Supabase: there is no anon/
-- authenticated role or RLS policy here, since the browser never talks to Postgres directly
-- anymore. Table-level access control now lives entirely in /api/sync's own ALLOWED_TABLES
-- allowlist instead.

create table if not exists escalation_contacts (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists escalation_contacts_data_gin_idx on escalation_contacts using gin (data);
