"use client";

import Link from "next/link";
import { Boxes, IndianRupee, Siren, Store, Truck } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { useEscalations } from "@/lib/use-escalations";
import { formatPaise } from "@/lib/format";
import { istDate } from "@/lib/working-days";
import { landedCostPaise, marginPaise } from "@/lib/workflow";
import { KpiCard, KpiGrid, PageHeader, Panel } from "@/components/ui";
import { EscalationList } from "@/components/panels/escalation-list";
import { PipelineBoard } from "@/components/panels/pipeline-board";
import { HrOverview } from "@/components/panels/hr-overview";
import { CashFlowChart } from "@/components/panels/cash-flow-chart";
import { BranchPerformancePanel } from "@/components/panels/branch-performance";

export default function ProprietorDashboard() {
  const { user } = useRole();
  const { vehicles } = useScopedVehicles();
  const { items: escalations, now } = useEscalations();

  const unsold = vehicles.filter((v) => !v.sale);
  const onDisplay = unsold.filter((v) => v.gate);
  const pipeline = unsold.filter((v) => !v.gate);
  const month = istDate(now).slice(0, 7);
  const soldThisMonth = vehicles.filter((v) => v.sale?.soldAt && istDate(v.sale.soldAt).slice(0, 7) === month);
  const revenue = soldThisMonth.reduce((s, v) => s + (v.sale!.salePricePaise ?? 0), 0);
  const margin = soldThisMonth.reduce((s, v) => s + (marginPaise(v) ?? 0), 0);
  const critical = escalations.filter((e) => e.severity === "critical").length;
  const codeRed = escalations.filter((e) => e.kind === "code_red").length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Good day, ${user.name.split(" ")[0]}`} description="All branches, all modules. Figures update as your team works." />

      <KpiGrid>
        <KpiCard
          label="Stock on hand"
          value={unsold.length}
          icon={<Boxes />}
          hint={`${formatPaise(unsold.reduce((s, v) => s + landedCostPaise(v), 0))} at landed cost`}
          href="/stock"
        />
        <KpiCard label="On display" value={onDisplay.length} icon={<Store />} hint={`${pipeline.length} still in the pipeline`} href="/verified" />
        <KpiCard label="Sales this month" value={formatPaise(revenue)} icon={<IndianRupee />} hint={`${soldThisMonth.length} vehicles · margin ${formatPaise(margin)}`} href="/reports" />
        <KpiCard
          label="Critical escalations"
          value={critical}
          tone={critical ? "danger" : "ok"}
          icon={<Siren />}
          hint={codeRed ? `${codeRed} Code Red deliveries` : "No Code Red deliveries"}
          href="/escalations"
        />
      </KpiGrid>

      <div className="grid gap-6">
        <Panel
          flush
          title="Escalations"
          description="Code Red and SLA breaches, most urgent first"
          actions={
            <Link href="/escalations" className="text-sm font-medium text-brand hover:underline">
              View all {escalations.length}
            </Link>
          }
        >
          <EscalationList items={escalations} limit={6} />
        </Panel>
        <Panel flush title="Vehicle workflow" description="Where every vehicle is right now" actions={<Truck className="size-4 text-muted" />}>
          <PipelineBoard />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CashFlowChart title="Cash flow, all branches" />
        <BranchPerformancePanel />
      </div>

      <HrOverview title="HR overview" />
    </div>
  );
}
