"use client";

import { CircleCheck, Hourglass, Landmark } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { PayoutApprovalPanel, usePayoutSummary } from "@/components/panels/payout-queue";
import { FeeRequestsPanel, useFeeSummary } from "@/components/panels/fee-requests";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";

export default function CentralAccountantDashboard() {
  const { user, roleDef } = useRole();
  const p = usePayoutSummary();
  const f = useFeeSummary();
  const feesPending = f.requested.count + f.approved.count;

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Payouts awaiting approval"
          value={p.requested.count}
          hint={p.requested.count ? `${formatPaise(p.requested.paise)}${p.overdue.count ? ` · ${p.overdue.count} overdue` : ""}` : "Queue clear"}
          icon={<Hourglass />}
          tone={p.overdue.count ? "danger" : p.requested.count ? "warn" : "neutral"}
          href="/payments"
        />
        <KpiCard label="Approved, unpaid" value={p.approved.count} hint={p.approved.count ? formatPaise(p.approved.paise) : "Nothing to pay"} icon={<CircleCheck />} href="/payments" />
        <KpiCard label="RTO fees pending" value={feesPending} hint={feesPending ? formatPaise(f.requested.paise + f.approved.paise) : "None waiting"} icon={<Landmark />} tone={feesPending ? "warn" : "neutral"} href="/fees" />
      </div>
      <PayoutApprovalPanel />
      <FeeRequestsPanel limit={5} />
    </div>
  );
}
