"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { displayReg } from "@/lib/format";
import { Segmented } from "@/components/ui";
import { VehicleRow } from "@/components/vehicle-row";
import { SaleActions } from "@/components/sale-actions";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/selection";
import { DocumentsButton, PhotosEditButton, PriceEditButton } from "@/components/vehicle/quick-actions";
import type { Vehicle } from "@/lib/types";

type Tab = "available" | "booked" | "sold";

const TABS: { id: Tab; label: string; test: (v: Vehicle) => boolean; empty: string }[] = [
  {
    id: "available",
    label: "Available",
    // A bike must be explicitly marked Ready for Sale (Stock page) to be offered for a new sale -
    // this is how procurement/workshop/in-transit bikes stay excluded here.
    test: (v) => !v.sale && v.saleReadiness?.status === "ready_for_sale",
    empty: "No vehicles are marked Ready for Sale yet. Mark one from the Stock page.",
  },
  { id: "booked", label: "Booked", test: (v) => v.sale?.status === "booked", empty: "No bookings right now." },
  { id: "sold", label: "Sold", test: (v) => v.sale?.status === "sold", empty: "Nothing sold yet." },
];

const latest = (v: Vehicle) => v.sale?.soldAt ?? v.sale?.bookedAt ?? v.saleReadiness?.at ?? v.createdAt;
const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

export default function VerifiedPage() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow(60_000);
  const [tab, setTab] = useState<Tab>("available");

  const current = TABS.find((t) => t.id === tab)!;
  const rows = vehicles.filter(current.test).sort((a, b) => latest(b).localeCompare(latest(a)));
  // Bulk select/delete is Sold-only and Managing Partner-only (stock.delete); the other tabs keep
  // their existing per-row actions with no checkboxes.
  const selection = useSelection(rows, (v) => v.id);
  const bulkSelect = tab === "sold" && can("stock.delete");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BadgeCheck className="size-6 text-ok" /> Book &amp; sell
        </h1>
        <p className="text-sm text-muted">Only vehicles marked Ready for Sale can be newly booked or sold.</p>
      </div>

      <div className="sm:max-w-md">
        <Segmented
          name="Sale status"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.id, label: `${t.label} ${vehicles.filter(t.test).length}` }))}
        />
      </div>

      {bulkSelect && <BulkDeleteBar vehicles={rows} selected={selection.selected} onClear={selection.clear} />}

      {ready && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-muted">{current.empty}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {bulkSelect && (
            <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
              <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown vehicles" />
              Select all ({rows.length} shown)
            </label>
          )}
          <ul className="divide-y divide-line">
            {rows.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                now={now}
                leading={bulkSelect && <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${label(v)}`} />}
                actions={
                  <>
                    {tab !== "sold" && <SaleActions vehicle={v} />}
                    <PriceEditButton vehicle={v} />
                    <PhotosEditButton vehicle={v} />
                    <DocumentsButton vehicle={v} />
                    <DeleteVehicleButton vehicle={v} />
                  </>
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
