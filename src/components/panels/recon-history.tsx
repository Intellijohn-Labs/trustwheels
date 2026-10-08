"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Trash2, Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { clearReconCompletion } from "@/lib/stock-store";
import { collapseThenRun } from "@/lib/exit-animation";
import { displayReg, formatDateTime, formatPaise } from "@/lib/format";
import { reconCostPaise } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { VehicleThumb } from "../vehicle-thumb";
import { Button, Panel } from "../ui";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "../selection";
import { PhotoGrid } from "./job-card-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

/**
 * Every job card that's been signed off, most recent first - the completion record itself
 * (`v.recon.completed`) is the same "done" signal the quality-gate queue and Technician Report
 * already key off, so this never drifts from what "reconditioning is finished" means elsewhere.
 * A vehicle sent back for a second recon cycle (completeRecon() keeps the old job card's cost
 * history and photos; sendToReconditioning() only resets them for a fresh cycle) still shows its
 * most recent sign-off here.
 *
 * Delete (single and bulk) is Managing Partner only (`stock.delete`, same gate Technician Report's
 * own delete already uses) and reuses that exact mutation, clearReconCompletion(): it clears the
 * sign-off and technician credit so the vehicle drops off this list, but keeps the job card's items,
 * cost history and photos intact - this is a report entry disappearing, not data destruction.
 */
export function ReconHistoryPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const canDelete = can("stock.delete");
  const [confirming, setConfirming] = useState<Vehicle[] | null>(null);

  const rows = useMemo(
    () => vehicles.filter((v) => !!v.recon?.completed).sort((a, b) => b.recon!.completed!.at.localeCompare(a.recon!.completed!.at)),
    [vehicles],
  );

  const selection = useSelection(rows, (v) => v.id);

  async function doDelete(targets: Vehicle[]) {
    const ids = targets.map((v) => v.id);
    await collapseThenRun(ids, async () => {
      await clearReconCompletion(ids);
      selection.clear();
    });
  }

  return (
    <div className="space-y-3">
      {canDelete && (
        <SelectionToolbar count={selection.count} noun="history record" onClear={selection.clear} onDelete={() => setConfirming(rows.filter((v) => selection.isSelected(v.id)))} />
      )}
      <Panel flush title="Reconditioning history" description={`${rows.length} job card${rows.length === 1 ? "" : "s"} signed off`}>
        {!ready ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No reconditioning has been signed off yet.</p>
        ) : (
          <>
            {canDelete && (
              <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
                <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all history records" />
                Select all ({rows.length} shown)
              </label>
            )}
            <ul className="divide-y divide-line">
              {rows.map((v) => (
                <HistoryRow
                  key={v.id}
                  vehicle={v}
                  canDelete={canDelete}
                  selected={selection.isSelected(v.id)}
                  onToggle={() => selection.toggle(v.id)}
                  onDelete={() => setConfirming([v])}
                />
              ))}
            </ul>
          </>
        )}
      </Panel>
      {confirming && (
        <ConfirmDeleteDialog
          count={confirming.length}
          items={confirming.map(label)}
          noun="history record"
          cascadeNote="This clears the sign-off and technician credit so it drops off this list. The underlying job card items, cost history and photos are kept."
          onConfirm={() => doDelete(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

function HistoryRow({
  vehicle: v,
  canDelete,
  selected,
  onToggle,
  onDelete,
}: {
  vehicle: Vehicle;
  canDelete: boolean;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const recon = v.recon!;
  const completed = recon.completed!;
  const cost = reconCostPaise(v);

  return (
    <li data-vehicle-id={v.id} className="flex items-start gap-1 px-1 py-4 sm:px-4">
      {canDelete && (
        <div className="pt-1.5">
          <RowCheckbox checked={selected} onChange={onToggle} label={`Select ${label(v)}`} />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-3 px-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link href={`/stock/${v.id}`} className="flex min-w-48 items-center gap-3 hover:opacity-80">
            <VehicleThumb vehicle={v} className="size-12 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {v.make} {v.model}
              </p>
              <p className="font-mono text-xs text-ink">{displayReg(v.registrationNo)}</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-start gap-3">
            <div className="text-right text-sm">
              <p className="font-semibold tabular-nums">{formatPaise(cost)}</p>
              <p className="text-xs text-muted">
                {recon.items.length} item{recon.items.length === 1 ? "" : "s"}
              </p>
            </div>
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Delete history record for ${label(v)}`}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Wrench className="size-3.5" /> {recon.technicianName || "Unassigned technician"} · supervised by {recon.supervisor}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" /> Completed {formatDateTime(completed.at)} by {completed.by}
          </span>
        </div>

        {recon.items.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {recon.items.map((item) => (
              <li key={item.id} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs whitespace-nowrap">
                {item.description} · {formatPaise(item.costPaise)}
              </li>
            ))}
          </ul>
        )}

        {recon.photos.length > 0 ? <PhotoGrid photos={recon.photos} label="Completion photo" /> : <p className="text-xs text-muted">No completion photos on file.</p>}
      </div>
    </li>
  );
}
