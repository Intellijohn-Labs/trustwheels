"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Check, Pencil, RotateCcw, Users, Warehouse } from "lucide-react";
import { BRANCHES } from "@/lib/masters";
import { ROLES, ROLE_ORDER } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { useVehicles } from "@/lib/stock-store";
import { employees } from "@/lib/hr";
import { renameBranch } from "@/lib/branch-actions";
import { useAction } from "@/components/toast";
import { Button, PageHeader, Pill, cn, inputClass } from "@/components/ui";

/** Rename branches. Ids never change, so vehicles, ledger and staff stay linked. */
export default function BranchesPage() {
  useRole(); // re-render when a branch is renamed
  const { vehicles } = useVehicles();
  const { items: staff } = employees.useItems();

  return (
    <div className="space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Branches"
        icon={<Building2 className="size-6 text-brand" />}
        description="Change a branch's name. The new name shows everywhere at once: menus, filters, vehicles, reports, ledger and HR. Records stay linked to the branch."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {BRANCHES.map((b) => (
          <BranchCard
            key={b.id}
            id={b.id}
            name={b.name}
            defaultName={b.defaultName}
            vehicles={vehicles.filter((v) => v.branchId === b.id).length}
            people={staff.filter((e) => e.branchId === b.id && e.status !== "exited").length}
            scopedRoles={ROLE_ORDER.filter((r) => ROLES[r].scope !== "all" && ROLES[r].scope.includes(b.id)).map((r) => ROLES[r].label)}
          />
        ))}
      </ul>
    </div>
  );
}

function BranchCard({
  id,
  name,
  defaultName,
  vehicles,
  people,
  scopedRoles,
}: {
  id: string;
  name: string;
  defaultName: string;
  vehicles: number;
  people: number;
  scopedRoles: string[];
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const { run, busy } = useAction();
  const hub = id === "ang";
  const renamed = name !== defaultName;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (draft === null || draft.trim() === name) return setDraft(null);
    const ok = await run(() => renameBranch(id, draft), `Branch renamed to ${draft.trim()}`);
    if (ok) setDraft(null);
  }

  return (
    <li className="lift kpi-card rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="bg-brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-surface shadow-sm">
          {hub ? <Warehouse className="size-5" /> : <Building2 className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {hub ? "Central hub" : "Branch"}
            <span className="font-mono text-xs font-normal text-faint">{id.toUpperCase()}</span>
            {renamed && <Pill tone="brand">Renamed</Pill>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>{vehicles} vehicles</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {people} staff
            </span>
          </p>
          {scopedRoles.length > 0 && <p className="mt-1 text-xs text-faint">Limited-scope access: {scopedRoles.join(", ")}</p>}
        </div>
      </div>

      {draft !== null ? (
        <form onSubmit={save} className="mt-3 flex gap-2">
          <label htmlFor={`branch-${id}`} className="sr-only">
            Name for branch {id}
          </label>
          <input
            id={`branch-${id}`}
            autoFocus
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
            placeholder="Branch name"
            className={cn(inputClass(), "h-10 flex-1")}
          />
          <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
            <Check className="size-4" /> Save
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sunken/70 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {renamed && <p className="text-xs text-muted">Originally {defaultName}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {renamed && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => renameBranch(id, defaultName), `Restored to ${defaultName}`)} aria-label={`Restore ${defaultName}`}>
                <RotateCcw className="size-3.5" /> Restore
              </Button>
            )}
            <Button size="sm" onClick={() => setDraft(name)} aria-label={`Edit name of ${name}`}>
              <Pencil className="size-3.5" /> Edit name
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
