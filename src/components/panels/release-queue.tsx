"use client";

import Link from "next/link";
import { Panel, EmptyState, cn } from "../ui";
import { VehicleCell } from "./vehicle-cell";
import { ReleaseControl, SaleAgePill } from "./delivery-gate";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { daysSinceSale, isCodeRed, releaseBlockers, transferProgress } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";

/** Sold or booked, not yet delivered. */
export const awaitingDelivery = (v: Vehicle) => !!v.sale && !v.delivery?.delivered;

/** Code Red first, then the longest-waiting sale. */
export function byUrgency(now: number) {
  return (a: Vehicle, b: Vehicle) => Number(isCodeRed(b, now)) - Number(isCodeRed(a, now)) || daysSinceSale(b, now) - daysSinceSale(a, now);
}

/**
 * Vehicles waiting for the Angamaly manager's final release, with the lock state and
 * the Release button (for roles with delivery.release). Embedded on the gatekeeper dashboard.
 */
export function ReleaseQueue({ limit, title = "Awaiting final release" }: { limit?: number; title?: string }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const queue = vehicles
    .filter((v) => awaitingDelivery(v) && !v.delivery?.released)
    .sort((a, b) => Number(releaseBlockers(a).length > 0) - Number(releaseBlockers(b).length > 0) || byUrgency(now)(a, b));
  const rows = limit ? queue.slice(0, limit) : queue;
  const releasable = queue.filter((v) => releaseBlockers(v).length === 0).length;

  return (
    <Panel
      flush
      title={`${title} · ${queue.length}`}
      description={`${releasable} ready to release. Release stays locked until the sale, booking documents and the full ownership transfer are done.`}
      actions={
        <Link href="/deliveries" className="text-sm font-medium text-brand hover:underline">
          All deliveries
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyState>{ready ? "Nothing waiting for release." : "Loading…"}</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((v) => {
            const red = isCodeRed(v, now);
            const p = transferProgress(v);
            return (
              <li key={v.id} className={cn("grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-5", red && "bg-danger-soft/60 shadow-[inset_4px_0_0_var(--danger)]")}>
                <div className="min-w-0 space-y-1.5">
                  <VehicleCell vehicle={v} />
                  <p className="text-xs text-muted">
                    <span className="font-medium text-ink">{v.sale!.customer.name}</span> · Transfer {p.done}/{p.total}
                  </p>
                  <SaleAgePill vehicle={v} now={now} />
                </div>
                <ReleaseControl vehicle={v} compact />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
