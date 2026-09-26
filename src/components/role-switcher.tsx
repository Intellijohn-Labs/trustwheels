"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, FlaskConical, Pencil } from "lucide-react";
import { ROLES, ROLE_ORDER } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { cn } from "./ui";

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Development helper: switch the signed-in demo user between the 11 roles. */
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch role (current: ${roleDef.label})`}
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
        </div>
      )}
    </div>
  );
}
