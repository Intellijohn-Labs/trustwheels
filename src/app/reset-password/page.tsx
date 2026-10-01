"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, cn, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { signOutAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Phase = "verifying" | "ready" | "invalid-link" | "submitting" | "done";

/**
 * Step 2 of the reset flow. The normal path: the email link points at /auth/callback, a server
 * Route Handler that already exchanged the PKCE code for a session (reading the code_verifier
 * cookie set when the reset was requested) before redirecting here - so by the time this page
 * loads, getSession() below should already find a session immediately, cookie-backed, no waiting
 * required. That exchange happens server-side specifically so it still works when the link is
 * opened in a different browser than the one that requested the reset, which a client-only
 * exchange can't guarantee (the code_verifier it needs only exists in the requesting browser).
 *
 * Fallback path, kept for resilience: an older link shaped like `#access_token=...&type=recovery`
 * is handled by the browser Supabase client's own detectSessionInUrl, which fires a
 * PASSWORD_RECOVERY event once it's done - this page listens for that too, rather than assuming
 * the server-side path is the only way a session could arrive here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>(supabase ? "verifying" : "invalid-link");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const settle = (hasSession: boolean) => {
      if (active) setPhase((p) => (p === "verifying" ? (hasSession ? "ready" : "invalid-link") : p));
    };
    supabase.auth.getSession().then(({ data }) => settle(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) settle(true);
    });
    // The reset link can land here one of two ways: tokens in the URL hash (#access_token=...,
    // resolved locally, near-instant) or a PKCE `?code=` that needs an actual network round trip
    // to exchange - both are handled automatically by the Supabase client on load, this just has
    // to wait long enough for whichever one it is. A plain visit with neither in the URL has
    // nothing to resolve, so there's no reason to make that case sit through the same wait.
    const hasRecoveryMaterial = /type=recovery/.test(window.location.hash) || /[?&]code=/.test(window.location.search);
    const timeout = setTimeout(() => settle(false), hasRecoveryMaterial ? 10_000 : 1_500);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!supabase) return setError("Password reset isn't available - this deployment isn't connected to Supabase yet.");
    setPhase("submitting");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPhase("ready");
      setError(updateError.message);
      return;
    }
    toast("ok", "Password updated successfully!");
    setPhase("done");
    await signOutAuth();
    router.push("/login");
  }

  const busy = phase === "submitting" || phase === "done";

  return (
    <div className="relative grid min-h-dvh place-items-center bg-page px-5 py-10">
      <div aria-hidden className="aurora-bg" />
      <ThemeToggle className="absolute top-5 right-5 z-10 sm:top-8 sm:right-8" />
      <div className="relative z-[1] w-full max-w-sm">
        <div className="mb-7">
          <Logo className="h-12 w-auto" />
        </div>

        {phase === "verifying" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
            <Loader2 className="size-6 animate-spin text-muted" />
            <p className="text-sm text-muted">Verifying your reset link…</p>
          </div>
        ) : phase === "invalid-link" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Link invalid or expired</h1>
            <p className="mt-2 text-sm text-muted">This password reset link isn&apos;t valid anymore. Request a new one to continue.</p>
            <Link href="/forgot-password" className="mt-5 inline-block text-sm font-medium text-brand hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <h1 className="text-gradient text-2xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-muted">Choose a new password for your account.</p>

            <div className="mt-6">
              <label htmlFor="password" className="text-sm font-medium">
                New password
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={cn(inputClass(), "px-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="confirm" className="text-sm font-medium">
                Confirm new password
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  className={cn(inputClass(), "pl-10")}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
