"use client";

import { useMemo, useState } from "react";
import { BadgeIndianRupee, Check, CircleCheck, Clock, PencilLine, TriangleAlert } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { approvePayout, enterPurchase, markPayoutPaid } from "@/lib/stock-store";
import { PAYOUT_STAGE_LABEL, payoutStage, type PayoutStage } from "@/lib/finance";
import { formatDateTime, formatIsoDate, formatPaise, groupIndian } from "@/lib/format";
import { SLA } from "@/lib/masters";
import { paymentDue } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { useAction } from "../toast";
import { Button, Field, Panel, Pill, Segmented, cn, inputClass, textareaClass } from "../ui";
import { Dialog, VehicleSummary, useInlineAction } from "./dialog";
import { VehicleCell } from "./vehicle-cell";

// ---- selectors -----------------------------------------------------------------------

type Due = NonNullable<ReturnType<typeof paymentDue>>;

const dueRank = (d: Due | undefined) => (!d ? 9 : d.status === "overdue" ? 0 : d.status === "due-soon" ? 1 : d.status === "on-track" ? 2 : 3);

/** Payout counts and amounts for the vehicles in scope (the KPI row on payments + dashboards). */
export function usePayoutSummary() {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  return useMemo(() => {
    const pick = (stage: PayoutStage) => vehicles.filter((v) => payoutStage(v) === stage);
    const sum = (rows: Vehicle[], field: "agreed" | "net") => rows.reduce((s, v) => s + (field === "net" ? (v.purchase?.netPayablePaise ?? 0) : v.agreedValuePaise), 0);
    const open = vehicles.filter((v) => payoutStage(v) && payoutStage(v) !== "paid");
    const dueSoon = open.filter((v) => paymentDue(v, now)?.status === "due-soon");
    const overdue = open.filter((v) => paymentDue(v, now)?.status === "overdue");
    const awaitingEntry = pick("awaiting-entry");
    const requested = pick("requested");
    const approved = pick("approved");
    const openValue = (rows: Vehicle[]) => rows.reduce((s, v) => s + (v.purchase?.netPayablePaise ?? v.agreedValuePaise), 0);
    return {
      ready,
      awaitingEntry: { count: awaitingEntry.length, paise: sum(awaitingEntry, "agreed") },
      requested: { count: requested.length, paise: sum(requested, "net") },
      approved: { count: approved.length, paise: sum(approved, "net") },
      dueSoon: { count: dueSoon.length, paise: openValue(dueSoon) },
      overdue: { count: overdue.length, paise: openValue(overdue) },
    };
  }, [vehicles, ready, now]);
}

// ---- pills ---------------------------------------------------------------------------

/** Seller payment clock: 7 working days from cross-verification (Sundays and holidays excluded). */
export function PaymentDuePill({ vehicle, now }: { vehicle: Vehicle; now: number }) {
  const d = paymentDue(vehicle, now);
  if (!d) return <span className="text-muted">Not verified</span>;
  if (d.status === "paid")
    return (
      <Pill tone="ok" icon={<CircleCheck className="size-3" />}>
        Paid
      </Pill>
    );
  if (d.status === "overdue")
    return (
      <Pill tone="danger" icon={<TriangleAlert className="size-3" />}>
        Overdue · {Math.abs(d.workingDaysLeft)} working day{Math.abs(d.workingDaysLeft) === 1 ? "" : "s"}
      </Pill>
    );
  if (d.status === "due-soon")
    return (
      <Pill tone="warn" icon={<Clock className="size-3" />}>
        {d.workingDaysLeft === 0 ? "Due today" : `Due in ${d.workingDaysLeft} working day${d.workingDaysLeft === 1 ? "" : "s"}`}
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={<Clock className="size-3" />}>
      On track · {d.workingDaysLeft} working days
    </Pill>
  );
}

export function PayoutStagePill({ vehicle }: { vehicle: Vehicle }) {
  const stage = payoutStage(vehicle);
  if (!stage) return null;
  const tone = stage === "paid" ? "ok" : stage === "approved" ? "brand" : "neutral";
  return <Pill tone={tone}>{PAYOUT_STAGE_LABEL[stage]}</Pill>;
}

function DueCell({ vehicle, now }: { vehicle: Vehicle; now: number }) {
  const d = paymentDue(vehicle, now);
  if (!d) return null;
  return (
    <span className="flex flex-col items-start gap-1">
      <PaymentDuePill vehicle={vehicle} now={now} />
      <span className="text-xs whitespace-nowrap text-muted">Due {formatIsoDate(d.due)}</span>
    </span>
  );
}

// ---- purchase entry (branch accountant) -------------------------------------------------

export function PurchaseEntryButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const { can, inScope } = useRole();
  const stage = payoutStage(vehicle);
  if (!can("purchase.enter") || !inScope(vehicle.branchId) || (stage !== "awaiting-entry" && stage !== "requested")) return null;
  return (
    <>
      <Button size="sm" variant={stage === "awaiting-entry" ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        {stage === "awaiting-entry" ? <BadgeIndianRupee className="size-3.5" /> : <PencilLine className="size-3.5" />}
        {stage === "awaiting-entry" ? "Enter purchase" : "Edit entry"}
      </Button>
      {open && <PurchaseDialog vehicle={vehicle} onClose={() => setOpen(false)} />}
    </>
  );
}

function PurchaseDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [deductions, setDeductions] = useState(vehicle.purchase ? String(vehicle.purchase.deductionsPaise / 100) : "");
  const [note, setNote] = useState(vehicle.purchase?.deductionNote ?? "");
  const { submit: run, failure, busy } = useInlineAction();
  const now = useNow(60_000);
  const deductionsPaise = (Number(deductions) || 0) * 100;
  const net = vehicle.agreedValuePaise - deductionsPaise;
  const due = paymentDue(vehicle, now);
  const noteMissing = deductionsPaise > 0 && !note.trim();

  async function submit() {
    if (noteMissing) return;
    if (await run(() => enterPurchase(vehicle.id, deductionsPaise, note.trim()), `Payout of ${formatPaise(net)} requested for ${vehicle.seller.name}`)) onClose();
  }

  return (
    <Dialog
      title={vehicle.purchase ? "Edit purchase entry" : "Enter purchase value"}
      subtitle={<VehicleSummary vehicle={vehicle} />}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy || net <= 0}>
            <BadgeIndianRupee className="size-4" /> Request payout
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-sunken p-3.5 text-sm">
        <div>
          <dt className="text-xs text-muted">Seller</dt>
          <dd className="font-medium">{vehicle.seller.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Agreed value</dt>
          <dd className="font-semibold tabular-nums">{formatPaise(vehicle.agreedValuePaise)}</dd>
        </div>
        {due && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">Seller to be paid by</dt>
            <dd className="font-medium">
              {formatIsoDate(due.due)} · {SLA.sellerPaymentWorkingDays} working days from verification
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-4 grid gap-4">
        <Field label="Deductions" htmlFor="deductions" hint="Traffic fines, missing documents, damage found at inspection. Leave blank if none.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">₹</span>
            <input
              id="deductions"
              inputMode="numeric"
              autoFocus
              value={groupIndian(deductions)}
              onChange={(e) => setDeductions(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="0"
              className={cn(inputClass(net <= 0), "pl-8 tabular-nums")}
            />
          </div>
        </Field>
        <Field label="Deduction note" htmlFor="ded-note" required={deductionsPaise > 0} error={noteMissing ? "Say what the deduction is for" : undefined}>
          <textarea id="ded-note" value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass(noteMissing)} placeholder="e.g. Pending traffic fines ₹1,500" />
        </Field>
        <div className="flex items-baseline justify-between rounded-xl border border-line px-3.5 py-3">
          <span className="text-sm text-muted">Net payable to seller</span>
          <span className={cn("text-xl font-semibold tabular-nums", net <= 0 && "text-danger")}>{formatPaise(Math.max(0, net))}</span>
        </div>
      </div>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

// ---- approval & payment (central accountant) --------------------------------------------

export function PayoutActions({ vehicle }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  const [paying, setPaying] = useState(false);
  const status = vehicle.purchase?.payout.status;
  if (!can("payout.approve") || !status || status === "paid") return null;
  return (
    <>
      {status === "requested" ? (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => approvePayout(vehicle.id), `Payout approved · ${formatPaise(vehicle.purchase!.netPayablePaise)} to ${vehicle.seller.name}`)}>
          <Check className="size-3.5" /> Approve
        </Button>
      ) : (
        <Button size="sm" variant="success" onClick={() => setPaying(true)}>
          <BadgeIndianRupee className="size-3.5" /> Mark paid
        </Button>
      )}
      {paying && <MarkPaidDialog vehicle={vehicle} onClose={() => setPaying(false)} />}
    </>
  );
}

function MarkPaidDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [reference, setReference] = useState("");
  const { submit: run, failure, busy } = useInlineAction();

  async function submit() {
    if (await run(() => markPayoutPaid(vehicle.id, reference), `Paid ${formatPaise(vehicle.purchase!.netPayablePaise)} to ${vehicle.seller.name} · posted to ledger`)) onClose();
  }

  return (
    <Dialog
      title="Mark seller payout paid"
      subtitle={<VehicleSummary vehicle={vehicle} />}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="success" className="flex-[2]" disabled={busy}>
            <Check className="size-4" /> Confirm payment
          </Button>
        </>
      }
    >
      <div className="flex items-baseline justify-between rounded-xl bg-sunken px-3.5 py-3">
        <span className="text-sm text-muted">Pay {vehicle.seller.name}</span>
        <span className="text-xl font-semibold tabular-nums">{formatPaise(vehicle.purchase!.netPayablePaise)}</span>
      </div>
      <div className="mt-4">
        <Field label="UTR / reference" htmlFor="utr" required hint="NEFT/RTGS UTR, UPI reference or cheque number. Posted to the ledger.">
          <input id="utr" autoFocus value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} autoComplete="off" className={cn(inputClass(!!failure), "font-mono")} />
        </Field>
      </div>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

// ---- panels --------------------------------------------------------------------------

/** Vehicle + seller; on phones the payment status rides along so it's visible without scrolling the table. */
const vehicleCol = (now: number) => ({
  header: "Vehicle",
  cell: (v: Vehicle) => (
    <VehicleCell
      vehicle={v}
      extra={
        <>
          <p className="truncate text-xs text-muted">Seller: {v.seller.name}</p>
          <span className="mt-1 block sm:hidden">
            <PaymentDuePill vehicle={v} now={now} />
          </span>
        </>
      }
    />
  ),
});

/** Verified vehicles waiting for the branch accountant's purchase value entry (and requests still editable). */
export function PurchaseEntryPanel({ limit }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const rows = vehicles
    .filter((v) => payoutStage(v) === "awaiting-entry" || payoutStage(v) === "requested")
    .sort((a, b) => Number(payoutStage(b) === "awaiting-entry") - Number(payoutStage(a) === "awaiting-entry") || dueRank(paymentDue(a, now)) - dueRank(paymentDue(b, now)));
  const waiting = rows.filter((v) => payoutStage(v) === "awaiting-entry").length;

  return (
    <Panel flush title="Purchase value entry" description={`${waiting} verified vehicle${waiting === 1 ? "" : "s"} waiting for entry · entering the value raises the payout request`}>
      <DataTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        rowTone={(v) => (paymentDue(v, now)?.status === "overdue" ? "danger" : paymentDue(v, now)?.status === "due-soon" ? "warn" : undefined)}
        empty={ready ? "Every verified vehicle has its purchase value entered." : "Loading…"}
        columns={[
          vehicleCol(now),
          { header: "Agreed", align: "right", cell: (v) => formatPaise(v.agreedValuePaise) },
          {
            header: "Net payable",
            align: "right",
            cell: (v) =>
              v.purchase ? (
                <span className="flex flex-col items-end">
                  {formatPaise(v.purchase.netPayablePaise)}
                  {v.purchase.deductionsPaise > 0 && <span className="text-xs text-muted">−{formatPaise(v.purchase.deductionsPaise)} {v.purchase.deductionNote}</span>}
                </span>
              ) : (
                <span className="text-muted">Not entered</span>
              ),
          },
          { header: "Seller payment", cell: (v) => <DueCell vehicle={v} now={now} /> },
          { header: "Payout", cell: (v) => <PayoutStagePill vehicle={v} /> },
          { header: "", align: "right", cell: (v) => <PurchaseEntryButton vehicle={v} /> },
        ]}
      />
    </Panel>
  );
}

/** Payout requests waiting for the central accountant: approve, then mark paid with the UTR. */
export function PayoutApprovalPanel({ limit, title = "Payout approval queue" }: { limit?: number; title?: string }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const rows = vehicles
    .filter((v) => payoutStage(v) === "requested" || payoutStage(v) === "approved")
    .sort((a, b) => dueRank(paymentDue(a, now)) - dueRank(paymentDue(b, now)) || (paymentDue(a, now)?.due ?? "").localeCompare(paymentDue(b, now)?.due ?? ""));
  const total = rows.reduce((s, v) => s + v.purchase!.netPayablePaise, 0);

  return (
    <Panel flush title={title} description={`${rows.length} payout${rows.length === 1 ? "" : "s"} open · ${formatPaise(total)} · most urgent first`}>
      <DataTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        rowTone={(v) => (paymentDue(v, now)?.status === "overdue" ? "danger" : paymentDue(v, now)?.status === "due-soon" ? "warn" : undefined)}
        empty={ready ? "No payouts waiting for approval or payment." : "Loading…"}
        columns={[
          vehicleCol(now),
          {
            header: "Net payable",
            align: "right",
            cell: (v) => (
              <span className="flex flex-col items-end gap-1">
                <span className="font-semibold whitespace-nowrap">{formatPaise(v.purchase!.netPayablePaise)}</span>
                <PayoutStagePill vehicle={v} />
              </span>
            ),
          },
          {
            header: "Requested",
            cell: (v) => (
              <span className="text-xs whitespace-nowrap text-muted">
                {formatDateTime(v.purchase!.entered.at)}
                <span className="block">by {v.purchase!.entered.by}</span>
              </span>
            ),
          },
          { header: "Seller payment", cell: (v) => <DueCell vehicle={v} now={now} /> },
          { header: "", align: "right", cell: (v) => <PayoutActions vehicle={v} /> },
        ]}
      />
    </Panel>
  );
}

type TrackerFilter = "open" | "paid" | "all";

/** Every verified vehicle's seller payment against the 7-working-day commitment. */
export function SellerPaymentTracker({ limit, initial = "open" }: { limit?: number; initial?: TrackerFilter }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<TrackerFilter>(initial);
  const all = vehicles.filter((v) => v.verified);
  const rows = all
    .filter((v) => (filter === "all" ? true : filter === "paid" ? payoutStage(v) === "paid" : payoutStage(v) !== "paid"))
    .sort((a, b) => dueRank(paymentDue(a, now)) - dueRank(paymentDue(b, now)) || (paymentDue(a, now)?.due ?? "").localeCompare(paymentDue(b, now)?.due ?? "") * (filter === "paid" ? -1 : 1));

  return (
    <Panel
      flush
      title="Seller payment tracker"
      description={`Sellers are paid within ${SLA.sellerPaymentWorkingDays} working days of cross-verification (Sundays and public holidays excluded)`}
      actions={
        <div className="w-56">
          <Segmented
            name="Payment filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open" },
              { value: "paid", label: "Paid" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
      }
    >
      <DataTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        rowTone={(v) => (paymentDue(v, now)?.status === "overdue" ? "danger" : paymentDue(v, now)?.status === "due-soon" ? "warn" : undefined)}
        empty={ready ? (filter === "open" ? "Every seller has been paid." : "No seller payments here.") : "Loading…"}
        columns={[
          vehicleCol(now),
          { header: "Verified", cell: (v) => <span className="text-xs whitespace-nowrap text-muted">{formatDateTime(v.verified!.at)}</span> },
          { header: "Due date", cell: (v) => <span className="whitespace-nowrap">{formatIsoDate(paymentDue(v, now)!.due)}</span> },
          { header: "Status", cell: (v) => <PaymentDuePill vehicle={v} now={now} /> },
          { header: "Amount", align: "right", cell: (v) => formatPaise(v.purchase?.netPayablePaise ?? v.agreedValuePaise) },
          {
            header: "Payout",
            cell: (v) => (
              <span className="flex flex-col items-start gap-0.5">
                <PayoutStagePill vehicle={v} />
                {v.purchase?.payout.reference && <span className="font-mono text-xs text-muted">{v.purchase.payout.reference}</span>}
              </span>
            ),
          },
          {
            header: "",
            align: "right",
            cell: (v) => (
              <span className="inline-flex gap-2">
                <PurchaseEntryButton vehicle={v} />
                <PayoutActions vehicle={v} />
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}
