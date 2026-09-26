"use client";

import { useMemo, useState } from "react";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { stockAgeing } from "@/lib/finance";
import { formatPaise } from "@/lib/format";
import { rupees, type CsvColumn } from "@/lib/csv";
import { DataTable } from "../data-table";
import { Panel, Segmented } from "../ui";
import { CsvButton } from "./csv-button";

type Bucket = ReturnType<typeof stockAgeing>[number];

const csv: CsvColumn<Bucket>[] = [
  { header: "Age since entry", value: (b) => b.label },
  { header: "Vehicles", value: (b) => b.count },
  { header: "Value at landed cost (INR)", value: (b) => rupees(b.valuePaise) },
];

/**
 * Unsold stock by days since entry. One series (vehicle count) as thin horizontal bars on
 * one scale, value labelled in text beside each bar; table view carries the same data.
 */
export function StockAgeingPanel() {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(300_000);
  const [view, setView] = useState<"chart" | "table">("chart");
  const buckets = useMemo(() => stockAgeing(vehicles, now), [vehicles, now]);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const units = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <Panel
      title="Stock ageing"
      description={`${units} unsold vehicles by days since entry · value at landed cost`}
      flush={view === "table"}
      actions={
        <div className="flex items-center gap-2">
          <div className="w-40">
            <Segmented
              name="Ageing view"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          </div>
          <CsvButton filename="stock-ageing" rows={buckets} columns={csv} />
        </div>
      }
    >
      {view === "table" ? (
        <DataTable
          rows={ready ? buckets : []}
          rowKey={(b) => b.id}
          empty="Loading…"
          columns={[
            { header: "Age since entry", cell: (b) => b.label },
            { header: "Vehicles", align: "right", cell: (b) => b.count },
            { header: "Value at landed cost", align: "right", cell: (b) => formatPaise(b.valuePaise) },
          ]}
        />
      ) : (
        <ul className="grid gap-3">
          {buckets.map((b) => (
            <li key={b.id} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-sm" title={`${b.label}: ${b.count} vehicles, ${formatPaise(b.valuePaise)}`}>
              <span className="text-muted">{b.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 rounded-r bg-chart" style={{ width: `${(b.count / max) * 70}%`, minWidth: b.count ? 3 : 0 }} aria-hidden />
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{b.count}</span> <span className="text-xs text-muted">· {formatPaise(b.valuePaise)}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
