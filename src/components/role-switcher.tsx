"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, FlaskConical, Pencil } from "lucide-react";
import { ROLES, ROLE_ORDER } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { SignOutButton } from "./sign-out-button";
import { cn } from "./ui";

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Next.js inlines process.env.NODE_ENV at build time, so a production build (what Vercel deploys)
// compiles the role list below out of the bundle entirely - this isn't a runtime toggle that a
// visitor could flip back on, it genuinely doesn't ship. `pnpm dev` keeps the full switcher so
// every role's view can still be previewed locally without a real sign-in for each one.
const DEV_ROLE_SWITCHING = process.env.NODE_ENV === "development";

/**
 * Account menu in the top nav. In development, it's also the demo role switcher (every role's
 * view, previewable without a separate login). In production it's locked down to what it should
 * actually be: who's signed in, and a way to sign out - no picking a different role from here.
 */
export function RoleSwitcher() {
  const { role, user, roleDef, setRole, nameOf, can } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={DEV_ROLE_SWITCHING ? "listbox" : "menu"}
        aria-expanded={open}
        aria-label={DEV_ROLE_SWITCHING ? `Switch role (current: ${roleDef.label})` : `Account menu (${roleDef.label})`}
        className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-surface py-1.5 pr-2.5 pl-1.5 text-left transition hover:bg-sunken"
      >
        <span className="bg-brand-gradient grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-surface shadow-sm">{initials(user.name)}</span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted">{roleDef.label}</span>
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>

      {open && (
        <div className="anim-pop absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          {DEV_ROLE_SWITCHING ? (
            <>
              <p className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-xs font-medium text-muted">
                <FlaskConical className="size-3.5" /> Switch role (testing)
              </p>
              <ul role="listbox" aria-label="Roles" className="max-h-[70dvh] overflow-y-auto py-1">
                {ROLE_ORDER.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={r === role}
                      onClick={() => {
                        setRole(r);
                        setOpen(false);
                      }}
                      className={cn("flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-sunken", r === role && "bg-brand-soft/60")}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sunken text-[10px] font-bold text-muted">{initials(nameOf(r))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{ROLES[r].label}</span>
                        <span className="block truncate text-xs text-muted">
                          {nameOf(r)} · {ROLES[r].description}
                        </span>
                      </span>
                      {r === role && <Check className="mt-1 size-4 text-brand" />}
                    </button>
                  </li>
                ))}
              </ul>
              {can("settings.manage") && (
                <Link href="/team" onClick={() => setOpen(false)} className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs font-medium text-brand hover:bg-sunken">
                  <Pencil className="size-3.5" /> Edit names for each role
                </Link>
              )}
            </>
          ) : (
            <>
              <div className="px-4 py-3">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted">{roleDef.label}</p>
              </div>
              <div className="border-t border-line p-1.5">
                <SignOutButton
                  onNavigate={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
