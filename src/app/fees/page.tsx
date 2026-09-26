"use client";

import { CircleCheck, Clock, Landmark } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { FeeRequestsPanel, useFeeSummary } from "@/components/panels/fee-requests";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";

export default function FeesPage() {
  const s = useFeeSummary();
  const { can } = useRole();
  return (
    <div className="space-y-6">
      <PageHeader
        title="RTO & transfer fees"
        icon={<Landmark className="size-6 text-brand" />}
        description={can("fees.manage") ? "Approve fee requests from sales, then pay them. Paying posts to the ledger and ticks the transfer checklist." : "Fee requests raised by sales for ownership transfer. View only."}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Awaiting approval" value={s.requested.count} hint={formatPaise(s.requested.paise)} icon={<Clock />} tone={s.requested.count ? "warn" : "neutral"} />
        <KpiCard label="Approved, unpaid" value={s.approved.count} hint={formatPaise(s.approved.paise)} icon={<Clock />} tone={s.approved.count ? "brand" : "neutral"} />
        <KpiCard label="Paid" value={s.paid.count} hint={formatPaise(s.paid.paise)} icon={<CircleCheck />} />
      </div>
      <FeeRequestsPanel />
    </div>
  );
}
