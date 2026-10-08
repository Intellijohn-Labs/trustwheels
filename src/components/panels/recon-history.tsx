"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { displayReg, formatDateTime, formatPaise } from "@/lib/format";
import { reconCostPaise } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { VehicleThumb } from "../vehicle-thumb";
import { Panel } from "../ui";
import { PhotoGrid } from "./job-card-dialog";

/**
 * Every job card that's been signed off, most recent first - the completion record itself
 * (`v.recon.completed`) is the same "done" signal the quality-gate queue and Technician Report
 * already key off, so this never drifts from what "reconditioning is finished" means elsewhere.
 * A vehicle sent back for a second recon cycle (completeRecon() keeps the old job card's cost
 * history and photos; sendToReconditioning() only resets them for a fresh cycle) still shows its
 * most recent sign-off here.
 */
export function ReconHistoryPanel() {
  const { vehicles, ready } = useScopedVehicles();

  const rows = useMemo(
    () => vehicles.filter((v) => !!v.recon?.completed).sort((a, b) => b.recon!.completed!.at.localeCompare(a.recon!.completed!.at)),
    [vehicles],
  );

  return (
    <Panel flush title="Reconditioning history" description={`${rows.length} job card${rows.length === 1 ? "" : "s"} signed off`}>
      {!ready ? (
        <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">No reconditioning has been signed off yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((v) => (
            <HistoryRow key={v.id} vehicle={v} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function HistoryRow({ vehicle: v }: { vehicle: Vehicle }) {
  const recon = v.recon!;
  const completed = recon.completed!;
  const cost = reconCostPaise(v);

  return (
    <li className="space-y-3 px-4 py-4">
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
        <div className="shrink-0 text-right text-sm">
          <p className="font-semibold tabular-nums">{formatPaise(cost)}</p>
          <p className="text-xs text-muted">
            {recon.items.length} item{recon.items.length === 1 ? "" : "s"}
          </p>
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
    </li>
  );
}
