"use client";

import { AlertTriangle, PackageCheck, ShieldAlert, Truck } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { SLA } from "@/lib/masters";
import { verifyState } from "@/lib/verification";
import { inTransit, transitBreached } from "@/lib/workflow";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { ArrivingPanel, ReceivedPanel, receivedToday } from "@/components/panels/receiving-panel";

export default function HubAdminDashboard() {
  const { user, roleDef } = useRole();
  const { vehicles } = useScopedVehicles();
  const now = useNow(30_000);

  const arriving = vehicles.filter(inTransit);
  const breached = arriving.filter((v) => transitBreached(v, now)).length;
  const today = vehicles.filter((v) => receivedToday(v, now)).length;
  const unverified = vehicles.filter((v) => verifyState(v, now) !== "verified");
  const overdue = unverified.filter((v) => verifyState(v, now) === "overdue").length;

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />
      <KpiGrid>
        <KpiCard label="Arriving" value={arriving.length} hint="Dispatched, not yet received" icon={<Truck />} href="/receiving" />
        <KpiCard
          label="Breached transit"
          value={breached}
          hint={breached ? `Over ${SLA.transitHours} hours on the road` : "None over the limit"}
          icon={breached ? <AlertTriangle /> : <Truck />}
          tone={breached ? "danger" : "neutral"}
          href="/transit"
        />
        <KpiCard label="Received today" value={today} hint="Booked into stock" icon={<PackageCheck />} />
        <KpiCard
          label="Awaiting verification"
          value={unverified.length}
          hint={overdue ? `${overdue} overdue` : "None overdue"}
          icon={overdue ? <AlertTriangle /> : <ShieldAlert />}
          tone={overdue ? "danger" : "neutral"}
          href="/overdue"
        />
      </KpiGrid>
      <ArrivingPanel />
      <ReceivedPanel limit={5} />
    </div>
  );
}
