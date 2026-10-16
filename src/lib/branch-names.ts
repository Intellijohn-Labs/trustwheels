"use client";

import { useSyncExternalStore } from "react";

const KEY = "tw-branch-names";
let overrides: Record<string, string> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function branchOverride(id: string): string | undefined {
  return overrides[id]?.trim() || undefined;
}

// Fetch shared branch names from database on load
async function fetchServerBranchNames() {
  try {
    const res = await fetch("/api/sync?table=branches");
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json.data)) {
      const serverOverrides: Record<string, string> = {};
      for (const item of json.data) {
        if (item.id && item.name) {
          serverOverrides[item.id] = item.name;
        }
      }
      overrides = { ...overrides, ...serverOverrides };
      try {
        localStorage.setItem(KEY, JSON.stringify(overrides));
      } catch {}
      emit();
    }
  } catch {}
}

export function hydrateBranchNames() {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (Object.keys(cached).length > 0) {
      overrides = cached;
      emit();
    }
  } catch {}
  fetchServerBranchNames();
}

export async function writeBranchName(id: string, name: string | undefined) {
  const next = { ...overrides };
  if (name) next[id] = name;
  else delete next[id];
  overrides = next;

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  emit();

  // Sync to PostgreSQL server
  try {
    if (name) {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "branches",
          items: [{ id, name }],
        }),
      });
    } else {
      await fetch(`/api/sync?table=branches&id=${id}`, {
        method: "DELETE",
      });
    }
  } catch (err) {
    console.error("Failed to sync branch name to server", err);
  }
}

let snapshot = "";
function getSnapshot() {
  const s = JSON.stringify(overrides);
  return s === snapshot ? snapshot : (snapshot = s);
}

export function useBranchNames() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => "",
  );
}
