"use client";

import { useMemo } from "react";
import { funds, type Contribution } from "@/lib/funds";
import { isSold, useScopedLedger } from "@/lib/finance";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { BRANCHES, branchName } from "@/lib/masters";
import { landedCostPaise } from "@/lib/workflow";
import { formatDate, formatPaise } from "@/lib/format";
import { csvDate, rupees, type CsvColumn } from "@/lib/csv";
import { DataTable } from "../data-table";
import { Panel } from "../ui";
import { CsvButton } from "./csv-button";
import { SignedAmount } from "./ledger-table";

export interface FundRow {
  branchId: string;
  capitalPaise: number;
  /** Unsold vehicles from this branch, at landed cost (wherever they are now). */
  stockPaise: number;
  stockUnits: number;
  /** Capital plus every ledger movement booked to the branch. */
  cashPaise: number;
}

/** Capital, stock deployed and cash position per branch in the role's scope. */
export function useFundPositions() {
  const { items, ready: fReady } = funds.useItems();
  const { entries, ready: lReady } = useScopedLedger();
  const { vehicles, ready: vReady } = useScopedVehicles();
  const { inScope } = useRole();
  const rows = useMemo<FundRow[]>(
    () =>
      BRANCHES.filter((b) => inScope(b.id)).map((b) => {
        const stock = vehicles.filter((v) => v.branchId === b.id && !isSold(v));
        const capitalPaise = items.filter((c) => c.branchId === b.id).reduce((s, c) => s + c.amountPaise, 0);
        // "capital" ledger entries would duplicate the contributions list, so they're skipped here.
        const movement = entries.filter((e) => e.branchId === b.id && e.type !== "capital").reduce((s, e) => s + e.amountPaise, 0);
        return { branchId: b.id, capitalPaise, stockPaise: stock.reduce((s, v) => s + landedCostPaise(v), 0), stockUnits: stock.length, cashPaise: capitalPaise + movement };
      }),
    [items, entries, vehicles, inScope],
  );
  const contributions = useMemo(() => items.filter((c) => inScope(c.branchId)).sort((a, b) => b.at.localeCompare(a.at)), [items, inScope]);
  return { rows, contributions, ready: fReady && lReady && vReady };
}

const csv: CsvColumn<FundRow>[] = [
  { header: "Branch", value: (r) => branchName(r.branchId) },
  { header: "Capital in (INR)", value: (r) => rupees(r.capitalPaise) },
  { header: "Unsold vehicles", value: (r) => r.stockUnits },
  { header: "Deployed in stock at landed cost (INR)", value: (r) => rupees(r.stockPaise) },
  { header: "Cash position (INR)", value: (r) => rupees(r.cashPaise) },
];

export function FundPositionPanel() {
  const { rows, ready } = useFundPositions();
  return (
    <Panel
      flush
      title="Fund tracking by branch"
      description="Capital in · deployed in unsold stock (landed cost, including vehicles now at Angamaly) · cash = capital + ledger movements"
      actions={<CsvButton filename="fund-positions" rows={rows} columns={csv} />}
    >
      <DataTable
        rows={ready ? rows : []}
        rowKey={(r) => r.branchId}
        empty={ready ? "No branches in your scope." : "Loading…"}
        columns={[
          { header: "Branch", cell: (r) => <span className="font-medium">{branchName(r.branchId)}</span> },
          { header: "Capital in", align: "right", cell: (r) => formatPaise(r.capitalPaise) },
          {
            header: "Deployed in stock",
            align: "right",
            cell: (r) => (
              <span className="flex flex-col items-end">
                {formatPaise(r.stockPaise)}
                <span className="text-xs text-muted">
                  {r.stockUnits} vehicle{r.stockUnits === 1 ? "" : "s"}
                  {r.capitalPaise > 0 && ` · ${Math.round((r.stockPaise / r.capitalPaise) * 100)}% of capital`}
                </span>
              </span>
            ),
          },
          { header: "Cash position", align: "right", cell: (r) => <SignedAmount paise={r.cashPaise} /> },
        ]}
      />
    </Panel>
  );
}

const contribCsv: CsvColumn<Contribution>[] = [
  { header: "Date", value: (c) => csvDate(c.at) },
  { header: "Contributor", value: (c) => c.partner },
  { header: "Branch", value: (c) => branchName(c.branchId) },
  { header: "Amount (INR)", value: (c) => rupees(c.amountPaise) },
  { header: "Note", value: (c) => c.note },
];

export function ContributionsPanel() {
  const { contributions, ready } = useFundPositions();
  return (
    <Panel flush title="Capital contributions" description={`${contributions.length} contributions in your scope`} actions={<CsvButton filename="capital-contributions" rows={contributions} columns={contribCsv} />}>
      <DataTable
        rows={ready ? contributions : []}
        rowKey={(c) => c.id}
        empty={ready ? "No capital recorded." : "Loading…"}
        columns={[
          { header: "Date", cell: (c) => <span className="whitespace-nowrap text-muted">{formatDate(c.at)}</span> },
          { header: "Contributor", cell: (c) => <span className="font-medium whitespace-nowrap">{c.partner}</span> },
          { header: "Branch", cell: (c) => branchName(c.branchId) },
          { header: "Amount", align: "right", cell: (c) => <span className="font-semibold">{formatPaise(c.amountPaise)}</span> },
          { header: "Note", cell: (c) => <span className="text-xs text-muted">{c.note}</span> },
        ]}
      />
    </Panel>
  );
}
