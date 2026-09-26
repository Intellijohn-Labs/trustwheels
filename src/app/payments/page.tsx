"use client";

import { BadgeIndianRupee, CircleCheck, Clock, Hourglass, TriangleAlert, Wallet } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { PayoutApprovalPanel, PurchaseEntryPanel, SellerPaymentTracker, usePayoutSummary } from "@/components/panels/payout-queue";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";
import { SLA } from "@/lib/masters";

export default function PaymentsPage() {
  const { can, roleDef } = useRole();
  const s = usePayoutSummary();
  const scope = roleDef.scope === "all" ? "All branches" : "Your branch";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seller payments"
        icon={<Wallet className="size-6 text-brand" />}
        description={`${scope} · sellers must be paid within ${SLA.sellerPaymentWorkingDays} working days of cross-verification`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Awaiting purchase entry" value={s.awaitingEntry.count} hint={formatPaise(s.awaitingEntry.paise) + " agreed"} icon={<BadgeIndianRupee />} />
        <KpiCard label="Awaiting approval" value={s.requested.count} hint={formatPaise(s.requested.paise)} icon={<Hourglass />} tone={s.requested.count ? "brand" : "neutral"} />
        <KpiCard label="Approved, unpaid" value={s.approved.count} hint={formatPaise(s.approved.paise)} icon={<CircleCheck />} tone={s.approved.count ? "brand" : "neutral"} />
        <KpiCard label="Due in ≤2 working days" value={s.dueSoon.count} hint={s.dueSoon.count ? `${formatPaise(s.dueSoon.paise)} · pay soon` : "Nothing due soon"} icon={<Clock />} tone={s.dueSoon.count ? "warn" : "neutral"} />
<div className="col-span-2 lg:col-span-1">
        <KpiCard label="Overdue" value={s.overdue.count} hint={s.overdue.count ? `${formatPaise(s.overdue.paise)} · past the commitment` : "None overdue"} icon={<TriangleAlert />} tone={s.overdue.count ? "danger" : "neutral"} />
        </div>
      </div>

      {can("purchase.enter") && <PurchaseEntryPanel />}
      {can("payout.approve") && <PayoutApprovalPanel />}
      <SellerPaymentTracker />
    </div>
  );
}
