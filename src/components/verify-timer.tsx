import { AlertTriangle, Clock } from "lucide-react";
import { VERIFY_LIMIT_HOURS } from "@/lib/masters";
import { formatDuration, verifyDeadline, verifyState } from "@/lib/verification";
import type { Vehicle } from "@/lib/types";
import { cn } from "./ui";

/** Countdown to the verification deadline, or how long it has been overdue. Nothing once verified. */
export function VerifyTimer({ vehicle, now, className }: { vehicle: Vehicle; now: number; className?: string }) {
  const state = verifyState(vehicle, now);
  if (state === "verified") return null;
  const left = verifyDeadline(vehicle) - now;
  const urgent = left < (VERIFY_LIMIT_HOURS / 4) * 3_600_000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        state === "overdue" ? "bg-danger text-white" : urgent ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand",
        className,
      )}
      title={state === "overdue" ? `Not verified within ${VERIFY_LIMIT_HOURS} hours` : `Verify within ${VERIFY_LIMIT_HOURS} hours of entry`}
    >
      {state === "overdue" ? <AlertTriangle className="size-3.5" /> : <Clock className="size-3.5" />}
      {state === "overdue" ? `Not verified · overdue ${formatDuration(-left)}` : `Verify in ${formatDuration(left)}`}
    </span>
  );
}
