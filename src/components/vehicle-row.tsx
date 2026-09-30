import Link from "next/link";
import type { ReactNode } from "react";
import { Truck } from "lucide-react";
import { branchName, SALE_READINESS_LABEL } from "@/lib/masters";
import { displayReg, formatDateTime, formatNumber, formatPaise } from "@/lib/format";
import { verifyState } from "@/lib/verification";
import { currentBranchId, inTransit } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { StageBadge, cn } from "./ui";
import { VehicleThumb } from "./vehicle-thumb";
import { VerifyTimer } from "./verify-timer";

export function SaleBadge({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.sale) return null;
  const sold = vehicle.sale.status === "sold";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", sold ? "bg-ink text-page" : "bg-warn-soft text-warn")}>
      {sold ? "Sold" : "Booked"}
    </span>
  );
}

/** Distinct, hard-to-miss marker for a bike on the road between branches - dispatched but not yet booked in at the destination. */
export function TransitBadge({ vehicle }: { vehicle: Vehicle }) {
  if (!inTransit(vehicle)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">
      <Truck className="size-3" /> In Transit
    </span>
  );
}

export function SaleReadinessBadge({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.saleReadiness) return null;
  const ready = vehicle.saleReadiness.status === "ready_for_sale";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", ready ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
      {SALE_READINESS_LABEL[vehicle.saleReadiness.status]}
    </span>
  );
}

export function VehicleRow({
  vehicle: v,
  now,
  leading,
  note,
  actions,
}: {
  vehicle: Vehicle;
  now: number;
  leading?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  const state = verifyState(v, now);
  return (
    <li
      data-vehicle-id={v.id}
      className={cn(
        "flex items-center gap-1 transition",
        leading ? "pl-1" : "pl-3",
        state === "overdue" ? "border-l-4 border-l-danger bg-danger-soft/60" : state === "verified" && !v.sale && "bg-ok-soft/40",
      )}
    >
      {leading}
      <div className="min-w-0 flex-1 py-3 pr-3">
        <Link href={`/stock/${v.id}`} className="flex items-center gap-3 hover:opacity-80">
          <VehicleThumb vehicle={v} className="size-16 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-semibold">
                {v.make} {v.model}
              </p>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatPaise(v.sale?.salePricePaise ?? v.agreedValuePaise)}
              </p>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="font-mono tracking-tight text-ink">{displayReg(v.registrationNo)}</span>
              <span className="truncate text-xs">
                {v.year} · {formatNumber(v.odometerKm)} km · {branchName(currentBranchId(v))}
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {v.sale ? <SaleBadge vehicle={v} /> : <StageBadge stage={v.stage} />}
              <TransitBadge vehicle={v} />
              <SaleReadinessBadge vehicle={v} />
              {v.sale ? (
                <span className="text-xs text-muted">
                  {v.sale.customer.name} · {formatDateTime((v.sale.soldAt ?? v.sale.bookedAt)!)}
                </span>
              ) : v.verified ? (
                <span className="text-xs font-medium text-ok">
                  Verified by {v.verified.by} · {formatDateTime(v.verified.at)}
                </span>
              ) : (
                <VerifyTimer vehicle={v} now={now} />
              )}
            </div>
          </div>
        </Link>
        {note && <div className="mt-1.5 text-xs font-medium sm:pl-[76px]">{note}</div>}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2 sm:pl-[76px]">{actions}</div>}
      </div>
    </li>
  );
}
