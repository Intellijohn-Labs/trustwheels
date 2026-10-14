"use client";

import { useSyncExternalStore } from "react";
import { getKey, putKey } from "./db";
import { deleteRows, upsertRows } from "./api-sync";

/*
 * A shared retry queue for /api/sync writes that fail (offline, timeout, transient error).
 * collections.ts and stock-store.ts both call `enqueueRetry()` from inside their own fire-and-
 * forget upsert/delete calls whenever one comes back with an error, instead of just logging it
 * and moving on. The queue itself is persisted to IndexedDB (survives a reload while offline) and
 * drains automatically on the `online` event, on page focus, and on a slow background interval -
 * whichever happens first. `useSyncStatus()` exposes the result for the navbar's status pill.
 */

export type SyncStatus = "synced" | "syncing" | "offline" | "not-configured";

interface PendingOp {
  id: string;
  table: string;
  kind: "upsert" | "delete";
  rows?: { id: string; data: unknown }[];
  ids?: string[];
}

const QUEUE_KEY = "sync-queue";
let queue: PendingOp[] = [];
let inFlight = 0;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function persist() {
  putKey(QUEUE_KEY, queue).catch(() => {});
}

let loading: Promise<void> | null = null;
function loadQueue() {
  loading ??= (async () => {
    queue = (await getKey<PendingOp[]>(QUEUE_KEY).catch(() => undefined)) ?? [];
    emit();
  })();
  return loading;
}

/** Call right before a fire-and-forget /api/sync write starts, so the pill can show "Syncing…" while it's in flight. */
export function beginSync() {
  inFlight++;
  emit();
}

/** Call once that write settles, success or not. */
export function endSync() {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

/**
 * Whether the most recently *settled* /api/sync call (read or write, from any collection)
 * succeeded. Starts `false` (optimistic "reachable") rather than defaulting to an error state, so
 * a fresh page load reports "Synced" the moment its first call succeeds instead of being stuck
 * showing a stale "not configured" until something happens to flip it - the actual bug this
 * replaces (that state used to come from a static, build-time `!supabase` check that never
 * re-evaluated once the project was decommissioned).
 */
let lastSyncFailed = false;

/** Collections call this after every /api/sync read/write settles, so the pill reflects reality. */
export function reportSyncResult(ok: boolean) {
  if (lastSyncFailed === !ok) return;
  lastSyncFailed = !ok;
  emit();
}

/** Queues a failed write to retry later. Safe to call repeatedly; queue only grows on real failures. */
export async function enqueueRetry(op: Omit<PendingOp, "id">) {
  await loadQueue();
  queue = [...queue, { ...op, id: `sync-${Date.now()}-${seq++}` }];
  persist();
  emit();
}

let draining = false;

/** Replays every queued write in order; anything that still fails stays queued for next time. */
export async function drain() {
  if (draining || !isOnline()) return;
  await loadQueue();
  if (queue.length === 0) return;
  draining = true;
  beginSync();
  const pending = [...queue];
  for (const op of pending) {
    const ok = op.kind === "upsert" ? await upsertRows(op.table, op.rows!) : await deleteRows(op.table, op.ids!);
    reportSyncResult(ok);
    if (ok) queue = queue.filter((q) => q.id !== op.id);
    // not ok: network still down or the table still unreachable - leave it queued, try again next drain
  }
  persist();
  endSync();
  draining = false;
  emit();
}

/**
 * A distinct state from "offline": the device has no connectivity problem, /api/sync itself is
 * unreachable or erroring (wrong DATABASE_URL, the backend down, a missing table). Every device in
 * that state is working against its own local, never-shared IndexedDB copy, which is exactly what
 * makes two devices "see completely different data" - silently falling back to "offline" here
 * would hide that this isn't temporary and won't resolve itself by reconnecting. Reflects the
 * *actual* result of the last /api/sync call (`reportSyncResult`), not a static build-time check -
 * that's what previously left this stuck showing "Local only" even once the backend was working.
 */
function computeStatus(): SyncStatus {
  if (!isOnline()) return "offline";
  if (inFlight > 0 || queue.length > 0) return "syncing";
  if (lastSyncFailed) return "not-configured";
  return "synced";
}

let wired = false;
function wireOnce() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  loadQueue().then(drain);
  window.addEventListener("online", () => {
    emit();
    drain();
  });
  window.addEventListener("offline", emit);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) drain();
  });
  setInterval(drain, 30_000);
}

function subscribe(listener: () => void) {
  wireOnce();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, computeStatus, () => "synced");
}
