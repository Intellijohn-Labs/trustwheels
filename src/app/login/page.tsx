"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { AlertTriangle, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, Pill, cn, inputClass } from "@/components/ui";
import { Dialog } from "@/components/panels/dialog";
import { signInWithPassword, hasActiveSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { requestGpsCheckIn, type GpsCheckin, type IneligibleReason } from "@/lib/attendance-gps";
import { LoginScene } from "./login-scene";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./login.module.css";

/**
 * Sign-in itself is never blocked by location, day or time - only whether a punch-in is actually
 * attempted is. Inside the Mon-Sat 9am-6pm attendance window, the location prompt is requested
 * before the dashboard opens ("denied" blocks entry with a retry, since attendance genuinely can't
 * be marked without it there); outside that window sign-in proceeds straight through and a short
 * notice explains why nothing was punched in. A successful check-in shows its details in a
 * confirmation dialog before the person is actually routed in.
 */
type Gate =
  | { phase: "form" }
  | { phase: "authenticating" }
  | { phase: "auth-error"; message: string }
  | { phase: "locating" }
  | { phase: "denied"; message: string }
  | { phase: "confirmed"; record: GpsCheckin }
  | { phase: "already-marked" }
  | { phase: "ineligible"; reason: IneligibleReason };

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [gate, setGate] = useState<Gate>({ phase: "form" });
  const [resetState, setResetState] = useState<{ sent: boolean; error?: string } | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
    // Already have a real session (e.g. came back to /login by mistake, or a bookmark) - no need
    // to sign in again.
    hasActiveSession().then((authed) => authed && router.replace("/dashboard"));
  }, [router]);

  const leaving = gate.phase === "confirmed" || gate.phase === "already-marked" || gate.phase === "ineligible";
  const busy = gate.phase === "authenticating" || gate.phase === "locating";

  async function attemptSignIn() {
    if (busy || leaving) return;
    setGate({ phase: "authenticating" });
    try {
      await signInWithPassword(email, password);
    } catch (err) {
      setGate({ phase: "auth-error", message: err instanceof Error ? err.message : "Sign-in failed" });
      return;
    }
    setGate({ phase: "locating" });
    const result = await requestGpsCheckIn();
    if (result.status === "error") setGate({ phase: "denied", message: result.message });
    else if (result.status === "already-done") setGate({ phase: "already-marked" });
    else if (result.status === "ineligible") setGate({ phase: "ineligible", reason: result.reason });
    else setGate({ phase: "confirmed", record: result.record });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    attemptSignIn();
  }

  function continueToDashboard() {
    router.push("/dashboard");
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setResetState({ sent: false, error: "Enter your email above first, then tap this again." });
      return;
    }
    try {
      if (!supabase) throw new Error("Password reset isn't available - this deployment isn't connected to Supabase yet.");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
      if (error) throw new Error(error.message);
      setResetState({ sent: true });
    } catch (err) {
      setResetState({ sent: false, error: err instanceof Error ? err.message : "Couldn't send the reset email" });
    }
  }

  return (
    <div className="relative grid min-h-dvh bg-page lg:grid-cols-[1.15fr_1fr]">
      <div aria-hidden className="aurora-bg" />
      <div className="relative z-[1]">
        <ThemeToggle onDark className="absolute top-5 right-5 z-10 sm:top-8 sm:right-8" />
        <LoginScene leaving={leaving} className="h-[42dvh] min-h-64 rounded-b-3xl lg:sticky lg:top-0 lg:h-dvh lg:rounded-none" />
        <div className="pointer-events-none absolute inset-x-0 top-0 p-5 text-white sm:p-8">
          <div style={rise(0)} className={styles.rise}>
            <div className="logo-light logo-card">
              <Logo motion="intro" className="logo-rolling h-12 w-auto sm:h-16" />
            </div>
          </div>
          <p style={rise(1)} className={cn(styles.rise, "mt-6 hidden max-w-sm text-3xl leading-tight font-semibold tracking-tight lg:block")}>
            Every vehicle, every branch, one place.
          </p>
          <p style={rise(2)} className={cn(styles.rise, "mt-2 hidden max-w-sm text-white/80 lg:block")}>
            Stock entry, verification and tracking for the Trust Wheels team.
          </p>
        </div>
      </div>

      <div className="relative flex items-start justify-center px-5 pt-8 pb-12 lg:items-center lg:py-12">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm">
          <div style={rise(1)} className={styles.rise}>
            <h1 className="text-gradient text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to manage stock across your branches.</p>
          </div>

          <div style={rise(2)} className={cn(styles.rise, "mt-7")}>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@trustwheels.in"
                className={cn(inputClass(), "pl-10")}
              />
            </div>
          </div>

          <div style={rise(3)} className={cn(styles.rise, "mt-4")}>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-brand hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            {resetState?.sent && <p className="mt-2 text-xs text-ok">Check your email for a password reset link.</p>}
            {resetState?.error && <p className="mt-2 text-xs text-danger">{resetState.error}</p>}
          </div>

          {gate.phase === "auth-error" && (
            <div style={rise(5)} className={cn(styles.rise, "mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger")}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{gate.message}</p>
            </div>
          )}

          {gate.phase === "denied" && (
            <div style={rise(5)} className={cn(styles.rise, "mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger")}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>Location access is required. Please turn on device GPS and allow browser location permission to continue.</p>
            </div>
          )}

          <div style={rise(5)} className={cn(styles.rise, "mt-6")}>
            <button
              type="submit"
              disabled={busy || leaving}
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-300 disabled:cursor-not-allowed",
                leaving ? "bg-ok" : gate.phase === "denied" || gate.phase === "auth-error" ? "bg-danger hover:brightness-110" : "bg-brand hover:brightness-110",
                busy && "opacity-90",
              )}
            >
              {(gate.phase === "form" || gate.phase === "auth-error") && "Sign in"}
              {gate.phase === "authenticating" && (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              )}
              {gate.phase === "locating" && (
                <>
                  <Loader2 className="size-4 animate-spin" /> Getting your location…
                </>
              )}
              {gate.phase === "denied" && (
                <>
                  <MapPin className="size-4" /> Turn on Location & Retry
                </>
              )}
              {leaving && (
                <>
                  <Check className="size-4" strokeWidth={3} /> Signed in
                </>
              )}
            </button>
          </div>

          <p style={rise(6)} className={cn(styles.rise, "mt-4 text-center text-sm text-muted")}>
            New here? <Link href="/signup" className="font-medium text-brand hover:underline">Set up your account</Link>
          </p>

        </form>
      </div>

      {gate.phase === "confirmed" && (
        <Dialog
          title="Attendance Marked Successfully!"
          onClose={continueToDashboard}
          footer={
            <Button size="lg" variant="success" className="w-full" onClick={continueToDashboard}>
              Continue to Dashboard
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
              <CheckCircle2 className="size-9" />
            </span>
            <dl className="w-full space-y-2.5 text-sm">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <dt className="text-muted">Punch-in time</dt>
                <dd className="font-semibold">{formatTime(gate.record.checkInTime)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
                <dt className="text-muted">Location</dt>
                <dd className="text-right font-semibold">{gate.record.placeName ?? "Unknown location"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Pill tone={gate.record.status === "late" ? "warn" : "ok"}>{gate.record.status === "late" ? "Late" : "On Time"}</Pill>
                </dd>
              </div>
            </dl>
          </div>
        </Dialog>
      )}

      {gate.phase === "already-marked" && (
        <Dialog
          title="Already checked in today"
          onClose={continueToDashboard}
          footer={
            <Button size="lg" variant="success" className="w-full" onClick={continueToDashboard}>
              Continue to Dashboard
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
              <CheckCircle2 className="size-9" />
            </span>
            <p className="text-sm text-muted">Your attendance for today is already on record - no need to check in again.</p>
          </div>
        </Dialog>
      )}

      {gate.phase === "ineligible" && (
        <Dialog
          title="Logged in successfully"
          onClose={continueToDashboard}
          footer={
            <Button size="lg" variant="success" className="w-full" onClick={continueToDashboard}>
              Continue to Dashboard
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
              <CheckCircle2 className="size-9" />
            </span>
            <p className="text-sm text-muted">
              {gate.reason === "sunday" ? "Attendance is not marked on Sundays." : "Attendance window is 9:00 AM to 6:00 PM."}
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
