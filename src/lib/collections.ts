"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getKey, putKey } from "./db";

/*
 * A persisted, reactive list of records. Each domain (enquiries, calls, employees, ledger...)
 * defines one with its demo seed:
 *
 *   export const leads = defineCollection<Lead>("leads", seedLeads, 1);
 *   const { items, ready } = leads.useItems();
 *   await leads.add(lead); await leads.update(id, (l) => ({ ...l, stage: "booked" }));
 *
 * Bump `seedVersion` when the demo seed changes shape; stored data is then re-seeded.
 */

interface Stored<T> {
  seedVersion: number;
  items: T[];
}

export function defineCollection<T extends { id: string }>(name: string, seed: () => T[], seedVersion = 1) {
  let cache: T[] | null = null;
  let loading: Promise<T[]> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function load() {
    loading ??= (async () => {
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
      return item;
    },
    async update(id: string, change: (item: T) => T) {
      await load();
      const items = cache!;
      const current = items.find((i) => i.id === id);
      if (!current) throw new Error(`${name}: ${id} not found`);
      const next = change(current);
      await save(items.map((i) => (i.id === id ? next : i)));
      return next;
    },
    async replaceAll(items: T[]) {
      await load();
      await save(items);
    },
  };
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
