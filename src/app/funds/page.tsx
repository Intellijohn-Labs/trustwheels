"use client";

import { Banknote, Bike, PiggyBank, Wallet } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { CashFlowChart } from "@/components/panels/cash-flow-chart";
import { ContributionsPanel, FundPositionPanel, useFundPositions } from "@/components/panels/fund-position";
import { SignedAmount } from "@/components/panels/ledger-table";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";

export default function FundsPage() {
  const { rows } = useFundPositions();
  const { roleDef, user, role } = useRole();
  const capital = rows.reduce((s, r) => s + r.capitalPaise, 0);
  const stock = rows.reduce((s, r) => s + r.stockPaise, 0);
  const units = rows.reduce((s, r) => s + r.stockUnits, 0);
  const cash = rows.reduce((s, r) => s + r.cashPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funds & cash flow"
        icon={<PiggyBank className="size-6 text-brand" />}
        description={role === "partner" ? `${user.name}'s capital and where it sits, for your branches` : roleDef.scope === "all" ? "Capital, stock and cash across the group" : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Capital invested" value={formatPaise(capital)} icon={<Banknote />} />
        <KpiCard label="Deployed in stock" value={formatPaise(stock)} hint={`${units} unsold vehicles at landed cost`} icon={<Bike />} />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard label="Cash position" value={<SignedAmount paise={cash} />} hint="Capital plus ledger movements" icon={<Wallet />} />
        </div>
      </div>
      <FundPositionPanel />
      <CashFlowChart />
      <ContributionsPanel />
    </div>
  );
}
