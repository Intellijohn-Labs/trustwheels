-- Remaining collections + vehicle media storage for Trust Wheels.
--
-- Same { id, data, created_at } shape as 0001_ledger_settlements.sql / the existing
-- `vehicles` table, one table per src/lib/collections.ts collection that now opts into
-- Supabase via `supabaseTable`.

create table if not exists public.leads (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists leads_created_at_idx on public.leads (((data ->> 'createdAt')));
create index if not exists leads_data_gin_idx on public.leads using gin (data);

create table if not exists public.calls (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists calls_due_at_idx on public.calls (((data ->> 'dueAt')));
create index if not exists calls_data_gin_idx on public.calls using gin (data);

create table if not exists public.campaigns (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_starts_at_idx on public.campaigns (((data ->> 'startsAt')));
create index if not exists campaigns_data_gin_idx on public.campaigns using gin (data);

create table if not exists public.funds (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists funds_at_idx on public.funds (((data ->> 'at')));
create index if not exists funds_data_gin_idx on public.funds using gin (data);

create table if not exists public.hr_employees (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists hr_employees_branch_idx on public.hr_employees (((data ->> 'branchId')));
create index if not exists hr_employees_data_gin_idx on public.hr_employees using gin (data);

-- Permissive RLS, matching vehicles / ledger_entries / settlements: this demo app talks to
-- Supabase with the anon key directly from the browser, with no server-side auth layer yet.
alter table public.leads enable row level security;
alter table public.calls enable row level security;
alter table public.campaigns enable row level security;
alter table public.funds enable row level security;
alter table public.hr_employees enable row level security;

drop policy if exists "leads_anon_all" on public.leads;
create policy "leads_anon_all" on public.leads for all to anon, authenticated using (true) with check (true);

drop policy if exists "calls_anon_all" on public.calls;
create policy "calls_anon_all" on public.calls for all to anon, authenticated using (true) with check (true);

drop policy if exists "campaigns_anon_all" on public.campaigns;
create policy "campaigns_anon_all" on public.campaigns for all to anon, authenticated using (true) with check (true);

drop policy if exists "funds_anon_all" on public.funds;
create policy "funds_anon_all" on public.funds for all to anon, authenticated using (true) with check (true);

drop policy if exists "hr_employees_anon_all" on public.hr_employees;
create policy "hr_employees_anon_all" on public.hr_employees for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------------------
-- Storage: vehicle-media bucket for car photos and document PDFs uploaded from the browser.
-- Public bucket so a stored file's public URL (what src/lib/vehicle-media.ts saves onto the
-- vehicle/document record) is directly viewable without a signed URL.
-- ---------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('vehicle-media', 'vehicle-media', true)
on conflict (id) do update set public = true;

drop policy if exists "vehicle_media_public_read" on storage.objects;
create policy "vehicle_media_public_read" on storage.objects
  for select
  to public
  using (bucket_id = 'vehicle-media');

drop policy if exists "vehicle_media_anon_upload" on storage.objects;
create policy "vehicle_media_anon_upload" on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'vehicle-media');

drop policy if exists "vehicle_media_anon_update" on storage.objects;
create policy "vehicle_media_anon_update" on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'vehicle-media');

drop policy if exists "vehicle_media_anon_delete" on storage.objects;
create policy "vehicle_media_anon_delete" on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'vehicle-media');
