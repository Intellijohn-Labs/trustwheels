-- Code Red alert contacts - same { id, data, created_at } row-store shape as every other
-- collection in this app (src/lib/collections.ts's defineCollection), plus updated_at to match
-- this project's standard table shape on the self-hosted instance.

create table if not exists public.escalation_contacts (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists escalation_contacts_data_gin_idx on public.escalation_contacts using gin (data);

-- Permissive RLS, matching every other table (vehicles, leads, hr_employees, ...): this app talks
-- to its database with the anon key directly from the browser, no server-side auth layer.
alter table public.escalation_contacts enable row level security;

drop policy if exists "escalation_contacts_anon_all" on public.escalation_contacts;
create policy "escalation_contacts_anon_all" on public.escalation_contacts
  for all
  to anon, authenticated
  using (true)
  with check (true);
