"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Undo2, Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { SLA } from "@/lib/masters";
import { supervisors } from "@/lib/user-names";
import { formatPaise } from "@/lib/format";
import { inRecon, reconCostPaise, reconFlag, reconHours } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DeleteVehicleButton } from "../delete-vehicle-button";
import { BulkDeleteBar } from "../bulk-delete-bar";
import { RowCheckbox, SelectAllCheckbox, useSelection } from "../selection";
import { Button, Panel, Pill } from "../ui";
import { JobCardDialog } from "./job-card-dialog";
import { CardMeta, ResponsiveTable } from "./responsive-table";
import { VehicleCell, formatHours } from "./vehicle-cell";

// ---- flags & status ---------------------------------------------------------------

export function ReconFlagPill({ vehicle, now }: { vehicle: Vehicle; now: number }) {
  const flag = reconFlag(vehicle, now);
  if (flag === "red72")
    return (
      <Pill tone="danger" icon={<AlertTriangle className="size-3" />}>
        RED {SLA.reconRedHours}h
      </Pill>
    );
  if (flag === "red48")
    return (
      <Pill tone="warn" icon={<AlertTriangle className="size-3" />}>
        RED {SLA.reconAmberHours}h
      </Pill>
    );
  return (
    <Pill icon={<Clock className="size-3" />} tone="neutral">
      Within {SLA.reconAmberHours}h
    </Pill>
  );
}

export function ReconStatus({ vehicle: v }: { vehicle: Vehicle }) {
  const lastSendBack = v.recon?.sendBacks.at(-1);
  if (v.recon?.completed)
    return (
      <Pill tone="brand" icon={<ShieldCheck className="size-3" />}>
        Waiting for quality gate
      </Pill>
    );
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Pill icon={<Wrench className="size-3" />}>In progress</Pill>
      {lastSendBack && (
        <span className="flex max-w-56 items-start gap-1 text-xs text-warn">
          <Undo2 className="mt-0.5 size-3 shrink-0" /> Sent back: {lastSendBack.reason}
        </span>
      )}
    </div>
  );
}

/** Vehicles currently RED (48h or 72h) per supervisor. Vehicles at the gate still count: the clock runs until approval. */
export function redCounts(vehicles: Vehicle[], now: number) {
  const names = [...new Set([...supervisors(), ...vehicles.filter(inRecon).map((v) => v.recon!.supervisor)])];
  return names.map((name) => {
    const mine = vehicles.filter((v) => inRecon(v) && v.recon!.supervisor === name);
    const red48 = mine.filter((v) => reconFlag(v, now) === "red48").length;
    const red72 = mine.filter((v) => reconFlag(v, now) === "red72").length;
    return { name, inQueue: mine.length, red48, red72, red: red48 + red72 };
  });
}

// ---- queue -----------------------------------------------------------------------

/** Reconditioning queue, oldest first. `compact` drops secondary columns for dashboards. */
export function ReconQueuePanel({ limit, compact }: { limit?: number; compact?: boolean }) {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow(30_000);
  const [openId, setOpenId] = useState<string>();
  const rows = vehicles.filter(inRecon).sort((a, b) => reconHours(b, now) - reconHours(a, now));
  const shown = limit ? rows.slice(0, limit) : rows;
  const red = rows.filter((v) => reconFlag(v, now) !== "ok").length;
  const manage = can("recon.manage");
  const canDelete = can("stock.delete") && !compact;
  const selection = useSelection(shown, (v: Vehicle) => v.id);

  return (
    <div className="space-y-3">
      {canDelete && <BulkDeleteBar vehicles={shown} selected={selection.selected} onClear={selection.clear} />}
    <Panel
      flush
      tone={rows.some((v) => reconFlag(v, now) === "red72") ? "danger" : undefined}
      title="Reconditioning queue"
      description={`${rows.length} in the workshop · ${red} RED · clock runs from stock entry until the quality gate`}
    >
      {canDelete && shown.length > 0 && (
        <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
          <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown vehicles" />
          Select all ({shown.length} shown)
        </label>
      )}
      <ResponsiveTable
        rows={ready ? shown : []}
        card={(v) => (
          <>
            <div className="flex items-center gap-2">
              {canDelete && <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${v.make} ${v.model}`} />}
              <VehicleCell vehicle={v} />
            </div>
            <CardMeta>
              <ReconFlagPill vehicle={v} now={now} />
              <span className="tabular-nums">{formatHours(reconHours(v, now))} since stock entry</span>
              <span>{v.recon!.supervisor}</span>
              {v.recon!.technicianName && (
                <span className="inline-flex items-center gap-1">
                  <Wrench className="size-3" /> {v.recon!.technicianName}
                </span>
              )}
            </CardMeta>
            <CardMeta>
              <ReconStatus vehicle={v} />
              <span>
                {formatPaise(reconCostPaise(v))} · {v.recon!.items.length} items · {v.recon!.photos.length} photos
              </span>
            </CardMeta>
            <div className="flex gap-2">
              <Button className="flex-1" variant={manage && !v.recon!.completed ? "primary" : "secondary"} onClick={() => setOpenId(v.id)}>
                <Wrench className="size-4" /> {manage && !v.recon!.completed ? "Open job card" : "View job card"}
              </Button>
              <DeleteVehicleButton vehicle={v} />
            </div>
          </>
        )}
        rowKey={(v) => v.id}
        rowTone={(v) => (reconFlag(v, now) === "red72" ? "danger" : reconFlag(v, now) === "red48" ? "warn" : undefined)}
        empty={ready ? "Nothing in reconditioning." : "Loading…"}
        columns={[
          ...(canDelete
            ? [{ header: "", cell: (v: Vehicle) => <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${v.make} ${v.model}`} /> }]
            : []),
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          ...(compact
            ? []
            : [
                {
                  header: "Supervisor",
                  cell: (v: Vehicle) => (
                    <div className="flex flex-col whitespace-nowrap">
                      <span>{v.recon!.supervisor}</span>
                      {v.recon!.technicianName && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Wrench className="size-3" /> {v.recon!.technicianName}
                        </span>
                      )}
                    </div>
                  ),
                },
              ]),
          {
            header: "Since stock entry",
            cell: (v) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs tabular-nums">{formatHours(reconHours(v, now))}</span>
                <ReconFlagPill vehicle={v} now={now} />
              </div>
            ),
          },
          { header: "Status", cell: (v) => <ReconStatus vehicle={v} /> },
          ...(compact
            ? []
            : [
                {
                  header: "Job card",
                  align: "right" as const,
                  cell: (v: Vehicle) => (
                    <span className="whitespace-nowrap">
                      {formatPaise(reconCostPaise(v))}
                      <span className="block text-xs text-muted">
                        {v.recon!.items.length} items · {v.recon!.photos.length} photos
                      </span>
                    </span>
                  ),
                },
              ]),
          {
            header: "",
            align: "right",
            cell: (v) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant={manage && !v.recon!.completed ? "primary" : "secondary"} onClick={() => setOpenId(v.id)}>
                  <Wrench className="size-3.5" /> {manage && !v.recon!.completed ? "Open job card" : "View job card"}
                </Button>
                <DeleteVehicleButton vehicle={v} />
              </div>
            ),
          },
        ]}
      />
      {openId && <JobCardDialog vehicleId={openId} onClose={() => setOpenId(undefined)} />}
    </Panel>
    </div>
  );
}
