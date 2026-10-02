"use client";

/*
 * Plain, non-reactive signals - not application state, just flags AppShell's session guard reads
 * to know an auth transition's own UI is already mid-flow and should be left to finish and
 * navigate on its own terms, rather than reacting to the underlying session change the instant it
 * happens and pre-empting it.
 *
 * Login: signing in creates a real Supabase session immediately, before the page's own mandatory
 * GPS check-in has resolved; without this, AppShell's "already-authed visitor on the login form ->
 * /dashboard" rule would race that GPS check and wave the person through regardless of outcome.
 *
 * Logout: revoking the session happens immediately on click (so local state clears right away),
 * well before the drive-away animation's own fixed beat has played out; without this, AppShell's
 * "no session -> /login" rule fires the moment the session is actually gone and yanks the whole
 * page (sidebar, sign-out button, and the portal-rendered animation it owns) straight to a loading
 * screen, cutting the animation off mid-motion instead of letting it finish.
 */
let loginInProgress = false;
let logoutInProgress = false;

export function beginLoginFlow() {
  loginInProgress = true;
}

export function endLoginFlow() {
  loginInProgress = false;
}

export function isLoginFlowInProgress() {
  return loginInProgress;
}

export function beginLogoutFlow() {
  logoutInProgress = true;
}

export function endLogoutFlow() {
  logoutInProgress = false;
}

export function isLogoutFlowInProgress() {
  return logoutInProgress;
}
