"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck, Siren, Timer } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { useEscalations } from "@/lib/use-escalations";
import { awaitingGate, isCodeRed, releaseBlockers } from "@/lib/workflow";
import { KpiCard, KpiGrid, PageHeader, Panel } from "@/components/ui";
import { EscalationList } from "@/components/panels/escalation-list";
import { QualityGatePanel } from "@/components/panels/quality-gate-panel";
import { ReleaseQueue } from "@/components/panels/release-queue";

/** Angamaly gatekeeper: quality gate, final delivery release, system-wide SLA and Code Red monitor. */
export default function GateManagerDashboard() {
  const { user } = useRole();
  const { vehicles } = useScopedVehicles();
  const { items: escalations, now } = useEscalations();

  const atGate = vehicles.filter(awaitingGate).length;
  const awaitingRelease = vehicles.filter((v) => v.sale?.status === "sold" && !v.delivery?.released);
  const releasable = awaitingRelease.filter((v) => releaseBlockers(v).length === 0).length;
  const codeRed = vehicles.filter((v) => isCodeRed(v, now)).length;
  const breaches = escalations.filter((e) => e.kind !== "code_red").length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Good day, ${user.name.split(" ")[0]}`} description="Quality gate, final release before delivery, and every SLA alert across the group." />

      <KpiGrid>
        <KpiCard label="Waiting at quality gate" value={atGate} icon={<ShieldCheck />} tone={atGate ? "warn" : "neutral"} hint={atGate ? "Signed off by the supervisor" : "Queue is clear"} href="/quality-gate" />
        <KpiCard
          label="Awaiting final release"
          value={awaitingRelease.length}
          icon={<KeyRound />}
          hint={`${releasable} ready · ${awaitingRelease.length - releasable} locked until transfer is confirmed`}
          href="/deliveries"
        />
        <KpiCard label="Code Red deliveries" value={codeRed} icon={<Siren />} tone={codeRed ? "danger" : "ok"} hint={`Sold more than 4 days ago, not delivered`} href="/deliveries" />
        <KpiCard label="Other SLA breaches" value={breaches} icon={<Timer />} tone={breaches ? "warn" : "ok"} hint="Transit, RED flags, follow-ups, payments" href="/escalations" />
      </KpiGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <QualityGatePanel limit={3} compact />
        <ReleaseQueue limit={5} />
      </div>

      <Panel
        flush
        title="SLA & Code Red monitor"
        description="All open escalations, most urgent first"
        actions={
          <Link href="/escalations" className="text-sm font-medium text-brand hover:underline">
            View all {escalations.length}
          </Link>
        }
      >
        <EscalationList items={escalations} limit={8} />
      </Panel>
    </div>
  );
}
