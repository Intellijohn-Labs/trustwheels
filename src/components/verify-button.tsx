"use client";

import Link from "next/link";
import { Check, CheckCircle2, Wrench } from "lucide-react";
import { setVerified, unverifyVehicle } from "@/lib/stock-store";
import { useRole } from "@/lib/role-context";
import { inRecon, isTrustWheelsHub, startsReconOnVerify } from "@/lib/workflow";
import { useAction } from "./toast";
import type { Vehicle } from "@/lib/types";
import { Button } from "./ui";

/**
 * Single-click Verify / Unverify toggle. Unverified: neutral "Verify". Verified: green
 * "Verified" with a check - clicking it again immediately unverifies, no confirmation step and
 * no lock once the vehicle has moved on (dispatched or sold) - a role with `stock.verify` can
 * always walk verification back to correct a mistake. Both directions go through
 * `setVerified`/`unverifyVehicle` (and on to Supabase) like every other mutation; unverifying
 * also clears a stale "Ready for Sale" tag - see `setVerified` for that cascade.
 */
export function VerifyButton({ vehicle, size = "sm" }: { vehicle: Vehicle; size?: "sm" | "md" | "lg" }) {
  const { can, inScope } = useRole();
  const { run, busy } = useAction();
  const checked = !!vehicle.verified;
  const allowed = can("stock.verify") && inScope(vehicle.branchId);
  const name = `${vehicle.make} ${vehicle.model}`;

  function toggle() {
    const wasReadyForSale = vehicle.saleReadiness?.status === "ready_for_sale";
    run(
      () => (checked ? unverifyVehicle(vehicle.id) : setVerified(vehicle.id, true)),
      checked
        ? wasReadyForSale
          ? `${name}: unverified, Ready for Sale cleared`
          : `${name}: unverified`
        : startsReconOnVerify(vehicle)
          ? `${name} verified and sent to Reconditioning (job card opened)`
          : `${name} verified`,
    );
  }

  // TrustWheels hub stock goes straight from verification into the workshop: point at the job card.
  const toRecon = isTrustWheelsHub(vehicle.branchId) && !!vehicle.recon && !vehicle.recon.completed && inRecon(vehicle);

  return (
    <>
    <Button
      size={size}
      variant={checked ? "success" : "secondary"}
      disabled={busy || !allowed}
      onClick={toggle}
      aria-pressed={checked}
      aria-label={checked ? `${name} verified. Click to unverify` : `Mark ${name} as verified`}
      title={!allowed ? (checked ? "Verified" : "Not verified. Your role can't verify vehicles") : checked ? "Verified. Click to unverify" : "Mark as verified"}
    >
      {checked ? <CheckCircle2 className="size-3.5" /> : <Check className="size-3.5" />}
      {checked ? "Verified" : "Verify"}
    </Button>
    {toRecon && (
      <Link
        href="/recon"
        className={size === "sm" ? "inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-surface hover:brightness-110" : "inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-surface hover:brightness-110"}
      >
        <Wrench className="size-4" /> Proceed to Reconditioning (Job Card)
      </Link>
    )}
    </>
  );
}
