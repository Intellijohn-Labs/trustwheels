"use client";

import { ArrowLeftRight, CircleCheck, Hourglass, Landmark, Wallet } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { PayoutApprovalPanel, usePayoutSummary } from "@/components/panels/payout-queue";
import { FeeRequestsPanel, useFeeSummary } from "@/components/panels/fee-requests";
import { SettlementPositionPanel, useBranchPositions } from "@/components/panels/settlement-position";
import { SignedAmount } from "@/components/panels/ledger-table";
import { totals, useScopedLedger } from "@/lib/finance";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { formatPaise } from "@/lib/format";
import { istDate } from "@/lib/working-days";

export default function CentralAccountantDashboard() {
  const { user, roleDef } = useRole();
  const p = usePayoutSummary();
  const f = useFeeSummary();
  const { outstandingPaise, positions } = useBranchPositions();
  const { entries } = useScopedLedger();
  const now = useNow(60_000);
  const today = totals(entries.filter((e) => istDate(e.at) === istDate(now)));
  const feesPending = f.requested.count + f.approved.count;

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        <KpiCard label="Settlements outstanding" value={formatPaise(outstandingPaise)} hint={`${positions.filter((x) => x.outstandingPaise > 0).length} branches waiting`} icon={<ArrowLeftRight />} href="/settlements" />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard label="Today's net cash" value={<SignedAmount paise={today.netPaise} />} hint={`In ${formatPaise(today.inPaise)} · out ${formatPaise(today.outPaise)}`} icon={<Wallet />} href="/ledger" />
        </div>
      </div>
      <PayoutApprovalPanel />
      <FeeRequestsPanel limit={5} />
      <SettlementPositionPanel />
    </div>
  );
}
