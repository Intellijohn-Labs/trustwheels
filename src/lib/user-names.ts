"use client";

import { useSyncExternalStore } from "react";
import { DEMO_USERS, type Role } from "./rbac";

/*
 * Display names of the people holding each role. The HR employee master is the source
 * (an employee's `rbacRole` links them to a role); when HR renames someone, every screen and
 * every new "done by" stamp uses the new name. Cached so the last known names show instantly.
 * Existing records keep the name that was current when they were made (audit history).
 */

const KEY = "tw-role-names";
let names: Partial<Record<Role, string>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function roleName(role: Role) {
  return names[role]?.trim() || DEMO_USERS[role].name;
}

/** Apply the last known names after hydration (the server always renders the defaults). */
export function hydrateRoleNames() {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (JSON.stringify(cached) !== JSON.stringify(names)) {
      names = cached;
      emit();
    }
  } catch {
    // storage blocked or corrupt: keep defaults until HR data loads
  }
}

export function setRoleNames(next: Partial<Record<Role, string>>) {
  if (JSON.stringify(next) === JSON.stringify(names)) return;
  names = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: names still apply for this visit
  }
  emit();
}

let snapshot = "";
function getSnapshot() {
  const s = JSON.stringify(names);
  return s === snapshot ? snapshot : (snapshot = s);
}

/** Re-renders when any role holder's name changes; read names with roleName(). */
export function useRoleNames() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => "",
  );
  return roleName;
}

// Staff pickers: the named role holder plus the other people in that job.
export const salesExecutives = () => [roleName("sales_executive"), "Nithin Babu"];
export const telecallers = () => [roleName("telecaller"), "Anju Thomas"];
export const supervisors = () => [roleName("supervisor"), "Sajan Thomas"];
