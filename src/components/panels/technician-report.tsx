"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { istDate } from "@/lib/working-days";
import { displayReg } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { Panel, cn, inputClass } from "../ui";

const UNASSIGNED = "Unassigned";

interface TechRow {
  technician: string;
  vehicles: Vehicle[];
}

/**
 * Monthly reconditioning count per technician: every job card signed off in the selected month,
 * grouped by whoever was recorded as the assigned technician. Reads the same vehicles the rest of
 * the app does - completeRecon() keeps `recon` on a vehicle even after it moves on (sold,
 * delivered, ...), so a technician's history isn't lost once their vehicles leave the workshop.
 * Deliberately minimal: a count and a vehicle list, nothing else.
 */
export function TechnicianReportPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const [month, setMonth] = useState(istDate(new Date()).slice(0, 7));

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
      <DataTable
        rows={ready ? rows : []}
        rowKey={(r) => r.technician}
        empty={ready ? "No job cards signed off in this month." : "Loading…"}
        columns={[
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
        ]}
      />
    </Panel>
  );
}
