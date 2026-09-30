"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, Siren } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { EmptyState, KpiCard, KpiGrid, PageHeader, Panel, Segmented, cn } from "@/components/ui";
import { VehicleCell } from "@/components/panels/vehicle-cell";
import { DocsSignOff, HandoverControl, ReleaseControl, SaleAgePill } from "@/components/panels/delivery-gate";
import { TransferChecklist } from "@/components/panels/transfer-checklist";
import { awaitingDelivery, byUrgency } from "@/components/panels/release-queue";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/selection";
import { formatDateTime, formatPaise } from "@/lib/format";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { SLA } from "@/lib/masters";
import { isCodeRed, releaseBlockers } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";

type Tab = "pending" | "delivered";
const RECENT_DAYS = 30;

export default function DeliveriesPage() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow(60_000);
  const [tab, setTab] = useState<Tab>("pending");
  const canDelete = can("stock.delete");

  const pending = vehicles.filter(awaitingDelivery).sort(byUrgency(now));
  const delivered = vehicles
    .filter((v) => v.delivery?.delivered && now - new Date(v.delivery.delivered.at).getTime() < RECENT_DAYS * 86_400_000)
    .sort((a, b) => b.delivery!.delivered!.at.localeCompare(a.delivery!.delivered!.at));
  const codeRed = pending.filter((v) => isCodeRed(v, now)).length;

  const pendingSelection = useSelection(pending, (v: Vehicle) => v.id);
  const deliveredSelection = useSelection(delivered, (v: Vehicle) => v.id);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<KeyRound className="size-6 text-brand" />}
        title="Deliveries"
        description={`Booking documents, ownership transfer, the manager's final release, then handover. Deliver within ${SLA.codeRedDays} days of the sale.`}
      />

      <KpiGrid>
        <KpiCard label="Awaiting delivery" value={pending.length} hint="Booked or sold" />
        <KpiCard
          label="Code Red"
          value={codeRed}
          tone={codeRed ? "danger" : "neutral"}
          icon={<Siren />}
          hint={codeRed ? `Over ${SLA.codeRedDays} days since sale` : "None over the limit"}
        />
        <KpiCard label="Ready to release" value={pending.filter((v) => !v.delivery?.released && releaseBlockers(v).length === 0).length} hint="Transfer complete, docs signed" />
        <KpiCard label="Released, not handed over" value={pending.filter((v) => v.delivery?.released).length} hint="Sales to record handover" />
      </KpiGrid>

      <div className="sm:max-w-md">
        <Segmented
          name="Delivery status"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pending", label: `Awaiting ${pending.length}` },
            { value: "delivered", label: `Delivered (${RECENT_DAYS}d) ${delivered.length}` },
          ]}
        />
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <Panel>
            <EmptyState>{ready ? "Every sold vehicle has been delivered." : "Loading…"}</EmptyState>
          </Panel>
        ) : (
          <div className="space-y-4">
            {canDelete && <BulkDeleteBar vehicles={pending} selected={pendingSelection.selected} onClear={pendingSelection.clear} />}
            {canDelete && (
              <label className="flex items-center gap-2.5 rounded-2xl border border-line bg-sunken/60 px-4 py-2.5 text-sm text-muted">
                <SelectAllCheckbox checked={pendingSelection.allVisibleSelected} indeterminate={pendingSelection.count > 0} onChange={pendingSelection.toggleAll} label="Select all shown vehicles" />
                Select all ({pending.length} shown)
              </label>
            )}
            {pending.map((v) => (
              <DeliveryCard
                key={v.id}
                vehicle={v}
                now={now}
                selected={canDelete && pendingSelection.isSelected(v.id)}
                onToggleSelect={canDelete ? () => pendingSelection.toggle(v.id) : undefined}
                showDelete={canDelete}
              />
            ))}
          </div>
        )
      ) : (
        <DeliveredTable rows={delivered} ready={ready} canDelete={canDelete} selection={deliveredSelection} />
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        <span className="grid size-5 place-items-center rounded-full bg-sunken text-[11px] text-ink">{n}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DeliveryCard({
  vehicle: v,
  now,
  selected,
  onToggleSelect,
  showDelete,
}: {
  vehicle: Vehicle;
  now: number;
  selected?: boolean;
  onToggleSelect?: () => void;
  showDelete?: boolean;
}) {
  const red = isCodeRed(v, now);
  const sale = v.sale!;
  return (
    <section
      aria-label={`${v.make} ${v.model} delivery`}
      data-vehicle-id={v.id}
      className={cn("overflow-hidden rounded-2xl border bg-surface", red ? "border-danger/50 shadow-[inset_4px_0_0_var(--danger)]" : "border-line")}
    >
      <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5", red && "bg-danger-soft/60")}>
        <div className="flex items-center gap-2">
          {onToggleSelect && <RowCheckbox checked={!!selected} onChange={onToggleSelect} label={`Select ${v.make} ${v.model}`} />}
          <VehicleCell vehicle={v} />
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-2">
            <SaleAgePill vehicle={v} now={now} />
            {showDelete && <DeleteVehicleButton vehicle={v} />}
          </div>
          <p className="text-xs text-muted">
            <span className="font-medium text-ink">{sale.customer.name}</span> ·{" "}
            <a href={`tel:+91${sale.customer.phone}`} className="text-brand tabular-nums">
              {sale.customer.phone}
            </a>
            {sale.salePricePaise != null && <> · {formatPaise(sale.salePricePaise)}</>}
            {sale.soldAt ? <> · sold {formatDateTime(sale.soldAt)}</> : sale.bookedAt && <> · booked {formatDateTime(sale.bookedAt)}</>}
          </p>
        </div>
      </header>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Step n={1} title="Booking documents">
            <DocsSignOff vehicle={v} />
          </Step>
          <Step n={2} title="Ownership transfer">
            <TransferChecklist vehicle={v} />
          </Step>
        </div>
        <div className="space-y-5">
          <Step n={3} title="Final release (Angamaly manager)">
            <ReleaseControl vehicle={v} />
          </Step>
          <Step n={4} title="Handover (sales)">
            <HandoverControl vehicle={v} />
          </Step>
        </div>
      </div>
    </section>
  );
}

function DeliveredTable({
  rows,
  ready,
  canDelete,
  selection,
}: {
  rows: Vehicle[];
  ready: boolean;
  canDelete: boolean;
  selection: ReturnType<typeof useSelection<Vehicle>>;
}) {
  const columns: Column<Vehicle>[] = [
    ...(canDelete
      ? [
          {
            header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown vehicles" />,
            cell: (v: Vehicle) => <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${v.make} ${v.model}`} />,
          },
        ]
      : []),
    { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
    { header: "Customer", cell: (v) => v.sale?.customer.name },
    { header: "Sold", cell: (v) => <span className="whitespace-nowrap">{v.sale?.soldAt ? formatDateTime(v.sale.soldAt) : "—"}</span> },
    {
      header: "Released",
      cell: (v) => (
        <span className="whitespace-nowrap">
          {v.delivery?.released ? formatDateTime(v.delivery.released.at) : "—"}
          <span className="block text-xs text-muted">{v.delivery?.released?.by}</span>
        </span>
      ),
    },
    {
      header: "Delivered",
      cell: (v) => (
        <span className="whitespace-nowrap">
          {formatDateTime(v.delivery!.delivered!.at)}
          <span className="block text-xs text-muted">{v.delivery!.delivered!.by}</span>
        </span>
      ),
    },
    ...(canDelete ? [{ header: "", align: "right" as const, cell: (v: Vehicle) => <DeleteVehicleButton vehicle={v} /> }] : []),
  ];
  return (
    <div className="space-y-3">
      {canDelete && <BulkDeleteBar vehicles={rows} selected={selection.selected} onClear={selection.clear} />}
      <Panel flush title="Recently delivered">
        <DataTable columns={columns} rows={rows} rowKey={(v) => v.id} empty={ready ? "Nothing delivered recently." : "Loading…"} />
      </Panel>
    </div>
  );
}
