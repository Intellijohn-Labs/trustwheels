"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getKey, putKey } from "./db";
import { deleteRows, fetchTable, upsertRows } from "./api-sync";
import { beginSync, endSync, enqueueRetry, reportSyncResult } from "./sync-queue";

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
 * Passing `supabaseTable` opts a collection into also syncing with the self-hosted backend's
 * /api/sync endpoint (lib/api-sync.ts -> src/app/api/sync/route.ts -> raw PostgreSQL via
 * lib/server-db.ts), against a table shaped (id text primary key, data jsonb) - same shape as
 * stock-store.ts's `vehicles` table. The option is still named `supabaseTable` even though data
 * no longer goes through Supabase - renaming it would mean touching every collection definition
 * for a cosmetic change. Reads prefer the backend when it's reachable, falling back to the local
 * IndexedDB copy only when it's unreachable; every write mirrors to that local copy either way, so
 * the collection still works offline. Collections that don't pass it are untouched. An empty
 * backend table is never auto-seeded with demo data - once a project is live, "empty" legitimately
 * means "nothing here right now" (e.g. after an intentional clear-out or every record having been
 * deleted), not "needs the demo fleet/roster back." Only the local, single-browser IndexedDB
 * fallback still seeds, and only when the backend can't be reached at all.
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
  // Set once a read/write against `table` has failed, so a missing table or unreachable backend
  // logs one clear diagnostic instead of spamming the console on every subsequent attempt.
  let warnedMissingTable = false;
  function warnSyncFailed(action: string) {
    if (warnedMissingTable) return;
    warnedMissingTable = true;
    console.error(`/api/sync ${action} failed (${name}, table "${table}"). Is the self-hosted database reachable, and does this table exist?`);
  }

  async function fetchRemote(): Promise<T[] | null> {
    if (!table) return null;
    const rows = await fetchTable<T>(table);
    reportSyncResult(rows !== null);
    if (rows === null) warnSyncFailed("read");
    return rows;
  }

  function syncUpsert(items: T[]) {
    if (!table || items.length === 0) return;
    const rows = items.map((item) => ({ id: item.id, data: item }));
    beginSync();
    upsertRows(table, rows).then((ok) => {
      endSync();
      reportSyncResult(ok);
      if (!ok) {
        warnSyncFailed("sync");
        enqueueRetry({ table, kind: "upsert", rows });
      }
    });
  }

  function syncDelete(ids: string[]) {
    if (!table || ids.length === 0) return;
    beginSync();
    deleteRows(table, ids).then((ok) => {
      endSync();
      reportSyncResult(ok);
      if (!ok) {
        warnSyncFailed("delete");
        enqueueRetry({ table, kind: "delete", ids });
      }
    });
  }

  function load() {
    loading ??= (async () => {
      const remote = await fetchRemote();
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

  /**
   * Re-fetches from the backend and replaces the cache if it's reachable - `load()`'s own promise
   * is cached forever (so a long-lived tab only ever fetches once), which is exactly how a second
   * device's changes stop showing up without a hard reload. This is the stale-while-revalidate
   * half: `load()` still resolves instantly from whatever's cached, revalidate() pulls what's
   * actually current in the background and lets a normal mutation update (`save()` + `emit()`)
   * carry it to every subscriber. A no-op for collections with no `supabaseTable` - there's
   * nothing to revalidate against.
   */
  async function revalidate() {
    const remote = await fetchRemote();
    if (remote) {
      cache = remote;
      emit();
    }
  }

  let revalidationWired = false;
  function wireRevalidation() {
    if (revalidationWired || typeof window === "undefined") return;
    revalidationWired = true;
    window.addEventListener("online", revalidate);
    window.addEventListener("tw:refresh", revalidate);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) revalidate();
    });
    // Live cross-device sync: a plain REST endpoint has no push/realtime channel to subscribe to
    // (unlike Supabase's old postgres_changes), so this polls instead - same cadence as the retry
    // queue's own background drain. Simpler and safer than trying to merge a single changed row
    // into the cache: this store already holds the whole list in memory, so a wholesale refresh
    // can't drift from a partial merge.
    if (table) setInterval(revalidate, 20_000);
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
        wireRevalidation();
      }, []);
      return { items: items ?? [], ready: items !== null };
    },
    revalidate,
    async all() {
      await load();
      wireRevalidation();
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
