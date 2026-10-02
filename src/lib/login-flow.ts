"use client";

/*
 * A plain, non-reactive signal - not application state, just a flag AppShell's session guard
 * reads to know /login is already mid-flow. Signing in creates a real Supabase session
 * immediately, before the page's own mandatory GPS check-in has resolved; without this,
 * AppShell's own "already-authed visitor on the login form -> /dashboard" rule races that GPS
 * check and would wave the person through regardless of how it turns out. While this flag is
 * set, AppShell leaves /login alone and lets it navigate on its own terms (confirm the check-in,
 * or revoke the session and block entry) instead of pre-empting it.
 */
let inProgress = false;

export function beginLoginFlow() {
  inProgress = true;
}

export function endLoginFlow() {
  inProgress = false;
}

export function isLoginFlowInProgress() {
  return inProgress;
}
