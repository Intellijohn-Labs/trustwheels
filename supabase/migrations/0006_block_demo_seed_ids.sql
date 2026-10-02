-- Permanently blocks the exact failure mode that kept reintroducing demo data: a stale client
-- (an old browser tab, or an old preview deployment) still running pre-purge JavaScript that
-- auto-inserted the deleted demo fleet/enquiry list whenever it saw an empty table. The
-- application code that did this has been removed (see the "enforce strict production mode"
-- commit), but nothing stopped a client that never reloaded that old code from writing it back
-- regardless. This constraint rejects that write at the database itself, so it's enforced no
-- matter which version of the app - or what else entirely - is doing the inserting.
--
-- vehicles: real records get a full UUID (crypto.randomUUID()), never "seed-<n>", so blocking
-- that whole prefix is unconditionally safe.
--
-- leads: real records get "lead-" + 8 random hex characters (newId("lead")), always exactly 8
-- characters long. The deleted demo seed used "lead-1" through "lead-12" - 1-2 plain digits, never
-- 8 characters. The pattern below matches only that specific demo shape, so a real lead (always
-- 8 chars) is never at risk of being rejected by this.
--
-- Run this directly in the Supabase SQL editor - this is a schema change (ALTER TABLE), which the
-- app's anon key cannot perform; nothing in the codebase can apply this automatically.
--
-- Before running: make sure both tables are already clear of matching rows (the wipe that
-- accompanies this migration handles that) - an ALTER TABLE ... ADD CONSTRAINT fails outright if
-- any existing row already violates it.

alter table public.vehicles drop constraint if exists vehicles_no_seed_ids;
alter table public.vehicles
  add constraint vehicles_no_seed_ids
  check (id !~ '^seed-');

alter table public.leads drop constraint if exists leads_no_demo_ids;
alter table public.leads
  add constraint leads_no_demo_ids
  check (id !~ '^lead-[0-9]{1,2}$');
