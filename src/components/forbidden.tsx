"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { ROLES, rolesFor, type RouteDef } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";

/** 403 shown in place of a page the current role may not open. */
export function Forbidden({ route }: { route: RouteDef }) {
  const { roleDef } = useRole();
  const allowed = rolesFor(route);
  return (
    <div className="mx-auto max-w-lg py-10 text-center" data-testid="forbidden">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <ShieldX className="size-7" />
      </div>
      <p className="mt-4 font-mono text-sm font-semibold text-danger">403 · Forbidden</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">You don&apos;t have access to {route.label}</h1>
      <p className="mt-2 text-sm text-muted">
        Signed in as <span className="font-medium text-ink">{roleDef.label}</span>. This page is available to:{" "}
        {allowed.map((r) => ROLES[r].label).join(", ")}.
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-surface hover:brightness-110">
        Go to my dashboard
      </Link>
    </div>
  );
}
