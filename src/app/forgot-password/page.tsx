"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, cn, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Email verification failed");
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

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

        <form onSubmit={onSubmit} noValidate>
          <h1 className="text-gradient text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">Enter your registered work email to verify and choose a new password.</p>

          <div className="mt-6">
            <label htmlFor="email" className="text-sm font-medium">Work email</label>
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
                <Loader2 className="size-4 animate-spin" /> Verifying…
              </>
            ) : (
              "Continue to set password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
