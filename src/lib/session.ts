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

export function getRole(): Role {
  try {
    const stored = localStorage.getItem(KEY) as Role | null;
    return stored && stored in ROLES ? stored : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
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
  return memory ?? getRole();
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
  return { ...DEMO_USERS[role], name: roleName(role) };
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
