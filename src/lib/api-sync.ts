"use client";

/*
 * Thin browser-side client for /api/sync (src/app/api/sync/route.ts) - the self-hosted backend's
 * one data endpoint, backed by raw PostgreSQL via lib/server-db.ts. Every collection
 * (collections.ts's defineCollection, stock-store.ts's bespoke vehicles handling) and the shared
 * retry queue (sync-queue.ts) go through these three functions instead of talking to Supabase
 * directly for data, now that the managed Supabase project is decommissioned.
 *
 * Auth and file storage are NOT covered here and are unaffected by this - those still go through
 * the Supabase client (lib/supabase.ts) and remain a separate, not-yet-migrated concern.
 */

export interface SyncRow<T> {
  id: string;
  data: T;
}

export async function fetchTable<T>(table: string): Promise<T[] | null> {
  try {
    const res = await fetch(`/api/sync?table=${encodeURIComponent(table)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.data) ? (body.data as T[]) : null;
  } catch {
    return null;
  }
}

/** Never throws - resolves false on any failure so fire-and-forget callers can just check the result. */
export async function upsertRows<T>(table: string, rows: SyncRow<T>[]): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, items: rows }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteRows(table: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const res = await fetch(`/api/sync?table=${encodeURIComponent(table)}&ids=${encodeURIComponent(ids.join(","))}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
