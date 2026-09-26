"use client";

import { useMemo } from "react";
import { Bike, ChartColumn, IndianRupee, TrendingUp } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { BranchPerformancePanel } from "@/components/panels/branch-performance";
import { StockAgeingPanel } from "@/components/panels/stock-ageing";
import { AgeingVehiclesPanel, SalesByMonthPanel, SalesByVehiclePanel, useSoldVehicles } from "@/components/panels/sales-report";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { BRANCHES } from "@/lib/masters";
import { formatSignedPaise, isSold } from "@/lib/finance";
import { formatPaise } from "@/lib/format";
import { landedCostPaise, marginPaise } from "@/lib/workflow";

export default function ReportsPage() {
  const { role, inScope } = useRole();
  const { vehicles } = useScopedVehicles();
  const { sold } = useSoldVehicles();
  const k = useMemo(() => {
    const revenue = sold.reduce((s, v) => s + (v.sale?.salePricePaise ?? 0), 0);
    const margin = sold.reduce((s, v) => s + (marginPaise(v) ?? 0), 0);
    const unsold = vehicles.filter((v) => !isSold(v));
    return { revenue, margin, units: sold.length, unsold: unsold.length, stock: unsold.reduce((s, v) => s + landedCostPaise(v), 0) };
  }, [sold, vehicles]);
  const branches = BRANCHES.filter((b) => b.id !== "ang" && inScope(b.id)).map((b) => b.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title={role === "partner" ? "Branch business performance" : "Executive reports"}
        icon={<ChartColumn className="size-6 text-brand" />}
        description={role === "partner" ? `${branches.join(" & ")} · vehicles sourced by your branches` : "All branches · every table exports to CSV (amounts in rupees)"}
      />
      <KpiGrid>
        <KpiCard label="Vehicles sold" value={k.units} icon={<Bike />} />
        <KpiCard label="Revenue" value={formatPaise(k.revenue)} icon={<IndianRupee />} />
        <KpiCard label="Margin" value={formatSignedPaise(k.margin)} hint={k.revenue ? `${((k.margin / k.revenue) * 100).toFixed(1)}% of revenue` : undefined} icon={<TrendingUp />} />
        <KpiCard label="Unsold stock" value={formatPaise(k.stock)} hint={`${k.unsold} vehicles at landed cost`} />
      </KpiGrid>
      <BranchPerformancePanel />
      <StockAgeingPanel />
      <SalesByMonthPanel />
      <SalesByVehiclePanel />
      <AgeingVehiclesPanel />
    </div>
  );
}
