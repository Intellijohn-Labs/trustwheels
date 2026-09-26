"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Undo2, Wrench } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { SLA } from "@/lib/masters";
import { supervisors, useRoleNames } from "@/lib/user-names";
import { formatPaise } from "@/lib/format";
import { inRecon, reconCostPaise, reconFlag, reconHours } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
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
  const red = rows.filter((v) => reconFlag(v, now) !== "ok").length;
  const manage = can("recon.manage");

  return (
    <Panel
      flush
      tone={rows.some((v) => reconFlag(v, now) === "red72") ? "danger" : undefined}
      title="Reconditioning queue"
      description={`${rows.length} in the workshop · ${red} RED · clock runs from stock entry until the quality gate`}
    >
      <ResponsiveTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        card={(v) => (
          <>
            <VehicleCell vehicle={v} />
            <CardMeta>
              <ReconFlagPill vehicle={v} now={now} />
              <span className="tabular-nums">{formatHours(reconHours(v, now))} since stock entry</span>
              <span>{v.recon!.supervisor}</span>
            </CardMeta>
            <CardMeta>
              <ReconStatus vehicle={v} />
              <span>
                {formatPaise(reconCostPaise(v))} · {v.recon!.items.length} items · {v.recon!.photos.length} photos
              </span>
            </CardMeta>
            <Button className="w-full" variant={manage && !v.recon!.completed ? "primary" : "secondary"} onClick={() => setOpenId(v.id)}>
              <Wrench className="size-4" /> {manage && !v.recon!.completed ? "Open job card" : "View job card"}
            </Button>
          </>
        )}
        rowKey={(v) => v.id}
        rowTone={(v) => (reconFlag(v, now) === "red72" ? "danger" : reconFlag(v, now) === "red48" ? "warn" : undefined)}
        empty={ready ? "Nothing in reconditioning." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          ...(compact ? [] : [{ header: "Supervisor", cell: (v: Vehicle) => <span className="whitespace-nowrap">{v.recon!.supervisor}</span> }]),
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
              <Button size="sm" variant={manage && !v.recon!.completed ? "primary" : "secondary"} onClick={() => setOpenId(v.id)}>
                <Wrench className="size-3.5" /> {manage && !v.recon!.completed ? "Open job card" : "View job card"}
              </Button>
            ),
          },
        ]}
      />
      {openId && <JobCardDialog vehicleId={openId} onClose={() => setOpenId(undefined)} />}
    </Panel>
  );
}

/** RED count by supervisor name. */
export function RedCountPanel() {
  useRoleNames(); // re-render when a supervisor is renamed
  const { vehicles } = useScopedVehicles();
  const now = useNow(60_000);
  const rows = redCounts(vehicles, now);

  return (
    <Panel flush title="RED count by supervisor" description={`RED ${SLA.reconAmberHours}h and RED ${SLA.reconRedHours}h are counted from stock entry.`}>
      <DataTable
        rows={rows}
        rowKey={(r) => r.name}
        rowTone={(r) => (r.red72 ? "danger" : r.red48 ? "warn" : undefined)}
        columns={[
          { header: "Supervisor", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "In queue", align: "right", cell: (r) => r.inQueue },
          { header: `RED ${SLA.reconAmberHours}h`, align: "right", cell: (r) => r.red48 },
          { header: `RED ${SLA.reconRedHours}h`, align: "right", cell: (r) => r.red72 },
          {
            header: "RED count",
            align: "right",
            cell: (r) =>
              r.red ? (
                <Pill tone={r.red72 ? "danger" : "warn"} icon={<AlertTriangle className="size-3" />}>
                  {r.red} RED
                </Pill>
              ) : (
                <span className="text-muted">0</span>
              ),
          },
        ]}
      />
    </Panel>
  );
}
