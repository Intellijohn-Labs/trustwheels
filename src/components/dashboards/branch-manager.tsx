"use client";

import Link from "next/link";
import { AlertTriangle, CalendarPlus, Clock, Plus, ShieldAlert, Truck } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { verifyState } from "@/lib/verification";
import { inTransit, transitBreached } from "@/lib/workflow";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { InTransitPanel, ReadyToDispatchPanel, awaitingDispatch } from "@/components/panels/transit-panel";

const WEEK = 7 * 24 * 3_600_000;

export default function BranchManagerDashboard() {
  const { user, roleDef } = useRole();
  const { vehicles } = useScopedVehicles();
  const now = useNow(30_000);

  const enteredThisWeek = vehicles.filter((v) => now - new Date(v.createdAt).getTime() < WEEK).length;
  const unverified = vehicles.filter((v) => verifyState(v, now) !== "verified");
  const overdue = unverified.filter((v) => verifyState(v, now) === "overdue").length;
  const readyToDispatch = vehicles.filter((v) => awaitingDispatch(v) && v.verified).length;
  const transit = vehicles.filter(inTransit);
  const breached = transit.filter((v) => transitBreached(v, now)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={roleDef.description}
        actions={
          <>
            <Link href="/overdue" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold hover:bg-sunken">
              <Clock className="size-4" /> Overdue
            </Link>
            <Link href="/stock/new" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-sm font-semibold text-surface hover:brightness-110">
              <Plus className="size-4" /> Add stock
            </Link>
          </>
        }
      />
      <KpiGrid>
        <KpiCard label="Entered this week" value={enteredThisWeek} hint="Last 7 days" icon={<CalendarPlus />} href="/stock" />
        <KpiCard
          label="Awaiting verification"
          value={unverified.length}
          hint={overdue ? `${overdue} overdue` : "None overdue"}
          icon={overdue ? <AlertTriangle /> : <ShieldAlert />}
          tone={overdue ? "danger" : "neutral"}
          href="/overdue"
        />
        <KpiCard label="Ready to dispatch" value={readyToDispatch} hint="Verified, still at the branch" icon={<Truck />} href="/transit" />
        <KpiCard
          label="In transit"
          value={transit.length}
          hint={breached ? `${breached} breached the time limit` : "All within the time limit"}
          icon={breached ? <AlertTriangle /> : <Truck />}
          tone={breached ? "danger" : "neutral"}
          href="/transit"
        />
      </KpiGrid>
      <ReadyToDispatchPanel limit={6} />
      <InTransitPanel />
    </div>
  );
}
