"use client";

import { useSyncExternalStore } from "react";

/** Employees & Access shows people as ID badges (default) or as a table. */
export type EmployeeView = "cards" | "table";

const KEY = "tw-employees-view";
const listeners = new Set<() => void>();
let current: EmployeeView | undefined;

function read(): EmployeeView {
  try {
    return localStorage.getItem(KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getSnapshot = () => (current ??= read());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setEmployeeView(view: EmployeeView) {
  current = view;
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // storage blocked: the choice still holds for this page view
  }
  listeners.forEach((l) => l());
}

/** The saved view. Read through useSyncExternalStore so the server render and first client render agree (cards) and a saved "table" slots in right after hydration, with no mismatch warning. */
export function useEmployeeView(): [EmployeeView, (view: EmployeeView) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, () => "cards" as EmployeeView);
  return [view, setEmployeeView];
}
