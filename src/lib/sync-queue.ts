"use client";

import { useSyncExternalStore } from "react";
import { getKey, putKey } from "./db";
import { supabase } from "./supabase";

/*
 * A shared retry queue for Supabase writes that fail (offline, timeout, transient error).
 * collections.ts and stock-store.ts both call `enqueueRetry()` from inside their own fire-and-
 * forget upsert/delete calls whenever one comes back with an error, instead of just logging it
 * and moving on. The queue itself is persisted to IndexedDB (survives a reload while offline) and
 * drains automatically on the `online` event, on page focus, and on a slow background interval -
 * whichever happens first. `useSyncStatus()` exposes the result for the navbar's status pill.
 */

export type SyncStatus = "synced" | "syncing" | "offline";

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

/** Call right before a fire-and-forget Supabase write starts, so the pill can show "Syncing…" while it's in flight. */
export function beginSync() {
  inFlight++;
  emit();
}

/** Call once that write settles, success or not. */
export function endSync() {
  inFlight = Math.max(0, inFlight - 1);
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
  if (draining || !supabase || !isOnline()) return;
  await loadQueue();
  if (queue.length === 0) return;
  draining = true;
  beginSync();
  const pending = [...queue];
  for (const op of pending) {
    try {
      const { error } = op.kind === "upsert" ? await supabase.from(op.table).upsert(op.rows!) : await supabase.from(op.table).delete().in("id", op.ids!);
      if (!error) queue = queue.filter((q) => q.id !== op.id);
    } catch {
      // network still down or table still unreachable - leave it queued, try again next drain
    }
  }
  persist();
  endSync();
  draining = false;
  emit();
}

function computeStatus(): SyncStatus {
  if (!isOnline()) return "offline";
  if (inFlight > 0 || queue.length > 0) return "syncing";
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
