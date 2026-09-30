"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { receiveVehicle } from "@/lib/stock-store";
import { SLA, branchName } from "@/lib/masters";
import { displayReg, formatDateTime, normaliseReg } from "@/lib/format";
import { inTransit, transitBreached, transitHours } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { DeleteVehicleButton } from "../delete-vehicle-button";
import { Button, Field, Panel, Pill, cn, inputClass, textareaClass } from "../ui";
import { Dialog, VehicleSummary, useInlineAction } from "./dialog";
import { RemoveFromTransitButton, TransitSlaPill } from "./transit-panel";
import { CardMeta, ResponsiveTable } from "./responsive-table";
import { VehicleCell, formatHours } from "./vehicle-cell";

/** Received at Angamaly since midnight IST. */
export function receivedToday(v: Vehicle, now: number) {
  const day = (t: number | string) => new Date(t).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  return !!v.receipt && day(v.receipt.at) === day(now);
}

// ---- receive dialog ----------------------------------------------------------------

function ReceiveDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [reg, setReg] = useState("");
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState<Vehicle>();
  const stockId = received?.stockId;
  const { submit, failure, busy, setFailure } = useInlineAction();
  const d = vehicle.dispatch!;

  async function onSubmit() {
    if (stockId) return onClose();
    await submit(async () => {
      setReceived(await receiveVehicle(vehicle.id, reg, notes));
    }, `Received into stock`);
  }

  return (
    <Dialog
      title={stockId ? "Booked into stock" : "Receive at Angamaly"}
      subtitle={<VehicleSummary vehicle={vehicle} />}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        stockId ? (
          <Button size="lg" type="submit" variant="primary" className="flex-1">
            Done
          </Button>
        ) : (
          <>
            <Button size="lg" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button size="lg" type="submit" variant="success" className="flex-[2]" disabled={busy || !reg.trim()}>
              <PackageCheck className="size-4" /> Confirm receipt
            </Button>
          </>
        )
      }
    >
      {stockId ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-ok" />
          <p className="mt-3 text-sm text-muted">Stock ID issued</p>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-tight" data-testid="stock-id">
            {stockId}
          </p>
          <p className="mt-3 text-sm text-muted">Assigned to {received!.recon?.supervisor} for reconditioning. The {SLA.reconAmberHours}/{SLA.reconRedHours}-hour clock has started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-sunken px-3.5 py-3 text-sm">
            <dt className="text-muted">From</dt>
            <dd className="font-medium">{branchName(vehicle.branchId)}</dd>
            <dt className="text-muted">Rider</dt>
            <dd className="font-medium">{d.rider}</dd>
            <dt className="text-muted">Handed over</dt>
            <dd className="font-medium">{formatDateTime(d.handoverAt)}</dd>
            <dt className="text-muted">Dispatched by</dt>
            <dd className="font-medium">{d.by}</dd>
          </dl>
          <Field
            label="Registration number on the plate"
            htmlFor="reg-typed"
            required
            error={failure}
            hint="Type what you read on the vehicle itself, not from the dispatch note. It must match before the vehicle can be booked in."
          >
            <input
              id="reg-typed"
              autoFocus
              value={displayReg(normaliseReg(reg))}
              onChange={(e) => {
                setReg(normaliseReg(e.target.value).slice(0, 11));
                setFailure(undefined);
              }}
              placeholder="KL 07 AB 1234"
              autoComplete="off"
              autoCapitalize="characters"
              className={cn(inputClass(!!failure), "font-mono text-lg tracking-wide uppercase")}
            />
          </Field>
          <Field label="Notes" htmlFor="receive-notes" hint="Optional. Damage on arrival, missing keys or documents.">
            <textarea id="receive-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass()} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}

// ---- lists -----------------------------------------------------------------------

/** Vehicles on the road to Angamaly with their dispatch note. */
export function ArrivingPanel({ limit }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow(30_000);
  // Held here, not in the row: the row leaves the list the moment the vehicle is received,
  // and the dialog must stay open to show the issued Stock ID.
  const [receiving, setReceiving] = useState<Vehicle>();
  const rows = vehicles.filter(inTransit).sort((a, b) => a.dispatch!.handoverAt.localeCompare(b.dispatch!.handoverAt));
  const breached = rows.filter((v) => transitBreached(v, now)).length;

  return (
    <Panel
      flush
      tone={breached ? "danger" : undefined}
      title="Arriving"
      description={`${rows.length} dispatched and not yet received. Check the plate against the dispatch record before booking in.`}
    >
      <ResponsiveTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        rowTone={(v) => (transitBreached(v, now) ? "danger" : undefined)}
        card={(v) => (
          <>
            <VehicleCell vehicle={v} />
            <CardMeta>
              <span>
                Rider <span className="font-medium text-ink">{v.dispatch!.rider}</span>
              </span>
              <span>{formatDateTime(v.dispatch!.handoverAt)}</span>
              <span>
                Reg. on record <span className="font-mono font-medium text-ink">{displayReg(v.registrationNo)}</span>
              </span>
            </CardMeta>
            <CardMeta>
              <span className="tabular-nums">{formatHours(transitHours(v, now))} on the road</span>
              <TransitSlaPill vehicle={v} now={now} />
            </CardMeta>
            <div className="flex gap-2">
              {can("hub.receive") && (
                <Button variant="primary" className="flex-1" onClick={() => setReceiving(v)}>
                  <PackageCheck className="size-4" /> Receive
                </Button>
              )}
              <RemoveFromTransitButton vehicle={v} />
              <DeleteVehicleButton vehicle={v} />
            </div>
          </>
        )}
        empty={ready ? "Nothing on the way." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          {
            header: "Dispatch note",
            cell: (v) => (
              <div className="text-xs whitespace-nowrap">
                <p>
                  <span className="text-muted">Rider</span> <span className="font-medium">{v.dispatch!.rider}</span>
                </p>
                <p className="text-muted">{formatDateTime(v.dispatch!.handoverAt)}</p>
                <p>
                  <span className="text-muted">Reg. on record</span> <span className="font-mono font-medium">{displayReg(v.registrationNo)}</span>
                </p>
              </div>
            ),
          },
          {
            header: "On the road",
            cell: (v) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs whitespace-nowrap tabular-nums">{formatHours(transitHours(v, now))}</span>
                <TransitSlaPill vehicle={v} now={now} />
              </div>
            ),
          },
          {
            header: "",
            align: "right",
            cell: (v) => (
              <div className="flex justify-end gap-2">
                {can("hub.receive") && (
                  <Button size="sm" variant="primary" onClick={() => setReceiving(v)}>
                    <PackageCheck className="size-3.5" /> Receive
                  </Button>
                )}
                <RemoveFromTransitButton vehicle={v} />
                <DeleteVehicleButton vehicle={v} />
              </div>
            ),
          },
        ]}
      />
      {receiving && <ReceiveDialog vehicle={receiving} onClose={() => setReceiving(undefined)} />}
    </Panel>
  );
}

/** Latest receipts with the Stock ID they were given. */
export function ReceivedPanel({ limit = 10 }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const received = vehicles.filter((v) => v.receipt).sort((a, b) => b.receipt!.at.localeCompare(a.receipt!.at));
  const today = received.filter((v) => receivedToday(v, now)).length;

  return (
    <Panel flush title="Received today and recently" description={`${today} received today`}>
      <DataTable
        rows={ready ? received.slice(0, limit) : []}
        rowKey={(v) => v.id}
        empty="Nothing received yet."
        columns={[
          { header: "Stock ID", cell: (v) => <span className="font-mono font-semibold whitespace-nowrap">{v.stockId}</span> },
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} stockId={false} /> },
          {
            header: "Received",
            cell: (v) => (
              <div className="text-xs whitespace-nowrap">
                <p>{formatDateTime(v.receipt!.at)}</p>
                <p className="text-muted">by {v.receipt!.by}</p>
              </div>
            ),
          },
          {
            header: "Transit",
            cell: (v) =>
              transitHours(v, now) > SLA.transitHours ? (
                <Pill tone="warn" icon={<AlertTriangle className="size-3" />}>
                  {formatHours(transitHours(v, now))} · late
                </Pill>
              ) : (
                <span className="text-xs tabular-nums">{formatHours(transitHours(v, now))}</span>
              ),
          },
          { header: "Notes", cell: (v) => <span className="text-xs text-muted">{v.receipt!.notes || "–"}</span> },
          { header: "", align: "right", cell: (v) => <DeleteVehicleButton vehicle={v} /> },
        ]}
      />
    </Panel>
  );
}
