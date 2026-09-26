"use client";

import { useMemo } from "react";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { ageingBucket, daysSince, formatSignedPaise as signedPaise, isSold, monthLabel, salesByMonth } from "@/lib/finance";
import { branchName } from "@/lib/masters";
import { formatDate, formatPaise, displayReg } from "@/lib/format";
import { csvDate, rupees, type CsvColumn } from "@/lib/csv";
import { landedCostPaise, marginPaise, reconCostPaise } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { Panel } from "../ui";
import { CsvButton } from "./csv-button";
import { VehicleCell } from "./vehicle-cell";

const pct = (num: number, den: number) => (den ? `${((num / den) * 100).toFixed(1)}%` : "–");

/** Sold vehicles in scope, newest sale first. */
export function useSoldVehicles() {
  const { vehicles, ready } = useScopedVehicles();
  const sold = useMemo(() => vehicles.filter((v) => isSold(v) && v.sale?.soldAt).sort((a, b) => b.sale!.soldAt!.localeCompare(a.sale!.soldAt!)), [vehicles]);
  return { sold, ready };
}

const vehicleCsv: CsvColumn<Vehicle>[] = [
  { header: "Sold on", value: (v) => csvDate(v.sale?.soldAt) },
  { header: "Stock id", value: (v) => v.stockId ?? "" },
  { header: "Registration", value: (v) => displayReg(v.registrationNo) },
  { header: "Vehicle", value: (v) => `${v.make} ${v.model} ${v.variant}` },
  { header: "Source branch", value: (v) => branchName(v.branchId) },
  { header: "Customer", value: (v) => v.sale?.customer.name },
  { header: "Purchase (INR)", value: (v) => rupees(v.purchase?.netPayablePaise ?? v.agreedValuePaise) },
  { header: "Reconditioning (INR)", value: (v) => rupees(reconCostPaise(v)) },
  { header: "Transfer fee (INR)", value: (v) => rupees(v.delivery?.transferFeePaise ?? 0) },
  { header: "Landed cost (INR)", value: (v) => rupees(landedCostPaise(v)) },
  { header: "Sale price (INR)", value: (v) => rupees(v.sale?.salePricePaise) },
  { header: "Margin (INR)", value: (v) => rupees(marginPaise(v)) },
];

export function SalesByVehiclePanel() {
  const { sold, ready } = useSoldVehicles();
  return (
    <Panel flush title="Sales & margin by vehicle" description="Landed cost = purchase + reconditioning + transfer fee" actions={<CsvButton filename="sales-by-vehicle" rows={sold} columns={vehicleCsv} />}>
      <DataTable
        rows={ready ? sold : []}
        rowKey={(v) => v.id}
        empty={ready ? "No sales yet." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          { header: "Sold", cell: (v) => <span className="whitespace-nowrap text-muted">{formatDate(v.sale!.soldAt!)}</span> },
          { header: "Sale price", align: "right", cell: (v) => formatPaise(v.sale?.salePricePaise ?? 0) },
          { header: "Landed cost", align: "right", cell: (v) => formatPaise(landedCostPaise(v)) },
          {
            header: "Margin",
            align: "right",
            cell: (v) => (
              <span className="flex flex-col items-end">
                <span className="font-semibold">{signedPaise(marginPaise(v) ?? 0)}</span>
                <span className="text-xs text-muted">{pct(marginPaise(v) ?? 0, v.sale?.salePricePaise ?? 0)}</span>
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}

type MonthRow = ReturnType<typeof salesByMonth>[number];

const monthCsv: CsvColumn<MonthRow>[] = [
  { header: "Month", value: (r) => r.month },
  { header: "Units sold", value: (r) => r.units },
  { header: "Revenue (INR)", value: (r) => rupees(r.revenuePaise) },
  { header: "Landed cost (INR)", value: (r) => rupees(r.costPaise) },
  { header: "Margin (INR)", value: (r) => rupees(r.marginPaise) },
];

export function SalesByMonthPanel() {
  const { sold, ready } = useSoldVehicles();
  const rows = useMemo(() => salesByMonth(sold), [sold]);
  return (
    <Panel flush title="Sales & margin by month" actions={<CsvButton filename="sales-by-month" rows={rows} columns={monthCsv} />}>
      <DataTable
        rows={ready ? rows : []}
        rowKey={(r) => r.month}
        empty={ready ? "No sales yet." : "Loading…"}
        columns={[
          { header: "Month", cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span> },
          { header: "Units", align: "right", cell: (r) => r.units },
          { header: "Revenue", align: "right", cell: (r) => formatPaise(r.revenuePaise) },
          { header: "Landed cost", align: "right", cell: (r) => formatPaise(r.costPaise) },
          { header: "Margin", align: "right", cell: (r) => <span className="font-semibold">{signedPaise(r.marginPaise)}</span> },
          { header: "Margin %", align: "right", cell: (r) => pct(r.marginPaise, r.revenuePaise) },
        ]}
      />
    </Panel>
  );
}

/** Unsold vehicles, oldest first, with their age bucket. */
export function AgeingVehiclesPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(300_000);
  const rows = useMemo(() => vehicles.filter((v) => !isSold(v)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [vehicles]);
  const csv: CsvColumn<Vehicle>[] = [
    { header: "Entered", value: (v) => csvDate(v.createdAt) },
    { header: "Days since entry", value: (v) => daysSince(v.createdAt, now) },
    { header: "Bucket", value: (v) => ageingBucket(daysSince(v.createdAt, now)).label },
    { header: "Registration", value: (v) => displayReg(v.registrationNo) },
    { header: "Vehicle", value: (v) => `${v.make} ${v.model} ${v.variant}` },
    { header: "Source branch", value: (v) => branchName(v.branchId) },
    { header: "Status", value: (v) => (v.sale?.status === "booked" ? "Booked" : v.receipt ? "At Angamaly" : v.dispatch ? "In transit" : "At branch") },
    { header: "Landed cost (INR)", value: (v) => rupees(landedCostPaise(v)) },
  ];
  return (
    <Panel flush title="Unsold stock by age" description="Oldest first" actions={<CsvButton filename="unsold-stock-ageing" rows={rows} columns={csv} />}>
      <DataTable
        rows={ready ? rows : []}
        rowKey={(v) => v.id}
        empty={ready ? "No unsold stock." : "Loading…"}
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          { header: "Entered", cell: (v) => <span className="whitespace-nowrap text-muted">{formatDate(v.createdAt)}</span> },
          { header: "Age", align: "right", cell: (v) => `${daysSince(v.createdAt, now)} days` },
          { header: "Bucket", cell: (v) => <span className="whitespace-nowrap">{ageingBucket(daysSince(v.createdAt, now)).label}</span> },
          { header: "Landed cost", align: "right", cell: (v) => formatPaise(landedCostPaise(v)) },
        ]}
      />
    </Panel>
  );
}
