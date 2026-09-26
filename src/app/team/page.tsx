"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MapPin, Pencil, UserCog } from "lucide-react";
import { BRANCHES, branchName } from "@/lib/masters";
import { ROLES, ROLE_ORDER, type Role } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { employees, renameRoleHolder } from "@/lib/hr";
import { useAction } from "@/components/toast";
import { initials } from "@/components/role-switcher";
import { Button, PageHeader, cn, inputClass } from "@/components/ui";

/** One place to see and change who holds each role in the system. */
export default function TeamPage() {
  const { nameOf, role: myRole } = useRole();
  const { items: staff } = employees.useItems();

  return (
    <div className="space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Team & roles"
        icon={<UserCog className="size-6 text-brand" />}
        description="Change the name shown for each role. The new name appears everywhere: sign-in, greetings, pick-lists and every new action. Past records keep the old name."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {ROLE_ORDER.map((role) => (
          <RoleCard
            key={role}
            role={role}
            name={nameOf(role)}
            isMe={role === myRole}
            holder={staff.find((e) => e.rbacRole === role && e.status !== "exited")}
          />
        ))}
      </ul>
    </div>
  );
}

function RoleCard({ role, name, isMe, holder }: { role: Role; name: string; isMe: boolean; holder?: { phone: string; branchId: string } }) {
  const def = ROLES[role];
  // null = not editing; otherwise the draft being typed.
  const [draft, setDraft] = useState<string | null>(null);
  const { run, busy } = useAction();
  const editing = draft !== null;
  const changed = editing && draft.trim() !== name;
  const scope = def.scope === "all" ? "All branches" : def.scope.map((b) => BRANCHES.find((x) => x.id === b)?.name ?? b).join(", ");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!changed) return setDraft(null);
    const ok = await run(() => renameRoleHolder(role, draft!), `${def.label} is now ${draft!.trim()}`);
    if (ok) setDraft(null);
  }

  return (
    <li className="lift kpi-card rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="bg-brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-surface shadow-sm">{initials(editing && draft ? draft : name)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {def.label}
            {isMe && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">You</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">{def.description}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-faint">
            <MapPin className="size-3" /> {scope}
            {holder && <> · based at {branchName(holder.branchId)}</>}
          </p>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-3 flex gap-2">
          <label htmlFor={`name-${role}`} className="sr-only">
            Name for {def.label}
          </label>
          <input
            id={`name-${role}`}
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
            className={cn(inputClass(), "h-10 flex-1")}
            placeholder="Full name"
          />
          <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
            <Check className="size-4" /> Save
          </Button>
          <Button onClick={() => setDraft(null)} variant="ghost">
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sunken/70 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {holder?.phone && <p className="text-xs text-muted">+91 {holder.phone}</p>}
          </div>
          <Button size="sm" onClick={() => setDraft(name)} aria-label={`Edit ${def.label} name`}>
            <Pencil className="size-3.5" /> Edit name
          </Button>
        </div>
      )}
    </li>
  );
}
