"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useNow } from "@/lib/use-now";
import { VehicleRow } from "@/components/vehicle-row";
import { VerifyCheckbox } from "@/components/verify-checkbox";
import { deleteVehicle, deleteVehicles, useVehicles } from "@/lib/stock-store";
import { BRANCHES } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { displayReg, normaliseReg } from "@/lib/format";
import { Button, Segmented, cn, inputClass } from "@/components/ui";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "@/components/selection";
import { ConfirmDeleteDialog } from "@/components/panels/confirm-delete-dialog";
import type { Vehicle } from "@/lib/types";

const STAGE_GROUPS = [
  { id: "all", label: "All", test: () => true },
  { id: "branch", label: "At branch", test: (s: number) => s <= 4 },
  { id: "transit", label: "In transit", test: (s: number) => s === 5 || s === 6 },
  { id: "recon", label: "At Angamaly", test: (s: number) => s >= 7 && s <= 9 },
  { id: "display", label: "On display", test: (s: number) => s === 10 },
  { id: "sold", label: "Sold", test: (s: number) => s >= 11 },
] as const;

const byModel = (a: Vehicle, b: Vehicle) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);

const SORTS = [
  { id: "newest", label: "Newest", compare: (a: Vehicle, b: Vehicle) => b.createdAt.localeCompare(a.createdAt) },
  { id: "oldest", label: "Oldest", compare: (a: Vehicle, b: Vehicle) => a.createdAt.localeCompare(b.createdAt) },
  { id: "model-az", label: "Model A–Z", compare: byModel },
  { id: "model-za", label: "Model Z–A", compare: (a: Vehicle, b: Vehicle) => byModel(b, a) },
  { id: "year-new", label: "Year: newest", compare: (a: Vehicle, b: Vehicle) => b.year - a.year },
  { id: "year-old", label: "Year: oldest", compare: (a: Vehicle, b: Vehicle) => a.year - b.year },
  { id: "price-high", label: "Price: high", compare: (a: Vehicle, b: Vehicle) => b.agreedValuePaise - a.agreedValuePaise },
  { id: "price-low", label: "Price: low", compare: (a: Vehicle, b: Vehicle) => a.agreedValuePaise - b.agreedValuePaise },
  { id: "km-low", label: "Km: lowest", compare: (a: Vehicle, b: Vehicle) => a.odometerKm - b.odometerKm },
  { id: "km-high", label: "Km: highest", compare: (a: Vehicle, b: Vehicle) => b.odometerKm - a.odometerKm },
  { id: "stage", label: "Stage", compare: (a: Vehicle, b: Vehicle) => a.stage - b.stage },
  { id: "unverified", label: "Unverified first", compare: (a: Vehicle, b: Vehicle) => Number(!!a.verified) - Number(!!b.verified) },
] as const;

type SortId = (typeof SORTS)[number]["id"];
type GroupId = (typeof STAGE_GROUPS)[number]["id"];
type VerifyFilter = "all" | "pending" | "verified";

export default function StockPage() {
  // Stock is visible company-wide by default: everyone who can open this page sees all
  // branches' vehicles until they narrow it down with the branch filter below.
  const { vehicles, ready } = useVehicles();
  const now = useNow();
  const { can } = useRole();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupId>("all");
  const [branch, setBranch] = useState("all");
  const [verify, setVerify] = useState<VerifyFilter>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const verifiedCount = vehicles.filter((v) => v.verified).length;
  const canDelete = can("stock.delete");
  const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

  const counts = useMemo(
    () => Object.fromEntries(STAGE_GROUPS.map((g) => [g.id, vehicles.filter((v) => g.test(v.stage)).length])),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qReg = normaliseReg(query);
    const test = STAGE_GROUPS.find((g) => g.id === group)!.test;
    const compare = SORTS.find((s) => s.id === sort)!.compare;
    return vehicles.filter(
      (v) =>
        test(v.stage) &&
        (branch === "all" || v.branchId === branch) &&
        (verify === "all" || (verify === "verified") === !!v.verified) &&
        (!q ||
          (qReg && v.registrationNo.includes(qReg)) ||
          `${v.make} ${v.model} ${v.provisionalId} ${v.stockId ?? ""}`.toLowerCase().includes(q)),
    ).sort((a, b) => compare(a, b) || b.createdAt.localeCompare(a.createdAt));
  }, [vehicles, query, group, branch, verify, sort]);

  const selection = useSelection(filtered, (v) => v.id);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; labels: string[] } | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted">{ready ? `${vehicles.length} vehicles · ${verifiedCount} verified` : "Loading…"}</p>
        </div>
        {can("stock.create") && (
        <Link
          href="/stock/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-surface shadow-sm transition hover:brightness-110"
        >
          <Plus className="size-4" /> Add stock
        </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reg. no., model or ID"
            className={cn(inputClass(), "pl-10")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <div className="relative md:w-48">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className={cn(inputClass(), "pl-10")} aria-label="Branch">
              <option value="all">All branches</option>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative md:w-48">
            <ArrowUpDown className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className={cn(inputClass(), "pl-10")} aria-label="Sort by">
              {SORTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {STAGE_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
              group === g.id ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-sunken",
            )}
          >
            {g.label}
            <span className={cn("text-xs tabular-nums", group === g.id ? "text-white/80" : "text-muted")}>{counts[g.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sm:max-w-sm">
        <Segmented
          name="Verification"
          value={verify}
          onChange={setVerify}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: `Not verified ${vehicles.length - verifiedCount}` },
            { value: "verified", label: `Verified ${verifiedCount}` },
          ]}
        />
      </div>

      {canDelete && selection.count > 0 && (
        <SelectionToolbar
          count={selection.count}
          noun="vehicle"
          onClear={selection.clear}
          onDelete={() =>
            setConfirmDelete({
              ids: [...selection.selected],
              labels: vehicles.filter((v) => selection.selected.has(v.id)).map(label),
            })
          }
        />
      )}

      {ready && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-medium">No vehicles match</p>
          <p className="mt-1 text-sm text-muted">Try a different search or filter, or add a new vehicle.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {canDelete && (
            <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
              <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown vehicles" />
              Select all ({filtered.length} shown)
            </label>
          )}
          <ul className="divide-y divide-line">
            {filtered.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                now={now}
                leading={
                  <>
                    {canDelete && <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${label(v)}`} />}
                    <VerifyCheckbox vehicle={v} />
                  </>
                }
                actions={
                  canDelete ? (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ ids: [v.id], labels: [label(v)] })} aria-label={`Delete ${label(v)}`}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </ul>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          count={confirmDelete.ids.length}
          items={confirmDelete.labels}
          noun="vehicle"
          onConfirm={() => (confirmDelete.ids.length === 1 ? deleteVehicle(confirmDelete.ids[0]) : deleteVehicles(confirmDelete.ids))}
          onClose={() => {
            setConfirmDelete(null);
            selection.clear();
          }}
        />
      )}
    </div>
  );
}
