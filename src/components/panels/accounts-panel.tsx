"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, PiggyBank, Receipt, Search, TriangleAlert, Wallet } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { istDate } from "@/lib/working-days";
import { formatDate, formatPaise, normaliseReg } from "@/lib/format";
import { recordPayment } from "@/lib/stock-store";
import { RupeeInput } from "./job-card-dialog";
import type { PaymentMode, Vehicle } from "@/lib/types";
import { DataTable, type Column } from "../data-table";
import { Button, Field, KpiCard, KpiGrid, Panel, Pill, Segmented, cn, inputClass } from "../ui";
import { Dialog, VehicleSummary, useInlineAction } from "./dialog";
import { VehicleCell } from "./vehicle-cell";

const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", bank_transfer: "Net Banking", finance: "Finance" };
const PAYMENT_MODES = Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[];

type PaymentStatus = "fully_paid" | "partial" | "pending";
type ScopeFilter = "month" | "all";
type ModeFilter = PaymentMode | "all";

function receivedPaise(v: Vehicle) {
  return v.sale?.receivedAmountPaise ?? v.sale?.bookingAmountPaise ?? 0;
}

function paymentStatus(v: Vehicle): PaymentStatus {
  const total = v.sale?.salePricePaise ?? 0;
  const received = receivedPaise(v);
  if (received <= 0) return "pending";
  if (received >= total) return "fully_paid";
  return "partial";
}

const STATUS_LABEL: Record<PaymentStatus, string> = { fully_paid: "Fully Paid", partial: "Partial", pending: "Pending" };

function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  if (status === "fully_paid") return <Pill tone="ok" icon={<CheckCircle2 className="size-3" />}>{STATUS_LABEL.fully_paid}</Pill>;
  if (status === "partial") return <Pill tone="warn" icon={<Clock className="size-3" />}>{STATUS_LABEL.partial}</Pill>;
  return <Pill tone="danger" icon={<TriangleAlert className="size-3" />}>{STATUS_LABEL.pending}</Pill>;
}

/** Set/update how a sold vehicle's payment has come in - mode and running total collected. */
function RecordPaymentDialog({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [mode, setMode] = useState<PaymentMode>(v.sale?.paymentMode ?? "cash");
  const [amount, setAmount] = useState(receivedPaise(v) ? String(receivedPaise(v) / 100) : "");
  const { submit, failure, busy } = useInlineAction();
  const total = v.sale?.salePricePaise ?? 0;

  return (
    <Dialog
      title="Record payment"
      subtitle={<VehicleSummary vehicle={v} />}
      onClose={onClose}
      onSubmit={() => submit(() => recordPayment(v.id, mode, Number(amount) * 100), "Payment updated").then((ok) => ok && onClose())}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy || !amount}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Total sale price <span className="font-semibold text-ink">{formatPaise(total)}</span>
        </p>
        <Field label="Payment mode" htmlFor="pay-mode">
          <select id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={inputClass()}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total received so far" htmlFor="pay-amount" hint="The running total collected from the customer, not just this payment">
          <RupeeInput id="pay-amount" value={amount} onChange={setAmount} placeholder="1,25,000" />
        </Field>
        {failure && <p className="text-sm font-medium text-danger">{failure}</p>}
      </div>
    </Dialog>
  );
}

/**
 * Accounts / Finance: cash position on sold vehicles - what customers were charged, what's come
 * in, what's still outstanding. Separate from the seller-payments/RTO-fees pages, which track
 * money flowing the other way (this dealership paying sellers and the RTO), not money customers
 * owe the dealership.
 */
export function AccountsPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const [scope, setScope] = useState<ScopeFilter>("month");
  const [month, setMonth] = useState(istDate(new Date()).slice(0, 7));
  const [mode, setMode] = useState<ModeFilter>("all");
  const [query, setQuery] = useState("");
  const [paying, setPaying] = useState<Vehicle>();

  const sold = useMemo(() => vehicles.filter((v) => v.sale?.status === "sold" && v.sale.soldAt), [vehicles]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qReg = normaliseReg(query);
    return sold
      .filter((v) => scope === "all" || v.sale!.soldAt!.startsWith(month))
      .filter((v) => mode === "all" || v.sale?.paymentMode === mode)
      .filter((v) => !q || (qReg && v.registrationNo.includes(qReg)) || v.sale!.customer.name.toLowerCase().includes(q))
      .sort((a, b) => b.sale!.soldAt!.localeCompare(a.sale!.soldAt!));
  }, [sold, scope, month, mode, query]);

  const totalRevenue = rows.reduce((sum, v) => sum + (v.sale?.salePricePaise ?? 0), 0);
  const totalReceived = rows.reduce((sum, v) => sum + receivedPaise(v), 0);
  const totalPending = Math.max(0, totalRevenue - totalReceived);

  const columns: Column<Vehicle>[] = [
    { header: "Date of sale", cell: (v) => <span className="whitespace-nowrap">{formatDate(v.sale!.soldAt!)}</span> },
    { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} stockId={false} /> },
    {
      header: "Customer",
      cell: (v) => (
        <div className="flex flex-col">
          <span className="font-medium">{v.sale!.customer.name}</span>
          <span className="text-xs text-muted tabular-nums">+91 {v.sale!.customer.phone}</span>
        </div>
      ),
    },
    { header: "Sale price", align: "right", cell: (v) => <span className="font-semibold tabular-nums">{formatPaise(v.sale!.salePricePaise ?? 0)}</span> },
    {
      header: "Payment mode",
      cell: (v) => (v.sale?.paymentMode ? <Pill>{PAYMENT_MODE_LABEL[v.sale.paymentMode]}</Pill> : <span className="text-xs text-muted">Not recorded</span>),
    },
    { header: "Payment status", cell: (v) => <PaymentStatusPill status={paymentStatus(v)} /> },
    { header: "Handled by", cell: (v) => <span className="whitespace-nowrap">{v.sale!.by}</span> },
    {
      header: "",
      align: "right",
      cell: (v) => (
        <Button size="sm" onClick={() => setPaying(v)}>
          <Wallet className="size-3.5" /> Record payment
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-xs">
          <Segmented name="Accounts range" value={scope} onChange={setScope} options={[{ value: "month", label: "Monthly" }, { value: "all", label: "All-time" }]} />
        </div>
        {scope === "month" && (
          <input
            type="month"
            value={month}
            max={istDate(new Date()).slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            aria-label="Pick a month"
            className={cn(inputClass(), "h-10 w-auto")}
          />
        )}
      </div>

      <KpiGrid>
        <KpiCard label="Total revenue" value={formatPaise(totalRevenue)} icon={<PiggyBank />} hint={`${rows.length} vehicle${rows.length === 1 ? "" : "s"} sold`} />
        <KpiCard label="Total received" value={formatPaise(totalReceived)} icon={<Receipt />} tone="ok" hint="Cash / bank / UPI / finance combined" />
        <KpiCard label="Pending balance" value={formatPaise(totalPending)} icon={<TriangleAlert />} tone={totalPending ? "warn" : "neutral"} hint={totalPending ? "Still owed by customers" : "Nothing outstanding"} />
      </KpiGrid>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reg. no. or customer name"
            className={cn(inputClass(), "pl-10")}
          />
        </div>
        <select value={mode} onChange={(e) => setMode(e.target.value as ModeFilter)} className={inputClass()} aria-label="Payment mode">
          <option value="all">All payment modes</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>

      <Panel flush title="Sales transactions" description={`${rows.length} sale${rows.length === 1 ? "" : "s"} matching these filters`}>
        <DataTable rows={ready ? rows : []} rowKey={(v) => v.id} empty={ready ? "No sales match these filters." : "Loading…"} columns={columns} />
      </Panel>

      {paying && <RecordPaymentDialog vehicle={paying} onClose={() => setPaying(undefined)} />}
    </div>
  );
}
