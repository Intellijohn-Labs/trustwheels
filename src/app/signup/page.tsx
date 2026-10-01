"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, cn, inputClass } from "@/components/ui";
import { signUpWithPassword } from "@/lib/auth";

type Phase = "form" | "submitting" | "error" | "confirm-email" | "signed-in";

/**
 * Self-service account setup: a work email must already match an active employee with a system
 * login role in the employee master (see resolveEmployeeForEmail in lib/auth.ts) before Supabase
 * Auth will ever create a credential for it - this page can't be used to mint an account for
 * someone who isn't already a registered employee.
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);

  // Redirecting an already-signed-in visitor away from this form is handled centrally in
  // AppShell's session guard, so this page doesn't race it toward a different destination.

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setPhase("submitting");
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(email, password);
      if (needsEmailConfirmation) {
        setPhase("confirm-email");
      } else {
        setPhase("signed-in");
        router.push("/dashboard");
      }
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Couldn't set up your account");
    }
  }

  const busy = phase === "submitting";

  return (
    <div className="relative grid min-h-dvh place-items-center bg-page px-5 py-10">
      <div aria-hidden className="aurora-bg" />
      <ThemeToggle className="absolute top-5 right-5 z-10 sm:top-8 sm:right-8" />
      <div className="relative z-[1] w-full max-w-sm">
        <Link href="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <div className="mb-7">
          <Logo className="h-12 w-auto" />
        </div>

        {phase === "confirm-email" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it, then come back and sign in with your new password.
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <h1 className="text-gradient text-2xl font-semibold tracking-tight">Set up your account</h1>
            <p className="mt-1 text-sm text-muted">Use your work email - it must already be on file as an active employee.</p>

            <div className="mt-6">
              <label htmlFor="email" className="text-sm font-medium">
                Work email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@trustwheels.in"
                  className={cn(inputClass(), "pl-10")}
                />
              </div>
            </div>

            <div className="mt-4">
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
                Confirm password
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
                  <Loader2 className="size-4 animate-spin" /> Setting up…
                </>
              ) : (
                "Create account"
              )}
            </Button>

            <p className="mt-5 text-center text-sm text-muted">
              Already set up? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
