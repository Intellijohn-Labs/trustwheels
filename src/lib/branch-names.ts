"use client";

import { useSyncExternalStore } from "react";

/*
 * Branch display names chosen in Settings → Branches. The masters list reads names from here,
 * so every screen shows the new name. Branch ids never change, so history stays linked.
 * Applied after hydration (the server always renders the default names).
 */

const KEY = "tw-branch-names";
let overrides: Record<string, string> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function branchOverride(id: string): string | undefined {
  return overrides[id]?.trim() || undefined;
}

export function hydrateBranchNames() {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (JSON.stringify(cached) !== JSON.stringify(overrides)) {
      overrides = cached;
      emit();
    }
  } catch {
    // storage blocked or corrupt: default names stay
  }
}

export function writeBranchName(id: string, name: string | undefined) {
  const next = { ...overrides };
  if (name) next[id] = name;
  else delete next[id];
  overrides = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: applies for this visit only
  }
  emit();
}

let snapshot = "";
function getSnapshot() {
  const s = JSON.stringify(overrides);
  return s === snapshot ? snapshot : (snapshot = s);
}

/** Changes whenever a branch is renamed; include it in memo deps to refresh. */
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
