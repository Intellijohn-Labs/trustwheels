"use client";

import { Check } from "lucide-react";
import { setVerified } from "@/lib/stock-store";
import { useRole } from "@/lib/role-context";
import { useAction } from "./toast";
import type { Vehicle } from "@/lib/types";
import { cn } from "./ui";

export function VerifyCheckbox({ vehicle, withLabel }: { vehicle: Vehicle; withLabel?: boolean }) {
  const { can, inScope } = useRole();
  const { run, busy } = useAction();
  const checked = !!vehicle.verified;
  const allowed = can("stock.verify") && inScope(vehicle.branchId);
  // Un-verifying is locked once the vehicle has moved on (dispatched or sold).
  const locked = !allowed || (checked && (!!vehicle.sale || !!vehicle.dispatch));
  const name = `${vehicle.make} ${vehicle.model}`;

  function toggle() {
    run(() => setVerified(vehicle.id, !checked), checked ? `${name}: verification removed` : `${name} verified`);
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `${name} verified. Uncheck to undo` : `Mark ${name} as verified`}
      title={!allowed ? (checked ? "Verified" : "Not verified. Your role can't verify vehicles") : locked ? "Verified. Locked because the vehicle has moved on" : checked ? "Verified. Click to undo" : "Mark as verified"}
      disabled={busy || locked}
      onClick={toggle}
      className={cn(
        "group flex shrink-0 items-center gap-2 rounded-xl p-2.5 text-sm font-medium transition disabled:cursor-not-allowed",
        withLabel && "border border-line-strong px-3.5 hover:bg-sunken",
        withLabel && checked && "border-ok/40 bg-ok-soft text-ok hover:bg-ok-soft",
      )}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg border-2 transition",
          checked ? "border-ok bg-ok text-white" : "border-line-strong bg-surface text-transparent group-hover:border-ok group-hover:text-ok/40",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      {withLabel && (checked ? "Verified" : "Mark as verified")}
    </button>
  );
}
