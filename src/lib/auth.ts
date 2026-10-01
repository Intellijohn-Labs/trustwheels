"use client";

import { supabase } from "./supabase";
import { employees, type Employee } from "./hr";
import { setRole, clearSession } from "./session";
import type { Role } from "./rbac";

/*
 * Real sign-in: Supabase Auth owns the credential (email + password), the `hr_employees` table
 * owns who's allowed to act as which role. A Supabase Auth account on its own grants nothing - it
 * only becomes a working session once its email matches an active employee record that also
 * carries a system login role (`rbacRole`), the same requirement the old demo flow's
 * isRoleLoginAllowed() checked, just resolved by email instead of a free role pick.
 */

export interface ResolvedAccount {
  employee: Employee;
  role: Role;
}

export function authConfigured() {
  return !!supabase;
}

/** The active, role-holding employee whose email matches a signed-in (or signing-up) account. */
export async function resolveEmployeeForEmail(email: string): Promise<ResolvedAccount | null> {
  const clean = email.trim().toLowerCase();
  const all = await employees.all();
  const match = all.find((e) => e.status === "active" && e.rbacRole && e.email.trim().toLowerCase() === clean);
  return match?.rbacRole ? { employee: match, role: match.rbacRole } : null;
}

export async function signInWithPassword(email: string, password: string): Promise<ResolvedAccount> {
  if (!supabase) throw new Error("Sign-in isn't available - this deployment isn't connected to Supabase yet.");
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  const resolved = await resolveEmployeeForEmail(data.user.email ?? email);
  if (!resolved) {
    await supabase.auth.signOut();
    throw new Error("This account isn't linked to an active employee with a system login role. Contact your Managing Partner.");
  }
  setRole(resolved.role);
  return resolved;
}

export async function signUpWithPassword(email: string, password: string): Promise<{ resolved: ResolvedAccount; needsEmailConfirmation: boolean }> {
  if (!supabase) throw new Error("Sign-up isn't available - this deployment isn't connected to Supabase yet.");
  // Checked up front too, not just after Supabase creates the account - no point minting an auth
  // account for an email the employee master doesn't recognise.
  const resolved = await resolveEmployeeForEmail(email);
  if (!resolved) {
    throw new Error("This email isn't registered to an active employee with a system login role. Contact your Managing Partner to be added first.");
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined },
  });
  if (error) throw new Error(error.message);
  if (data.session) {
    setRole(resolved.role);
    return { resolved, needsEmailConfirmation: false };
  }
  return { resolved, needsEmailConfirmation: true };
}

export async function signOutAuth() {
  // Clear local role state first - it's synchronous, so the UI reflects "signed out" immediately
  // regardless of how long the network round trip to actually revoke the Supabase session takes.
  clearSession();
  if (supabase) await supabase.auth.signOut();
}

/** Whether a real Supabase Auth session currently exists. Always true when Supabase isn't configured - with no backend to authenticate against, the app falls back to running without the gate rather than locking everyone out. */
export async function hasActiveSession(): Promise<boolean> {
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
