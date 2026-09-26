import Link from "next/link";
import type { ReactNode } from "react";
import { branchName } from "@/lib/masters";
import { displayReg } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { VehicleThumb } from "../vehicle-thumb";

/** Thumbnail, make/model, plate and branch: the first column of every hub table. */
export function VehicleCell({ vehicle: v, extra, stockId = true }: { vehicle: Vehicle; extra?: ReactNode; stockId?: boolean }) {
  return (
    <Link href={`/stock/${v.id}`} className="flex min-w-48 items-center gap-3 hover:opacity-80">
      <VehicleThumb vehicle={v} className="size-11 rounded-lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {v.make} {v.model}
        </p>
        <p className="truncate text-xs text-muted">
          <span className="font-mono text-ink">{displayReg(v.registrationNo)}</span> · {branchName(v.branchId)}
          {stockId && v.stockId && <> · {v.stockId}</>}
        </p>
        {extra}
      </div>
    </Link>
  );
}

/** "3h 20m" / "2d 04h" style, for SLA clocks measured in hours. */
export function formatHours(hours: number) {
  const mins = Math.max(0, Math.floor(hours * 60));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return d ? `${d}d ${String(h).padStart(2, "0")}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}
