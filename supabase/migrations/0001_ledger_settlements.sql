-- Ledger & Settlements tables for Trust Wheels.
--
-- Shape matches the existing `vehicles` table: one row per record, the full record stored
-- as a jsonb blob in `data` (keyed by the app's own id), so the store layer can upsert with
-- { id, data } exactly like src/lib/stock-store.ts already does.
--
-- A settlement links to its two posted ledger legs via `data->'ledgerIds'` (a jsonb array
-- of ledger entry ids), not a relational column, so there is no single-column foreign key
-- to declare between the two tables. That link's integrity (deleting a settlement also
-- deletes its ledger legs, and vice versa) is enforced in the application layer by the
-- cascade-delete helpers in src/lib/settlements.ts, the same way it would be enforced by a
-- server-side trigger if the link were a real column.

create table if not exists public.ledger_entries (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Supports "all entries dated on/after X" and the ledger page's date-range filter.
create index if not exists ledger_entries_at_idx on public.ledger_entries (((data ->> 'at')));
-- Supports filtering by branch, type, vehicle without scanning the jsonb linearly.
create index if not exists ledger_entries_data_gin_idx on public.ledger_entries using gin (data);

create table if not exists public.settlements (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists settlements_at_idx on public.settlements (((data ->> 'at')));
create index if not exists settlements_data_gin_idx on public.settlements using gin (data);

-- Permissive RLS: this demo app talks to Supabase with the anon key directly from the
-- browser (no server-side auth layer yet), matching the `vehicles` table's access model.
alter table public.ledger_entries enable row level security;
alter table public.settlements enable row level security;

drop policy if exists "ledger_entries_anon_all" on public.ledger_entries;
create policy "ledger_entries_anon_all" on public.ledger_entries
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "settlements_anon_all" on public.settlements;
create policy "settlements_anon_all" on public.settlements
  for all
  to anon, authenticated
  using (true)
  with check (true);
