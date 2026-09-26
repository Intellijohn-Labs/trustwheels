"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEMO_USERS, ROLES, ROLE_ORDER, can, inScope, type Permission, type Role } from "./rbac";
import { DEFAULT_ROLE, currentRole, setRole, subscribeRole } from "./session";
import { hydrateRoleNames, setRoleNames, useRoleNames } from "./user-names";
import { employees } from "./hr";
import { hydrateBranchNames, useBranchNames } from "./branch-names";

interface RoleContextValue {
  role: Role;
  user: (typeof DEMO_USERS)[Role];
  roleDef: (typeof ROLES)[Role];
  setRole: (role: Role) => void;
  can: (permission: Permission) => boolean;
  inScope: (branchId: string) => boolean;
  /** Current display name of whoever holds a role (from the HR employee master). */
  nameOf: (role: Role) => string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/** Keeps role holders' display names in step with the HR employee master. */
function NameSync() {
  const { items, ready } = employees.useItems();
  useEffect(hydrateRoleNames, []);
  useEffect(hydrateBranchNames, []);
  useEffect(() => {
    if (!ready) return;
    const map: Partial<Record<Role, string>> = {};
    for (const e of items) if (e.rbacRole && e.status !== "exited" && !map[e.rbacRole]) map[e.rbacRole] = e.name;
    setRoleNames(map);
  }, [items, ready]);
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, currentRole, () => DEFAULT_ROLE);
  const nameOf = useRoleNames();
  const allNames = ROLE_ORDER.map(nameOf).join("|");
  const branchNames = useBranchNames();
  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      user: { ...DEMO_USERS[role], name: nameOf(role) },
      roleDef: ROLES[role],
      setRole,
      can: (p) => can(role, p),
      inScope: (b) => inScope(role, b),
      nameOf,
    }),
    // allNames / branchNames change on a rename, so every screen using the context refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, allNames, branchNames],
  );
  return (
    <RoleContext.Provider value={value}>
      <NameSync />
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}
