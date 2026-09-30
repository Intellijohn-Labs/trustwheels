"use client";

import { useMemo } from "react";
import { Banknote, Bike, IndianRupee, TrendingUp } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/ui";
import { BranchPerformancePanel } from "@/components/panels/branch-performance";
import { useFundPositions } from "@/components/panels/fund-position";
import { useSoldVehicles } from "@/components/panels/sales-report";
import { formatSignedPaise, monthKey, monthLabel } from "@/lib/finance";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { branchName } from "@/lib/masters";
import { formatPaise } from "@/lib/format";
import { marginPaise } from "@/lib/workflow";

export default function PartnerDashboard() {
  const { user, roleDef } = useRole();
  const { rows } = useFundPositions();
  const { sold } = useSoldVehicles();
  const now = useNow(300_000);
  const month = monthKey(new Date(now).toISOString());
  const m = useMemo(() => {
    const thisMonth = sold.filter((v) => monthKey(v.sale!.soldAt!) === month);
    return { units: thisMonth.length, revenue: thisMonth.reduce((s, v) => s + (v.sale?.salePricePaise ?? 0), 0), margin: thisMonth.reduce((s, v) => s + (marginPaise(v) ?? 0), 0) };
  }, [sold, month]);
  const branches = rows.filter((r) => r.branchId !== "ang");
  const capital = branches.reduce((s, r) => s + r.capitalPaise, 0);
  const stock = branches.reduce((s, r) => s + r.stockPaise, 0);
  const units = branches.reduce((s, r) => s + r.stockUnits, 0);
  const scope = roleDef.scope === "all" ? "All branches" : roleDef.scope.map(branchName).join(" & ");

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`${scope} · ${roleDef.description}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Capital invested" value={formatPaise(capital)} icon={<Banknote />} href="/funds" />
        <KpiCard label="Stock value" value={formatPaise(stock)} hint={`${units} unsold at landed cost`} icon={<Bike />} href="/reports" />
        <KpiCard label="Sales this month" value={formatPaise(m.revenue)} hint={`${m.units} vehicle${m.units === 1 ? "" : "s"} · ${monthLabel(month)}`} icon={<IndianRupee />} href="/reports" />
        <KpiCard label="Margin this month" value={formatSignedPaise(m.margin)} hint={m.revenue ? `${((m.margin / m.revenue) * 100).toFixed(1)}% of sales` : "No sales yet"} icon={<TrendingUp />} href="/reports" />
      </div>
      <BranchPerformancePanel />
    </div>
  );
}
