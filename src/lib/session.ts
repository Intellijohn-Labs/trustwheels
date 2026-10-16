import { DEMO_USERS, ROLES, can, inScope, type Permission, type Role } from "./rbac";
import { roleName } from "./user-names";

/*
 * The signed-in demo user. Stands in for the server session: store mutations call
 * assertCan() the way the API will check permissions, so bypassing a hidden button
 * doesn't bypass the rule.
 */

const KEY = "tw-role";
export const DEFAULT_ROLE: Role = "managing_partner";

const listeners = new Set<() => void>();

export function getRole(): Role | null {
  try {
    const stored = typeof window !== "undefined" ? (localStorage.getItem(KEY) as Role | null) : null;
    return stored && stored in ROLES ? stored : null;
  } catch {
    return null;
  }
}

export function setRole(role: Role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    // storage blocked: role still changes for this page view below
  }
  memory = role;
  listeners.forEach((l) => l());
}

let memory: Role | null = null;

export function currentRole(): Role {
  return memory ?? getRole() ?? DEFAULT_ROLE;
}
export function hasActiveSession(): boolean {
  return !!(memory ?? getRole());
  return Boolean(memory ?? getRole());
}

/** Sign-out: forgets the stored role so the next visit starts from DEFAULT_ROLE, same as a first-ever visit. */
export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("tw-employee-id");
    localStorage.removeItem("tw-employee-name");
    localStorage.removeItem("tw-employee-profile");
    sessionStorage.clear();
  } catch {
    // storage blocked: memory reset below still clears it for this page view
  }
  memory = null;
  listeners.forEach((l) => l());
}

export function subscribeRole(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getActor() {
  const role = currentRole();
  const demo = DEMO_USERS[role] || { id: "u-unknown", name: "User", role, base: "b1" };

  try {
    if (typeof window !== "undefined") {
      const rawEmployee = localStorage.getItem("tw-employee-profile");
      if (rawEmployee) {
        const emp = JSON.parse(rawEmployee);
        return {
          ...demo,
          id: emp.id || localStorage.getItem("tw-employee-id") || demo.id,
          name: emp.name || localStorage.getItem("tw-employee-name") || demo.name,
          base: emp.branchId || emp.base || demo.base,
          role: emp.rbacRole || role,
        };
      }
      const storedName = localStorage.getItem("tw-employee-name");
      const storedId = localStorage.getItem("tw-employee-id");
      return {
        ...demo,
        id: storedId || demo.id,
        name: storedName || demo.name,
      };
    }
  } catch {}

  return demo;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Not allowed: ${ROLES[currentRole()].label} can't do "${permission}"`);
  }
}

export function assertCan(permission: Permission) {
  if (!can(currentRole(), permission)) throw new ForbiddenError(permission);
}

export function assertScope(branchId: string) {
  if (!inScope(currentRole(), branchId)) throw new Error("Not allowed: this branch is outside your scope");
}
