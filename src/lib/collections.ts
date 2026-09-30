"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getKey, putKey } from "./db";
import { supabase } from "./supabase";
import { beginSync, endSync, enqueueRetry } from "./sync-queue";

/*
 * A persisted, reactive list of records. Each domain (enquiries, calls, employees, ledger...)
 * defines one with its demo seed:
 *
 *   export const leads = defineCollection<Lead>("leads", seedLeads, 1);
 *   const { items, ready } = leads.useItems();
 *   await leads.add(lead); await leads.update(id, (l) => ({ ...l, stage: "booked" }));
 *
 * Bump `seedVersion` when the demo seed changes shape; stored data is then re-seeded.
 *
 * Passing `supabaseTable` opts a collection into also syncing with a Supabase table shaped
 * (id text primary key, data jsonb) - same shape as stock-store.ts's `vehicles` table. Reads
 * prefer Supabase when it's configured and the table has rows (seeding it once if empty);
 * every write mirrors to the local IndexedDB copy either way, so the collection still works
 * offline or before Supabase is set up. Collections that don't pass it are untouched.
 */

interface Stored<T> {
  seedVersion: number;
  items: T[];
}

export function defineCollection<T extends { id: string }>(name: string, seed: () => T[], seedVersion = 1, opts: { supabaseTable?: string } = {}) {
  let cache: T[] | null = null;
  let loading: Promise<T[]> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const table = opts.supabaseTable;
  // Set once a write against `table` has failed, so a missing/misconfigured table logs one
  // clear diagnostic instead of spamming the console on every subsequent add/update/delete.
  let warnedMissingTable = false;
  function warnSyncFailed(action: string, message: string) {
    if (warnedMissingTable) return;
    warnedMissingTable = true;
    console.error(
      `Supabase ${action} failed (${name}): ${message}. Has the migration that creates "${table}" been run against this Supabase project? See supabase/migrations/.`,
    );
  }

  async function fetchFromSupabase(): Promise<T[] | null> {
    if (!table || !supabase) return null;
    try {
      const { data, error } = await supabase.from(table).select("data");
      if (error) {
        warnSyncFailed("read", error.message);
        return null;
      }
      if (!data || data.length === 0) {
        const seeds = seed();
        const { error: insertError } = await supabase.from(table).insert(seeds.map((item) => ({ id: item.id, data: item })));
        if (insertError) {
          warnSyncFailed("seed", insertError.message);
          return null;
        }
        return seeds;
      }
      return data.map((row: { data: T }) => row.data);
    } catch {
      return null;
    }
  }

  function syncUpsert(items: T[]) {
    if (!table || !supabase || items.length === 0) return;
    const rows = items.map((item) => ({ id: item.id, data: item }));
    beginSync();
    supabase
      .from(table)
      .upsert(rows)
      .then(({ error }) => {
        endSync();
        if (error) {
          warnSyncFailed("sync", error.message);
          enqueueRetry({ table, kind: "upsert", rows });
        }
      });
  }

  function syncDelete(ids: string[]) {
    if (!table || !supabase || ids.length === 0) return;
    beginSync();
    supabase
      .from(table)
      .delete()
      .in("id", ids)
      .then(({ error }) => {
        endSync();
        if (error) {
          warnSyncFailed("delete", error.message);
          enqueueRetry({ table, kind: "delete", ids });
        }
      });
  }

  function load() {
    loading ??= (async () => {
      const remote = await fetchFromSupabase();
      if (remote) {
        cache = remote;
        emit();
        return cache;
      }
      const stored = await getKey<Stored<T>>(`c:${name}`);
      if (stored && stored.seedVersion === seedVersion) {
        cache = stored.items;
      } else {
        cache = seed();
        await putKey(`c:${name}`, { seedVersion, items: cache } satisfies Stored<T>);
      }
      emit();
      return cache;
    })();
    return loading;
  }

  async function save(items: T[]) {
    cache = items;
    emit();
    await putKey(`c:${name}`, { seedVersion, items } satisfies Stored<T>);
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  }

  return {
    name,
    useItems() {
      const items = useSyncExternalStore(subscribe, () => cache, () => null);
      useEffect(() => {
        load();
      }, []);
      return { items: items ?? [], ready: items !== null };
    },
    async all() {
      await load();
      return cache!;
    },
    async add(item: T) {
      await load();
      await save([item, ...cache!]);
      syncUpsert([item]);
      return item;
    },
    async update(id: string, change: (item: T) => T) {
      await load();
      const items = cache!;
      const current = items.find((i) => i.id === id);
      if (!current) throw new Error(`${name}: ${id} not found`);
      const next = change(current);
      await save(items.map((i) => (i.id === id ? next : i)));
      syncUpsert([next]);
      return next;
    },
    async replaceAll(items: T[]) {
      await load();
      await save(items);
      syncUpsert(items);
    },
    async remove(id: string) {
      await load();
      await save(cache!.filter((i) => i.id !== id));
      syncDelete([id]);
    },
    async removeMany(ids: string[]) {
      await load();
      const drop = new Set(ids);
      await save(cache!.filter((i) => !drop.has(i.id)));
      syncDelete(ids);
    },
  };
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
