"use client";

import { Banknote, Bike, PiggyBank } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { ContributionsPanel, FundPositionPanel, useFundPositions } from "@/components/panels/fund-position";
import { useRole } from "@/lib/role-context";
import { formatPaise } from "@/lib/format";

export default function FundsPage() {
  const { rows } = useFundPositions();
  const { roleDef, user, role } = useRole();
  const capital = rows.reduce((s, r) => s + r.capitalPaise, 0);
  const stock = rows.reduce((s, r) => s + r.stockPaise, 0);
  const units = rows.reduce((s, r) => s + r.stockUnits, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funds & cash flow"
        icon={<PiggyBank className="size-6 text-brand" />}
        description={role === "partner" ? `${user.name}'s capital and where it sits, for your branches` : roleDef.scope === "all" ? "Capital and stock across the group" : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Capital invested" value={formatPaise(capital)} icon={<Banknote />} />
        <KpiCard label="Deployed in stock" value={formatPaise(stock)} hint={`${units} unsold vehicles at landed cost`} icon={<Bike />} />
      </div>
      <FundPositionPanel />
      <ContributionsPanel />
    </div>
  );
}
