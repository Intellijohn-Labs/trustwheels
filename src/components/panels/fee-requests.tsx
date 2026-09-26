"use client";

import { useState } from "react";
import { BadgeIndianRupee, Check, CircleCheck, Clock } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { approveTransferFee, payTransferFee } from "@/lib/stock-store";
import { formatDateTime, formatPaise } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { useAction } from "../toast";
import { Button, Panel, Pill, Segmented } from "../ui";
import { VehicleCell } from "./vehicle-cell";

type FeeStatus = "requested" | "approved" | "paid";
type FeeFilter = "open" | "paid" | "all";

const hasFee = (v: Vehicle) => !!v.delivery?.feePayment;
const feeStatus = (v: Vehicle) => v.delivery!.feePayment!.status;

/** RTO / transfer fee requests awaiting approval or payment in the role's scope. */
export function useFeeSummary() {
  const { vehicles, ready } = useScopedVehicles();
  const withFee = vehicles.filter(hasFee);
  const sum = (s: FeeStatus) => {
    const rows = withFee.filter((v) => feeStatus(v) === s);
    return { count: rows.length, paise: rows.reduce((t, v) => t + (v.delivery!.transferFeePaise ?? 0), 0) };
  };
  return { ready, requested: sum("requested"), approved: sum("approved"), paid: sum("paid") };
}

export function FeeStatusPill({ status }: { status: FeeStatus }) {
  if (status === "paid")
    return (
      <Pill tone="ok" icon={<CircleCheck className="size-3" />}>
        Paid
      </Pill>
    );
  if (status === "approved")
    return (
      <Pill tone="brand" icon={<Check className="size-3" />}>
        Approved · unpaid
      </Pill>
    );
  return (
    <Pill tone="warn" icon={<Clock className="size-3" />}>
      Awaiting approval
    </Pill>
  );
}

export function FeeActions({ vehicle }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  if (!can("fees.manage") || !hasFee(vehicle)) return null;
  const status = feeStatus(vehicle);
  const amount = formatPaise(vehicle.delivery!.transferFeePaise ?? 0);
  if (status === "requested")
    return (
      <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => approveTransferFee(vehicle.id), `Transfer fee ${amount} approved`)}>
        <Check className="size-3.5" /> Approve
      </Button>
    );
  if (status === "approved")
    return (
      <Button size="sm" variant="success" disabled={busy} onClick={() => run(() => payTransferFee(vehicle.id), `Transfer fee ${amount} paid · posted to ledger`)}>
        <BadgeIndianRupee className="size-3.5" /> Mark paid
      </Button>
    );
  return null;
}

export function FeeRequestsPanel({ limit, initial = "open", title = "RTO & transfer fee requests" }: { limit?: number; initial?: FeeFilter; title?: string }) {
  const { vehicles, ready } = useScopedVehicles();
  const [filter, setFilter] = useState<FeeFilter>(initial);
  const order: Record<FeeStatus, number> = { requested: 0, approved: 1, paid: 2 };
  const all = vehicles.filter(hasFee);
  const rows = all
    .filter((v) => (filter === "all" ? true : filter === "paid" ? feeStatus(v) === "paid" : feeStatus(v) !== "paid"))
    .sort((a, b) => order[feeStatus(a)] - order[feeStatus(b)] || b.delivery!.feePayment!.requested.at.localeCompare(a.delivery!.feePayment!.requested.at));
  const open = all.filter((v) => feeStatus(v) !== "paid");

  return (
    <Panel
      flush
      title={title}
      description={`${open.length} open · ${formatPaise(open.reduce((s, v) => s + (v.delivery!.transferFeePaise ?? 0), 0))} · requested by sales for ownership transfer at the RTO`}
      actions={
        limit ? undefined : (
          <div className="w-56">
            <Segmented
              name="Fee filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: "Open" },
                { value: "paid", label: "Paid" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
        )
      }
    >
      <DataTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(v) => v.id}
        empty={ready ? (filter === "open" ? "No fee requests waiting." : "No fee requests here.") : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          {
            header: "Customer",
            cell: (v) => (
              <span className="whitespace-nowrap">
                {v.sale?.customer.name ?? "–"}
                {v.sale?.customer.phone && <span className="block text-xs text-muted tabular-nums">{v.sale.customer.phone}</span>}
              </span>
            ),
          },
          { header: "Amount", align: "right", cell: (v) => <span className="font-semibold">{formatPaise(v.delivery!.transferFeePaise ?? 0)}</span> },
          {
            header: "Requested",
            cell: (v) => (
              <span className="text-xs whitespace-nowrap text-muted">
                {formatDateTime(v.delivery!.feePayment!.requested.at)}
                <span className="block">by {v.delivery!.feePayment!.requested.by}</span>
              </span>
            ),
          },
          {
            header: "Status",
            cell: (v) => {
              const f = v.delivery!.feePayment!;
              const last = f.paid ?? f.approved;
              return (
                <span className="flex flex-col items-start gap-0.5">
                  <FeeStatusPill status={f.status} />
                  {last && <span className="text-xs whitespace-nowrap text-muted">{formatDateTime(last.at)} · {last.by}</span>}
                </span>
              );
            },
          },
          { header: "", align: "right", cell: (v) => <FeeActions vehicle={v} /> },
        ]}
      />
    </Panel>
  );
}
