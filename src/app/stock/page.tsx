"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle2, Plus, Search, SlidersHorizontal, TriangleAlert, Trash2, Wrench } from "lucide-react";
import { useNow } from "@/lib/use-now";
import { inRecon, inTransit } from "@/lib/workflow";
import { VehicleRow } from "@/components/vehicle-row";
import { deleteVehicle, deleteVehicles, useVehicles } from "@/lib/stock-store";
import { BRANCHES } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { displayReg, normaliseReg } from "@/lib/format";
import { Button, cn, inputClass } from "@/components/ui";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "@/components/selection";
import { ConfirmDeleteDialog } from "@/components/panels/confirm-delete-dialog";
import { MarkReadyForSaleDialog, RejectStockDialog, SendToReconDialog } from "@/components/panels/sale-readiness-dialog";
import type { Vehicle } from "@/lib/types";

// "Sold" isn't a bucket here - it's excluded from every one of these panels below and gets its
// own top-level panel instead, so it's never reachable via the stage sub-filter bar either.
const STAGE_GROUPS = [
  { id: "all", label: "All", test: () => true },
  { id: "branch", label: "At branch", test: (v: Vehicle) => v.stage <= 4 },
  { id: "transit", label: "In transit", test: inTransit },
  { id: "recon", label: "At Angamaly", test: (v: Vehicle) => v.stage >= 7 && v.stage <= 9 },
  { id: "display", label: "On display", test: (v: Vehicle) => v.stage === 10 },
] as const;

/**
 * Top-level panels, separate from the stage filter bar above. "All Stocks", "Ready for Sale" and
 * "Rejected Stock" all exclude:
 * - a booked/sold vehicle - it belongs strictly to the "Sold" panel from here on, not still
 *   offered up for a readiness decision it's already past, and
 * - anything actively in reconditioning (stage 8, not yet signed off and reverted) - those stay
 *   visible only on the dedicated /recon page until completeRecon() returns them to general
 *   stock. sendToReconditioning() already clears saleReadiness when it fires, but the panel
 *   tests guard against it independently too (setSaleReadiness() also refuses to touch an
 *   in-recon vehicle) so a stale rejected/ready tag can never leak into the recon workshop's view.
 * "All Stocks" additionally excludes unverified vehicles (a new intake starts unverified - it
 * stays on the Verification page until setVerified() there promotes it).
 */
const PANELS = [
  { id: "all", label: "All Stocks", test: (v: Vehicle) => !v.sale && !!v.verified && !inRecon(v) },
  { id: "ready", label: "Ready for Sale", test: (v: Vehicle) => !v.sale && !inRecon(v) && v.saleReadiness?.status === "ready_for_sale" },
  { id: "rejected", label: "Rejected Stock", test: (v: Vehicle) => !v.sale && !inRecon(v) && v.saleReadiness?.status === "rejected_stock" },
  { id: "sold", label: "Sold", test: (v: Vehicle) => !!v.sale },
] as const;
type PanelId = (typeof PANELS)[number]["id"];

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

/**
 * Quick-action pair for the manual sales-readiness tag; each row owns its own dialog state.
 * "Ready for Sale" always stays visible (it's the recovery action once a vehicle is rejected), but
 * "Not Ready for Sale" hides once a vehicle is already rejected - re-rejecting an already-rejected
 * vehicle is a no-op, so the row's next-step actions (Ready for Sale, Send to Reconditioning,
 * Delete) stay uncluttered instead of offering a button with nothing new to do. Both open a
 * confirm dialog rather than firing immediately, since either one changes whether the vehicle can
 * be booked or sold.
 */
function SaleReadinessActions({ vehicle: v }: { vehicle: Vehicle }) {
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const isReady = v.saleReadiness?.status === "ready_for_sale";
  const isRejected = v.saleReadiness?.status === "rejected_stock";
  return (
    <>
      <Button
        size="sm"
        variant="success"
        onClick={() => setConfirming(true)}
        className={isReady ? "ring-2 ring-ok ring-offset-1 ring-offset-surface" : undefined}
      >
        <CheckCircle2 className="size-3.5" /> {isReady ? "Ready for Sale ✓" : "Ready for Sale"}
      </Button>
      {!isRejected && (
        <Button size="sm" variant="warn" onClick={() => setRejecting(true)}>
          <TriangleAlert className="size-3.5" /> Not Ready for Sale
        </Button>
      )}
      {confirming && <MarkReadyForSaleDialog vehicle={v} onClose={() => setConfirming(false)} />}
      {rejecting && <RejectStockDialog vehicle={v} onClose={() => setRejecting(false)} />}
    </>
  );
}

/** "Send to Reconditioning" quick action, shown only on the Rejected Stock tab. */
function SendToReconButton({ vehicle: v }: { vehicle: Vehicle }) {
  const [sending, setSending] = useState(false);
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setSending(true)}>
        <Wrench className="size-3.5" /> Send to Reconditioning
      </Button>
      {sending && <SendToReconDialog vehicle={v} onClose={() => setSending(false)} />}
    </>
  );
}

export default function StockPage() {
  // Stock is visible company-wide by default: everyone who can open this page sees all
  // branches' vehicles until they narrow it down with the branch filter below.
  const { vehicles, ready } = useVehicles();
  const now = useNow();
  const { can } = useRole();
  const [panel, setPanel] = useState<PanelId>("all");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupId>("all");
  const [branch, setBranch] = useState("all");
  const [sort, setSort] = useState<SortId>("newest");
  const verifiedCount = vehicles.filter((v) => v.verified).length;
  const canDelete = can("stock.delete");
  const canManage = can("stock.verify");
  const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

  const counts = useMemo(
    // Excludes sold/booked, unverified and actively-in-recon vehicles too, so a bucket's count
    // always matches what clicking it actually shows inside the "All Stocks" panel these buttons live in.
    () => Object.fromEntries(STAGE_GROUPS.map((g) => [g.id, vehicles.filter((v) => !v.sale && !!v.verified && !inRecon(v) && g.test(v)).length])),
    [vehicles],
  );
  const panelCounts = useMemo(
    () => Object.fromEntries(PANELS.map((p) => [p.id, vehicles.filter((v) => p.test(v)).length])) as Record<PanelId, number>,
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qReg = normaliseReg(query);
    const panelTest = PANELS.find((p) => p.id === panel)!.test;
    // The stage sub-filter only applies to the "All Stocks" panel - Ready/Rejected are already a fixed slice.
    const stageTest = panel === "all" ? STAGE_GROUPS.find((g) => g.id === group)!.test : () => true;
    const compare = SORTS.find((s) => s.id === sort)!.compare;
    return vehicles.filter(
      (v) =>
        panelTest(v) &&
        stageTest(v) &&
        (branch === "all" || v.branchId === branch) &&
        (!q ||
          (qReg && v.registrationNo.includes(qReg)) ||
          `${v.make} ${v.model} ${v.provisionalId} ${v.stockId ?? ""}`.toLowerCase().includes(q)),
    ).sort((a, b) => compare(a, b) || b.createdAt.localeCompare(a.createdAt));
  }, [vehicles, query, panel, group, branch, sort]);

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

      <div className="flex gap-5 border-b border-line">
        {PANELS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            className={cn(
              "btn-tap -mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition",
              panel === p.id ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {p.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs tabular-nums",
                panel === p.id ? "bg-brand text-white" : "bg-sunken text-muted",
              )}
            >
              {panelCounts[p.id] ?? 0}
            </span>
          </button>
        ))}
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

      {panel === "all" && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {STAGE_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              className={cn(
                "btn-tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
                group === g.id ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-sunken",
              )}
            >
              {g.label}
              <span className={cn("text-xs tabular-nums", group === g.id ? "text-white/80" : "text-muted")}>{counts[g.id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

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
                leading={canDelete && <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${label(v)}`} />}
                note={
                  panel === "rejected" && v.saleReadiness?.reason ? (
                    <span className="text-danger">Reason: {v.saleReadiness.reason}</span>
                  ) : undefined
                }
                actions={
                  // A sold vehicle's readiness decision is already made and past - "rejected"
                  // panel rows always have !v.sale anyway (that panel's own test excludes it),
                  // so this still covers the Send-to-Reconditioning action without a separate check.
                  (canManage && !v.sale) || canDelete ? (
                    <>
                      {canManage && !v.sale && <SaleReadinessActions vehicle={v} />}
                      {canManage && panel === "rejected" && <SendToReconButton vehicle={v} />}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ ids: [v.id], labels: [label(v)] })} aria-label={`Delete ${label(v)}`}>
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      )}
                    </>
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
          onConfirm={async () => {
            if (confirmDelete.ids.length === 1) await deleteVehicle(confirmDelete.ids[0]);
            else await deleteVehicles(confirmDelete.ids);
            selection.clear();
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
