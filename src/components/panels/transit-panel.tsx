"use client";

import { useState } from "react";
import { AlertTriangle, Bike, Clock, ShieldAlert, Truck } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { dispatchVehicle } from "@/lib/stock-store";
import { BRANCHES, SLA } from "@/lib/masters";
import { formatDateTime } from "@/lib/format";
import { formatDuration, verifyState } from "@/lib/verification";
import { inTransit, transitBreached, transitHours } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { Button, Field, Panel, Pill, inputClass } from "../ui";
import { Dialog, VehicleSummary, useInlineAction } from "./dialog";
import { CardMeta, ResponsiveTable } from "./responsive-table";
import { VehicleCell, formatHours } from "./vehicle-cell";

// ---- selectors shared by the transit page and the dashboards --------------------------

/** Branch vehicles that haven't left for Angamaly yet (verified or not). */
export function awaitingDispatch(v: Vehicle) {
  return v.branchId !== "ang" && !v.dispatch && !v.receipt && !v.sale;
}

/** Past 75% of the transit limit but not yet breached. */
export function transitNearLimit(v: Vehicle, now: number) {
  return inTransit(v) && !transitBreached(v, now) && transitHours(v, now) > SLA.transitHours * 0.75;
}

// ---- dispatch ------------------------------------------------------------------------

export function DispatchButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const { can } = useRole();
  if (!can("transit.dispatch")) return null;
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <Truck className="size-3.5" /> Dispatch
      </Button>
      {open && <DispatchDialog vehicle={vehicle} onClose={() => setOpen(false)} />}
    </>
  );
}

function DispatchDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [rider, setRider] = useState("");
  const { submit: run, failure, busy } = useInlineAction();

  async function submit() {
    if (await run(() => dispatchVehicle(vehicle.id, rider), `${vehicle.make} ${vehicle.model} handed to ${rider.trim()} for Angamaly`)) onClose();
  }

  return (
    <Dialog
      title="Dispatch to Angamaly"
      subtitle={<VehicleSummary vehicle={vehicle} />}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy}>
            <Truck className="size-4" /> Hand over now
          </Button>
        </>
      }
    >
      <Field label="Rider name" htmlFor="rider" required hint={`The handover time is recorded now. Angamaly must receive it within ${SLA.transitHours} hours.`}>
        <input id="rider" autoFocus value={rider} onChange={(e) => setRider(e.target.value)} autoComplete="off" className={inputClass(!!failure)} />
      </Field>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

function DispatchStatus({ vehicle: v, now }: { vehicle: Vehicle; now: number }) {
  if (v.verified)
    return (
      <Pill tone="ok" icon={<Bike className="size-3" />}>
        Verified · ready
      </Pill>
    );
  const overdue = verifyState(v, now) === "overdue";
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Pill tone={overdue ? "danger" : "warn"} icon={<ShieldAlert className="size-3" />}>
        {overdue ? "Verification overdue" : "Not verified"}
      </Pill>
      <span className="text-xs text-muted">Can&apos;t dispatch until documents are verified</span>
    </span>
  );
}

/** Branch vehicles not yet dispatched. Verified ones can go; the rest say why they can't. */
export function ReadyToDispatchPanel({ limit }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const rows = vehicles
    .filter(awaitingDispatch)
    .sort((a, b) => Number(!!b.verified) - Number(!!a.verified) || a.createdAt.localeCompare(b.createdAt));
  const shown = limit ? rows.slice(0, limit) : rows;
  const readyCount = rows.filter((v) => v.verified).length;

  return (
    <Panel
      flush
      title="Ready to dispatch"
      description={`${readyCount} verified and ready · ${rows.length - readyCount} waiting for verification`}
    >
      <ResponsiveTable
        rows={ready ? shown : []}
        card={(v) => (
          <>
            <VehicleCell vehicle={v} />
            <CardMeta>
              <DispatchStatus vehicle={v} now={now} />
              <span>Entered {formatDateTime(v.createdAt)}</span>
            </CardMeta>
            {v.verified && <DispatchButton vehicle={v} />}
          </>
        )}
        rowKey={(v) => v.id}
        empty={ready ? "Nothing waiting at the branch. Every vehicle has left for Angamaly." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          { header: "Entered", cell: (v) => <span className="whitespace-nowrap text-muted">{formatDateTime(v.createdAt)}</span> },
          { header: "Status", cell: (v) => <DispatchStatus vehicle={v} now={now} /> },
          { header: "", align: "right", cell: (v) => (v.verified ? <DispatchButton vehicle={v} /> : null) },
        ]}
      />
    </Panel>
  );
}

// ---- in transit ----------------------------------------------------------------------

export function TransitSlaPill({ vehicle, now }: { vehicle: Vehicle; now: number }) {
  if (transitBreached(vehicle, now))
    return (
      <Pill tone="danger" icon={<AlertTriangle className="size-3" />}>
        Breached · escalated to manager &amp; proprietor
      </Pill>
    );
  if (transitNearLimit(vehicle, now))
    return (
      <Pill tone="warn" icon={<Clock className="size-3" />}>
        Near limit
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={<Clock className="size-3" />}>
      On time
    </Pill>
  );
}

/** Live list of vehicles between the branch and Angamaly, oldest handover first. */
export function InTransitPanel({ limit }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow();
  const rows = vehicles.filter(inTransit).sort((a, b) => a.dispatch!.handoverAt.localeCompare(b.dispatch!.handoverAt));
  const breached = rows.filter((v) => transitBreached(v, now)).length;

  return (
    <Panel
      flush
      tone={breached ? "danger" : undefined}
      title="In transit"
      description={`${rows.length} on the road · limit ${SLA.transitHours} hours from handover${breached ? ` · ${breached} breached` : ""}`}
    >
      <ResponsiveTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        rowTone={(v) => (transitBreached(v, now) ? "danger" : transitNearLimit(v, now) ? "warn" : undefined)}
        card={(v) => (
          <>
            <VehicleCell vehicle={v} />
            <CardMeta>
              <span>
                Rider <span className="font-medium text-ink">{v.dispatch!.rider}</span>
              </span>
              <span>{formatDateTime(v.dispatch!.handoverAt)}</span>
            </CardMeta>
            <CardMeta>
              <span className="font-mono text-ink">
                {formatDuration(now - new Date(v.dispatch!.handoverAt).getTime())} of {SLA.transitHours}h
              </span>
              <TransitSlaPill vehicle={v} now={now} />
            </CardMeta>
          </>
        )}
        empty={ready ? "No vehicles on the road." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          { header: "Rider", cell: (v) => v.dispatch!.rider },
          { header: "Handed over", cell: (v) => <span className="whitespace-nowrap text-muted">{formatDateTime(v.dispatch!.handoverAt)}</span> },
          {
            header: "Elapsed",
            align: "right",
            cell: (v) => (
              <span className="font-mono text-xs whitespace-nowrap">
                {formatDuration(now - new Date(v.dispatch!.handoverAt).getTime())}
                <span className="block text-muted">of {SLA.transitHours}h</span>
              </span>
            ),
          },
          { header: "SLA", cell: (v) => <TransitSlaPill vehicle={v} now={now} /> },
        ]}
      />
    </Panel>
  );
}

// ---- branch performance ----------------------------------------------------------------

interface BranchRow {
  id: string;
  name: string;
  dispatched: number;
  received: number;
  avgHours?: number;
  breaches: number;
}

/** Per-branch dispatch counts, average transit time and breaches (past and current). */
export function TransitPerformancePanel() {
  const { vehicles } = useScopedVehicles();
  const { inScope } = useRole();
  const now = useNow(60_000);

  const rows: BranchRow[] = BRANCHES.filter((b) => b.id !== "ang" && inScope(b.id)).map((b) => {
    const dispatched = vehicles.filter((v) => v.branchId === b.id && v.dispatch);
    const received = dispatched.filter((v) => v.receipt);
    const total = received.reduce((sum, v) => sum + transitHours(v, now), 0);
    const late = received.filter((v) => transitHours(v, now) > SLA.transitHours).length;
    return {
      id: b.id,
      name: b.name,
      dispatched: dispatched.length,
      received: received.length,
      avgHours: received.length ? total / received.length : undefined,
      breaches: late + dispatched.filter((v) => transitBreached(v, now)).length,
    };
  });

  return (
    <Panel flush title="Branch transit performance" description={`Received late = took longer than ${SLA.transitHours} hours. Breaches include vehicles still on the road.`}>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        rowTone={(r) => (r.breaches ? "danger" : undefined)}
        columns={[
          { header: "Branch", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Dispatched", align: "right", cell: (r) => r.dispatched },
          { header: "Received", align: "right", cell: (r) => r.received },
          { header: "Avg. transit", align: "right", cell: (r) => (r.avgHours == null ? <span className="text-muted">–</span> : formatHours(r.avgHours)) },
          {
            header: "Breaches",
            align: "right",
            cell: (r) =>
              r.breaches ? (
                <Pill tone="danger" icon={<AlertTriangle className="size-3" />}>
                  {r.breaches} breached
                </Pill>
              ) : (
                <span className="text-muted">None</span>
              ),
          },
        ]}
      />
    </Panel>
  );
}
