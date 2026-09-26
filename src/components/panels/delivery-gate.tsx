"use client";

import { CheckCircle2, FileCheck2, KeyRound, Lock, LockOpen, Siren, Unlock } from "lucide-react";
import { Button, Pill } from "../ui";
import { useAction } from "../toast";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { recordHandover, releaseDelivery, verifySaleDocs } from "@/lib/stock-store";
import { celebrate } from "@/lib/celebrate";
import { daysSinceSale, handoverBlockers, isCodeRed, releaseBlockers } from "@/lib/workflow";
import { SLA } from "@/lib/masters";
import type { Vehicle } from "@/lib/types";

/*
 * Building blocks of the delivery gate: booking-document sign-off, the manager's final
 * release (HARD LOCK until the ownership transfer is complete) and the sales handover.
 * Locked controls stay visible with the reasons, so everyone can see what is holding a delivery.
 */

/** "Code Red · 6 days since sale" / "Day 2 of 4 since sale" / "Booked, not sold". */
export function SaleAgePill({ vehicle: v, now }: { vehicle: Vehicle; now: number }) {
  if (v.delivery?.delivered) return <Pill tone="ok" icon={<CheckCircle2 className="size-3.5" />}>Delivered</Pill>;
  if (v.sale?.status !== "sold") return <Pill tone="warn">Booked · balance pending</Pill>;
  const days = Math.floor(daysSinceSale(v, now));
  if (isCodeRed(v, now))
    return (
      <Pill tone="danger" icon={<Siren className="size-3.5" />}>
        Code Red · {days} days since sale
      </Pill>
    );
  return <Pill tone="neutral">Day {days + 1} of {SLA.codeRedDays} since sale</Pill>;
}

export function BlockerList({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted">
      {reasons.map((r) => (
        <li key={r} className="flex gap-1.5">
          <Lock className="mt-0.5 size-3 shrink-0 text-danger" aria-hidden />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

/** Buyer KYC and booking documents signed off by sales. */
export function DocsSignOff({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  if (!v.sale) return null;
  if (v.sale.docsVerified)
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <Pill tone="ok" icon={<FileCheck2 className="size-3.5" />}>
          Docs signed off
        </Pill>
        <span className="text-xs text-muted">
          {v.sale.docsVerified.by} · {formatDateTime(v.sale.docsVerified.at)}
        </span>
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone="warn" icon={<FileCheck2 className="size-3.5" />}>
        Docs not signed off
      </Pill>
      {can("sale.docs") && (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => verifySaleDocs(v.id), `Booking documents signed off for ${v.sale!.customer.name}`)}>
          Sign off documents
        </Button>
      )}
    </div>
  );
}

/** Angamaly manager's final release. Locked (and refused by the store) until every blocker is cleared. */
export function ReleaseControl({ vehicle: v, compact }: { vehicle: Vehicle; compact?: boolean }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  if (v.delivery?.released)
    return (
      <p className="flex flex-wrap items-center gap-1.5">
        <Pill tone="ok" icon={<LockOpen className="size-3.5" />}>
          Released
        </Pill>
        <span className="text-xs text-muted">
          {v.delivery.released.by} · {formatDateTime(v.delivery.released.at)}
        </span>
      </p>
    );
  const blockers = releaseBlockers(v);
  const locked = blockers.length > 0;

  function release() {
    if (!confirm(`Release ${v.make} ${v.model} for delivery to ${v.sale?.customer.name}?`)) return;
    run(() => releaseDelivery(v.id), "Released for delivery. Sales can now hand over the vehicle.");
  }

  return (
    <div>
      {can("delivery.release") ? (
        <Button
          variant={locked ? "secondary" : "success"}
          size={compact ? "sm" : "md"}
          disabled={locked || busy}
          onClick={release}
          aria-label={locked ? "Release locked" : "Release for delivery"}
          title={locked ? blockers.join("\n") : undefined}
        >
          {locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          {locked ? "Release locked" : "Release for delivery"}
        </Button>
      ) : (
        <Pill tone={locked ? "neutral" : "brand"} icon={locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}>
          {locked ? "Release locked" : "Ready for manager's release"}
        </Pill>
      )}
      <BlockerList reasons={blockers} />
    </div>
  );
}

/** Sales executive hands the vehicle to the customer. Locked until the manager has released it. */
export function HandoverControl({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  if (v.delivery?.delivered)
    return (
      <p className="flex flex-wrap items-center gap-1.5">
        <Pill tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
          Delivered
        </Pill>
        <span className="text-xs text-muted">
          {v.delivery.delivered.by} · {formatDateTime(v.delivery.delivered.at)}
        </span>
      </p>
    );
  const blockers = handoverBlockers(v);
  const locked = blockers.length > 0;

  function handover() {
    if (!confirm(`Confirm ${v.sale?.customer.name} has taken delivery of the ${v.make} ${v.model}?`)) return;
    run(() => recordHandover(v.id), "Handover recorded. Vehicle delivered.").then((ok) => ok && celebrate());
  }

  return (
    <div>
      {can("delivery.handover") ? (
        <Button variant={locked ? "secondary" : "primary"} disabled={locked || busy} onClick={handover} aria-label={locked ? "Handover locked" : "Record handover"}>
          {locked ? <Lock className="size-4" /> : <KeyRound className="size-4" />}
          {locked ? "Handover locked" : "Record handover"}
        </Button>
      ) : (
        <Pill tone="neutral" icon={locked ? <Lock className="size-3.5" /> : <KeyRound className="size-3.5" />}>
          {locked ? "Handover locked" : "Ready for handover by sales"}
        </Pill>
      )}
      {/* Release blockers are listed under the release step; here only what is specific to handover. */}
      <BlockerList reasons={blockers.filter((r) => !releaseBlockers(v).includes(r))} />
    </div>
  );
}
