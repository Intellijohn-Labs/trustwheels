"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, Suspense } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, cn, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { signOutAuth } from "@/lib/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const toast = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Please enter your registered work email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password.");

      toast("ok", "Password updated successfully!");
      await signOutAuth();
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center bg-page px-5 py-10">
      <div aria-hidden className="aurora-bg" />
      <ThemeToggle className="absolute top-5 right-5 z-10 sm:top-8 sm:right-8" />
      <div className="relative z-[1] w-full max-w-sm">
        <div className="mb-7">
          <Logo className="h-12 w-auto" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <h1 className="text-gradient text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-1 text-sm text-muted">Choose a new password for your account.</p>

          <div className="mt-6">
            <label htmlFor="email" className="text-sm font-medium">Work email</label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@trustwheels.in"
                className={cn(inputClass(), "pl-10")}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="text-sm font-medium">New password</label>
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
            <label htmlFor="confirm" className="text-sm font-medium">Confirm new password</label>
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

          <div className="mt-5 text-center">
            <Link href="/login" className="text-sm text-muted hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-page"><Loader2 className="size-6 animate-spin text-muted" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
