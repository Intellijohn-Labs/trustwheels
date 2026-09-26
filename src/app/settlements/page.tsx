"use client";

import { ArrowLeftRight, CircleCheck, TriangleAlert } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { RecordSettlementButton, SettlementHistoryPanel, SettlementPositionPanel, useBranchPositions } from "@/components/panels/settlement-position";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";

export default function SettlementsPage() {
  const { role, roleDef } = useRole();
  const { positions, outstandingPaise } = useBranchPositions();
  const due = positions.reduce((s, p) => s + p.duePaise, 0);
  const settled = positions.reduce((s, p) => s + p.settledPaise, 0);
  const single = positions.length === 1 ? positions[0] : undefined;

  const description =
    role === "branch_accountant"
      ? `Amount due from Angamaly to ${single?.name ?? "your branch"}: the purchase value of vehicles you paid for that Angamaly has received, less settlements.`
      : role === "partner"
        ? `Settlement position for your branches (${positions.map((p) => p.name).join(", ")}).`
        : "What Angamaly owes each branch for vehicles received at the hub, and what has been settled.";

  return (
    <div className="space-y-6">
      <PageHeader title="Settlements" icon={<ArrowLeftRight className="size-6 text-brand" />} description={description} actions={<RecordSettlementButton size="md" />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="col-span-2 lg:col-span-1">
          <KpiCard
            label={single ? "Amount due from Angamaly" : "Outstanding from Angamaly"}
            value={formatPaise(outstandingPaise)}
            hint={outstandingPaise > 0 ? `${positions.filter((p) => p.outstandingPaise > 0).length} branch${positions.filter((p) => p.outstandingPaise > 0).length === 1 ? "" : "es"} waiting` : "Fully settled"}
            icon={outstandingPaise > 0 ? <TriangleAlert /> : <CircleCheck />}
            tone={outstandingPaise > 0 ? "warn" : "neutral"}
          />
        </div>
        <KpiCard label="Total due (received vehicles)" value={formatPaise(due)} />
        <KpiCard label="Settled to date" value={formatPaise(settled)} />
      </div>
      <SettlementPositionPanel title={single ? `${single.name} position` : roleDef.scope === "all" ? "Branch-wise position" : "Your branches"} />
      <SettlementHistoryPanel />
    </div>
  );
}
