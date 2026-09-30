"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { VERIFY_LIMIT_HOURS } from "@/lib/masters";
import { verifyDeadline, verifyState } from "@/lib/verification";
import { VehicleRow } from "@/components/vehicle-row";
import { VerifyButton } from "@/components/verify-button";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";

export default function OverduePage() {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow();

  const byDeadline = [...vehicles].sort((a, b) => verifyDeadline(a) - verifyDeadline(b));
  const overdue = byDeadline.filter((v) => verifyState(v, now) === "overdue");
  const pending = byDeadline.filter((v) => verifyState(v, now) === "pending");

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-danger">
            <AlertTriangle className="size-6" /> Not verified in time
          </h1>
          <p className="text-sm text-muted">
            Added more than {VERIFY_LIMIT_HOURS} hours ago and still not verified. Verify a vehicle once it has been checked.
          </p>
        </div>
        {ready && overdue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            Nothing overdue. Every vehicle was verified within {VERIFY_LIMIT_HOURS} hours.
          </div>
        ) : (
          <ul className="divide-y divide-danger/20 overflow-hidden rounded-2xl border border-danger/40 bg-surface">
            {overdue.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                now={now}
                actions={
                  <>
                    <VerifyButton vehicle={v} />
                    <DeleteVehicleButton vehicle={v} />
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-5 text-brand" /> Awaiting verification
          </h2>
          <p className="text-sm text-muted">Timer running. These turn red if not verified before the countdown ends.</p>
        </div>
        {ready && pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            No vehicles waiting. <Link href="/stock/new" className="text-brand underline">Add stock</Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {pending.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                now={now}
                actions={
                  <>
                    <VerifyButton vehicle={v} />
                    <DeleteVehicleButton vehicle={v} />
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
