"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, cn, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { resolveEmployeeForEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Phase = "form" | "submitting" | "sent" | "error";

/**
 * Self-service password reset, step 1: collect the work email, confirm it's actually registered
 * to an active employee (same check sign-in and sign-up use - see resolveEmployeeForEmail), then
 * ask Supabase to email a recovery link. The link lands on /reset-password, which does the actual
 * password change once Supabase hands it a valid recovery session.
 */
export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setPhase("error");
      setError("Password reset isn't available - this deployment isn't connected to Supabase yet.");
      return;
    }
    setPhase("submitting");
    try {
      const resolved = await resolveEmployeeForEmail(email);
      if (!resolved) {
        throw new Error("This email isn't registered to an active employee with a system login role. Contact your Managing Partner.");
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw new Error(resetError.message);
      setPhase("sent");
      toast("ok", "Password reset instructions sent. Please check your email inbox.");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Couldn't send the reset email");
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

        {phase === "sent" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              Password reset instructions sent. Please check your email inbox at <span className="font-medium text-ink">{email}</span> for a link to set a new password.
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <h1 className="text-gradient text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">Enter your work email and we&apos;ll send you a link to set a new password.</p>

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

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
