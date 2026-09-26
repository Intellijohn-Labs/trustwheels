"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn, inputClass } from "@/components/ui";
import { ROLES, ROLE_ORDER, type Role } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { LoginScene } from "./login-scene";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./login.module.css";

type Status = "idle" | "loading" | "success";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [resetNote, setResetNote] = useState(false);
  
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const { role: currentRole, setRole, nameOf } = useRole();
  const [picked, setPicked] = useState<Role>();
  const signInAs = picked ?? currentRole;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status !== "idle") return;

    setStatus("loading");
    setRole(signInAs);

    setTimeout(() => {
      setStatus("success");
      router.push("/dashboard");
    }, 400);
  }

  return (
    <div className="relative grid min-h-dvh bg-page lg:grid-cols-[1.15fr_1fr]">
      <div aria-hidden className="aurora-bg" />
      <div className="relative z-[1]">
        <ThemeToggle onDark className="absolute top-5 right-5 z-10 sm:top-8 sm:right-8" />
        <LoginScene leaving={status === "success"} className="h-[42dvh] min-h-64 rounded-b-3xl lg:sticky lg:top-0 lg:h-dvh lg:rounded-none" />
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
        <form
          onSubmit={onSubmit}
          noValidate
          className="w-full max-w-sm"
        >
          <div style={rise(1)} className={styles.rise}>
            <h1 className="text-gradient text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to manage stock across your branches.</p>
          </div>

          <div style={rise(2)} className={cn(styles.rise, "mt-7")}>
            <label htmlFor="role" className="text-sm font-medium">
              Sign in as <span className="font-normal text-muted">(demo)</span>
            </label>
            <select
              id="role"
              value={signInAs}
              onChange={(e) => {
                const r = e.target.value as Role;
                setPicked(r);
                if (!email) setEmail(`${nameOf(r).split(" ")[0].toLowerCase()}@trustwheels.in`);
              }}
              className={cn(inputClass(), "mt-1.5")}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label} · {nameOf(r)}
                </option>
              ))}
            </select>
          </div>

          <div style={rise(2)} className={cn(styles.rise, "mt-4")}>
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
              <button type="button" onClick={() => setResetNote(true)} className="text-sm font-medium text-brand hover:underline">
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
                className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {resetNote && <p className="mt-2 text-xs text-muted">Password reset will email you a link once the backend is connected.</p>}
          </div>

          <div style={rise(4)} className={cn(styles.rise, "mt-4")}>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              Keep me signed in on this device
            </label>
          </div>

          <div style={rise(5)} className={cn(styles.rise, "mt-6")}>
            <button
              type="submit"
              disabled={status !== "idle"}
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-300",
                status === "success" ? "bg-ok" : "bg-brand hover:brightness-110",
                status === "loading" && "opacity-90",
              )}
            >
              {status === "idle" && "Sign in"}
              {status === "loading" && (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              )}
              {status === "success" && (
                <>
                  <Check className="size-4" strokeWidth={3} /> Signed in
                </>
              )}
            </button>
          </div>

          <p style={rise(6)} className={cn(styles.rise, "mt-6 text-center text-xs text-faint")}>
            Demo: any email and password will work.{" "}
            <Link href="/dashboard" className="underline hover:text-muted">
              Skip to dashboard
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
