"use client";

import { useMemo, useState } from "react";
import { Trash2, Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { istDate } from "@/lib/working-days";
import { displayReg } from "@/lib/format";
import { clearReconCompletion } from "@/lib/stock-store";
import { collapseThenRun } from "@/lib/exit-animation";
import { useRole } from "@/lib/role-context";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "../selection";
import { Button, Panel, cn, inputClass } from "../ui";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const UNASSIGNED = "Unassigned";
interface TechRow {
  technician: string;
  vehicles: Vehicle[];
}

export function TechnicianReportPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const canDelete = can("stock.delete");
  const [month, setMonth] = useState(istDate(new Date()).slice(0, 7));
  const [confirming, setConfirming] = useState<TechRow[] | null>(null);

  const rows = useMemo(() => {
    const byTechnician = new Map<string, Vehicle[]>();
    for (const v of vehicles) {
      const completed = v.recon?.completed;
      if (!completed || !completed.at.startsWith(month)) continue;
      const technician = v.recon!.technicianName || UNASSIGNED;
      byTechnician.set(technician, [...(byTechnician.get(technician) ?? []), v]);
    }
    const list: TechRow[] = [...byTechnician.entries()].map(([technician, list]) => ({ technician, vehicles: list }));
    return list.sort((a, b) => b.vehicles.length - a.vehicles.length);
  }, [vehicles, month]);

  const selection = useSelection(rows, (r) => r.technician);

  /** Every vehicle id counted by the given technician rows, deduped - a vehicle can only belong to one technician per month so this is mostly for bulk delete across several rows at once. */
  function vehicleIdsFor(targets: TechRow[]) {
    return [...new Set(targets.flatMap((r) => r.vehicles.map((v) => v.id)))];
  }

  async function doDelete(targets: TechRow[]) {
    const names = targets.map((r) => r.technician);
    await collapseThenRun(names, async () => {
      await clearReconCompletion(vehicleIdsFor(targets));
      selection.clear();
    });
  }

  return (
    <Panel
      flush
      title="Technician report"
      description="Job cards signed off this month, by whoever did the work."
      actions={
        <input
          type="month"
          value={month}
          max={istDate(new Date()).slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          aria-label="Pick a month"
          className={cn(inputClass(), "h-8 w-auto px-2.5 text-xs")}
        />
      }
    >
      {canDelete && (
        <div className="px-4 pt-3">
          <SelectionToolbar count={selection.count} noun="technician report" onClear={selection.clear} onDelete={() => setConfirming(rows.filter((r) => selection.isSelected(r.technician)))} />
        </div>
      )}
      <DataTable
        rows={ready ? rows : []}
        rowKey={(r) => r.technician}
        empty={ready ? "No job cards signed off in this month." : "Loading…"}
        columns={[
          ...(canDelete
            ? [
                {
                  header: <SelectAllCheckbox checked={selection.allVisibleSelected} onChange={selection.toggleAll} label="Select all technician reports" />,
                  cell: (r: TechRow) => <RowCheckbox checked={selection.isSelected(r.technician)} onChange={() => selection.toggle(r.technician)} label={`Select ${r.technician}`} />,
                  className: "w-10",
                },
              ]
            : []),
          {
            header: "Technician",
            cell: (r) => (
              <span className={cn("inline-flex items-center gap-1.5 font-medium whitespace-nowrap", r.technician === UNASSIGNED && "text-muted italic")}>
                <Wrench className="size-3.5" /> {r.technician}
              </span>
            ),
          },
          { header: "Completed", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{r.vehicles.length}</span> },
          {
            header: "Vehicles",
            cell: (r) => (
              <div className="flex flex-wrap gap-1.5">
                {r.vehicles.map((v) => (
                  <span key={v.id} className="rounded-full bg-sunken px-2 py-0.5 text-xs whitespace-nowrap">
                    {displayReg(v.registrationNo)} · {v.model}
                  </span>
                ))}
              </div>
            ),
          },
          ...(canDelete
            ? [
                {
                  header: "",
                  align: "right" as const,
                  cell: (r: TechRow) => (
                    <Button size="sm" variant="ghost" onClick={() => setConfirming([r])} aria-label={`Delete ${r.technician}'s report`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {confirming && (
        <ConfirmDeleteDialog
          count={confirming.length}
          items={confirming.map((r) => `${r.technician} · ${r.vehicles.length} vehicle${r.vehicles.length === 1 ? "" : "s"}`)}
          noun="technician report"
          cascadeNote="This clears the sign-off and technician credit for these job cards so they drop off every month's report. The underlying job card items, photos, and cost history are kept."
          onConfirm={() => doDelete(confirming!)}
          onClose={() => setConfirming(null)}
        />
      )}
    </Panel>
  );
}
