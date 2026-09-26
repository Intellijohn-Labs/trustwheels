"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DataTable, type Column } from "../data-table";
import { Panel } from "../ui";
import { VehicleCell } from "./vehicle-cell";
import { SaleAgePill } from "./delivery-gate";
import { awaitingDelivery, byUrgency } from "./release-queue";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { isCodeRed, transferProgress } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";

/** What has to happen next for this delivery, from the sales executive's point of view. */
export function nextDeliveryStep(v: Vehicle) {
  if (v.sale?.status !== "sold") return v.sale?.docsVerified ? "Collect balance and mark as sold" : "Sign off booking documents";
  if (!v.sale.docsVerified) return "Sign off booking documents";
  const p = transferProgress(v);
  if (!v.delivery?.feePayment) return "Request the RTO transfer fee";
  if (!p.complete) return `Complete ownership transfer (${p.done}/${p.total})`;
  if (!v.delivery.released) return "Waiting for the manager's final release";
  return "Record handover to the customer";
}

/** Sold / booked vehicles not yet delivered, with the next step. Sales executive dashboard. */
export function DeliveriesNeedingAction({ limit }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const all = vehicles.filter(awaitingDelivery).sort(byUrgency(now));
  const rows = limit ? all.slice(0, limit) : all;

  const columns: Column<Vehicle>[] = [
    { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
    {
      header: "Customer",
      cell: (v) => (
        <div className="min-w-32">
          <p className="font-medium">{v.sale!.customer.name}</p>
          <a href={`tel:+91${v.sale!.customer.phone}`} className="text-xs text-brand tabular-nums hover:underline">
            {v.sale!.customer.phone}
          </a>
        </div>
      ),
    },
    { header: "Since sale", cell: (v) => <SaleAgePill vehicle={v} now={now} /> },
    { header: "Next step", cell: (v) => <span className="min-w-44 block">{nextDeliveryStep(v)}</span> },
  ];

  return (
    <Panel
      flush
      tone={all.some((v) => isCodeRed(v, now)) ? "danger" : undefined}
      title={`Deliveries needing action · ${all.length}`}
      description="Deliver within 4 days of the sale. After that it is Code Red."
      actions={
        <Link href="/deliveries" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          Open deliveries <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <DataTable columns={columns} rows={rows} rowKey={(v) => v.id} rowTone={(v) => (isCodeRed(v, now) ? "danger" : undefined)} empty={ready ? "No deliveries pending." : "Loading…"} />
    </Panel>
  );
}
