"use client";

import { ArrowLeftRight, BadgeIndianRupee, Clock, TriangleAlert } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { PurchaseEntryPanel, SellerPaymentTracker, usePayoutSummary } from "@/components/panels/payout-queue";
import { useBranchPositions } from "@/components/panels/settlement-position";
import { useRole } from "@/lib/role-context";
import { branchName } from "@/lib/masters";
import { formatPaise } from "@/lib/format";

export default function BranchAccountantDashboard() {
  const { user, roleDef } = useRole();
  const s = usePayoutSummary();
  const { outstandingPaise, positions } = useBranchPositions();
  const branch = roleDef.scope === "all" ? "All branches" : roleDef.scope.map(branchName).join(", ");

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`${branch} · ${roleDef.description}`} />
      <KpiGrid>
        <KpiCard label="Purchase entries pending" value={s.awaitingEntry.count} hint={s.awaitingEntry.count ? `${formatPaise(s.awaitingEntry.paise)} agreed` : "All entered"} icon={<BadgeIndianRupee />} href="/payments" />
        <KpiCard label="Seller payments due ≤2 working days" value={s.dueSoon.count} hint={s.dueSoon.count ? formatPaise(s.dueSoon.paise) : "Nothing due soon"} icon={<Clock />} tone={s.dueSoon.count ? "warn" : "neutral"} href="/payments" />
        <KpiCard label="Seller payments overdue" value={s.overdue.count} hint={s.overdue.count ? `${formatPaise(s.overdue.paise)} · chase central accounts` : "None overdue"} icon={<TriangleAlert />} tone={s.overdue.count ? "danger" : "neutral"} href="/payments" />
        <KpiCard
          label="Amount due from Angamaly"
          value={formatPaise(outstandingPaise)}
          hint={`${positions.reduce((n, p) => n + p.vehicles, 0)} vehicles received at the hub`}
          icon={<ArrowLeftRight />}
          href="/settlements"
        />
      </KpiGrid>
      <PurchaseEntryPanel limit={6} />
      <SellerPaymentTracker limit={8} />
    </div>
  );
}
