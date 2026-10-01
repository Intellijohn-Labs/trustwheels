"use client";

import { AlertTriangle, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { SLA } from "@/lib/masters";
import { awaitingGate, inRecon, reconFlag } from "@/lib/workflow";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { ReconQueuePanel, redCounts } from "@/components/panels/recon-panel";

export default function SupervisorDashboard() {
  const { user, roleDef } = useRole();
  const { vehicles } = useScopedVehicles();
  const now = useNow(30_000);

  const queue = vehicles.filter(inRecon);
  const red48 = queue.filter((v) => reconFlag(v, now) === "red48").length;
  const red72 = queue.filter((v) => reconFlag(v, now) === "red72").length;
  const atGate = queue.filter(awaitingGate).length;
  const mine = redCounts(vehicles, now).find((r) => r.name === user.name);

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />
      <KpiGrid>
        <KpiCard label="In reconditioning" value={queue.length} hint={`${atGate} signed off`} icon={<Wrench />} href="/recon" />
        <KpiCard
          label={`RED ${SLA.reconAmberHours}h`}
          value={red48}
          hint={red48 ? `Over ${SLA.reconAmberHours} hours since stock entry` : "None"}
          icon={<AlertTriangle />}
          tone={red48 ? "warn" : "neutral"}
          href="/recon"
        />
        <KpiCard
          label={`RED ${SLA.reconRedHours}h`}
          value={red72}
          hint={red72 ? `Over ${SLA.reconRedHours} hours since stock entry` : "None"}
          icon={<AlertTriangle />}
          tone={red72 ? "danger" : "neutral"}
          href="/recon"
        />
        <KpiCard label="Waiting for quality gate" value={atGate} hint="Signed off, awaiting the manager" icon={<ShieldCheck />} />
        <KpiCard
          label="My RED count"
          value={mine?.red ?? 0}
          hint={mine ? `${mine.inQueue} vehicles assigned to you` : "No vehicles assigned to you"}
          icon={mine?.red ? <AlertTriangle /> : <UserRound />}
          tone={mine?.red72 ? "danger" : mine?.red ? "warn" : "neutral"}
        />
      </KpiGrid>
      <ReconQueuePanel compact />
    </div>
  );
}
