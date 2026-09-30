"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { VERIFY_LIMIT_HOURS } from "@/lib/masters";
import { verifyDeadline, verifyState } from "@/lib/verification";
import { VehicleRow } from "@/components/vehicle-row";
import { VerifyButton } from "@/components/verify-button";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/selection";
import type { Vehicle } from "@/lib/types";

export default function OverduePage() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow();
  const canDelete = can("stock.delete");

  const byDeadline = [...vehicles].sort((a, b) => verifyDeadline(a) - verifyDeadline(b));
  const overdue = byDeadline.filter((v) => verifyState(v, now) === "overdue");
  const pending = byDeadline.filter((v) => verifyState(v, now) === "pending");

  const overdueSelection = useSelection(overdue, (v: Vehicle) => v.id);
  const pendingSelection = useSelection(pending, (v: Vehicle) => v.id);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-danger">
            <AlertTriangle className="size-6" /> Not verified in time
          </h1>
          <p className="text-sm text-muted">
            Added more than {VERIFY_LIMIT_HOURS} hours ago and still not verified. Verify a vehicle once it has been checked.
          </p>
        </div>
        {canDelete && <BulkDeleteBar vehicles={overdue} selected={overdueSelection.selected} onClear={overdueSelection.clear} />}
        {ready && overdue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            Nothing overdue. Every vehicle was verified within {VERIFY_LIMIT_HOURS} hours.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-danger/40 bg-surface">
            {canDelete && overdue.length > 0 && (
              <label className="flex items-center gap-2.5 border-b border-danger/20 bg-danger-soft/40 px-4 py-2 text-sm text-muted">
                <SelectAllCheckbox checked={overdueSelection.allVisibleSelected} indeterminate={overdueSelection.count > 0} onChange={overdueSelection.toggleAll} label="Select all overdue vehicles" />
                Select all ({overdue.length} shown)
              </label>
            )}
            <ul className="divide-y divide-danger/20">
              {overdue.map((v) => (
                <VehicleRow
                  key={v.id}
                  vehicle={v}
                  now={now}
                  leading={canDelete && <RowCheckbox checked={overdueSelection.isSelected(v.id)} onChange={() => overdueSelection.toggle(v.id)} label={`Select ${v.make} ${v.model}`} />}
                  actions={
                    <>
                      <VerifyButton vehicle={v} />
                      <DeleteVehicleButton vehicle={v} />
                    </>
                  }
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-5 text-brand" /> Awaiting verification
          </h2>
          <p className="text-sm text-muted">Timer running. These turn red if not verified before the countdown ends.</p>
        </div>
        {canDelete && <BulkDeleteBar vehicles={pending} selected={pendingSelection.selected} onClear={pendingSelection.clear} />}
        {ready && pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            No vehicles waiting. <Link href="/stock/new" className="text-brand underline">Add stock</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {canDelete && pending.length > 0 && (
              <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
                <SelectAllCheckbox checked={pendingSelection.allVisibleSelected} indeterminate={pendingSelection.count > 0} onChange={pendingSelection.toggleAll} label="Select all vehicles awaiting verification" />
                Select all ({pending.length} shown)
              </label>
            )}
            <ul className="divide-y divide-line">
              {pending.map((v) => (
                <VehicleRow
                  key={v.id}
                  vehicle={v}
                  now={now}
                  leading={canDelete && <RowCheckbox checked={pendingSelection.isSelected(v.id)} onChange={() => pendingSelection.toggle(v.id)} label={`Select ${v.make} ${v.model}`} />}
                  actions={
                    <>
                      <VerifyButton vehicle={v} />
                      <DeleteVehicleButton vehicle={v} />
                    </>
                  }
                />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
