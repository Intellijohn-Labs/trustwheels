"use client";

import { useMemo } from "react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { BRANCHES, branchName } from "@/lib/masters";
import { branchPerformance, formatSignedPaise, type BranchPerformance } from "@/lib/finance";
import { formatPaise } from "@/lib/format";
import { rupees, type CsvColumn } from "@/lib/csv";
import { DataTable } from "../data-table";
import { Panel } from "../ui";
import { CsvButton } from "./csv-button";

const csv: CsvColumn<BranchPerformance>[] = [
  { header: "Branch", value: (r) => branchName(r.branchId) },
  { header: "Acquired", value: (r) => r.acquired },
  { header: "Sold", value: (r) => r.sold },
  { header: "In stock", value: (r) => r.inStock },
  { header: "Revenue (INR)", value: (r) => rupees(r.revenuePaise) },
  { header: "Margin (INR)", value: (r) => rupees(r.marginPaise) },
  { header: "Avg days to sell", value: (r) => (r.avgDaysToSell == null ? "" : r.avgDaysToSell.toFixed(1)) },
];

/** Per source branch: acquired, sold, revenue, margin, average days from entry to sale. */
export function BranchPerformancePanel({ title = "Branch performance", description }: { title?: string; description?: string }) {
  const { vehicles, ready } = useScopedVehicles();
  const { inScope } = useRole();
  const rows = useMemo(
    () =>
      branchPerformance(
        vehicles,
        BRANCHES.filter((b) => b.id !== "ang" && inScope(b.id)).map((b) => b.id),
      ),
    [vehicles, inScope],
  );
  const total = rows.reduce(
    (t, r) => ({ acquired: t.acquired + r.acquired, sold: t.sold + r.sold, revenuePaise: t.revenuePaise + r.revenuePaise, marginPaise: t.marginPaise + r.marginPaise }),
    { acquired: 0, sold: 0, revenuePaise: 0, marginPaise: 0 },
  );

  return (
    <Panel
      flush
      title={title}
      description={description ?? `${total.acquired} acquired · ${total.sold} sold · ${formatPaise(total.revenuePaise)} revenue · ${formatSignedPaise(total.marginPaise)} margin`}
      actions={<CsvButton filename="branch-performance" rows={rows} columns={csv} />}
    >
      <DataTable
        rows={ready ? rows : []}
        rowKey={(r) => r.branchId}
        empty={ready ? "No branches in your scope." : "Loading…"}
        columns={[
          { header: "Branch", cell: (r) => <span className="font-medium">{branchName(r.branchId)}</span> },
          { header: "Acquired", align: "right", cell: (r) => r.acquired },
          { header: "Sold", align: "right", cell: (r) => r.sold },
          { header: "In stock", align: "right", cell: (r) => r.inStock },
          { header: "Revenue", align: "right", cell: (r) => formatPaise(r.revenuePaise) },
          { header: "Margin", align: "right", cell: (r) => <span className="font-semibold">{formatSignedPaise(r.marginPaise)}</span> },
          { header: "Avg days to sell", align: "right", cell: (r) => (r.avgDaysToSell == null ? <span className="text-muted">–</span> : `${r.avgDaysToSell.toFixed(1)} days`) },
        ]}
      />
    </Panel>
  );
}
