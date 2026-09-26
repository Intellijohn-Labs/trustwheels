"use client";

import { useMemo, useState } from "react";
import { useScopedLedger, weeklyCashFlow, type WeekFlow } from "@/lib/finance";
import { useNow } from "@/lib/use-now";
import { formatIsoDate, formatPaise } from "@/lib/format";
import { csvDate, rupees, type CsvColumn } from "@/lib/csv";
import { DataTable } from "../data-table";
import { Panel, Segmented, cn } from "../ui";
import { CsvButton } from "./csv-button";
import { SignedAmount } from "./ledger-table";

const shortDate = (ymd: string) => formatIsoDate(ymd).slice(0, 5); // DD/MM

/** Compact ₹ for axis ticks: ₹1.2L, ₹45K. */
function compact(paise: number) {
  const r = paise / 100;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(r >= 1_000_000 ? 0 : 1)}L`;
  if (r >= 1000) return `₹${Math.round(r / 1000)}K`;
  return `₹${Math.round(r)}`;
}

const csv: CsvColumn<WeekFlow>[] = [
  { header: "Week starting", value: (w) => csvDate(`${w.week}T12:00:00+05:30`) },
  { header: "Money in (INR)", value: (w) => rupees(w.inPaise) },
  { header: "Money out (INR)", value: (w) => rupees(w.outPaise) },
  { header: "Net (INR)", value: (w) => rupees(w.netPaise) },
];

/**
 * Weekly money in vs out from the ledger (role-scoped), last `weeks` weeks. Diverging bars
 * on one shared scale: in above the baseline, out below. Hover or focus a week for values;
 * the table view carries the same numbers.
 */
export function CashFlowChart({ weeks = 8, branchIds, title = "Weekly cash flow" }: { weeks?: number; branchIds?: string[]; title?: string }) {
  const { entries, ready } = useScopedLedger();
  const now = useNow(300_000);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number>();
  const key = branchIds?.join(",");
  const rows = useMemo(() => {
    const ids = key?.split(",");
    return weeklyCashFlow(ids ? entries.filter((e) => ids.includes(e.branchId)) : entries, weeks, now);
  }, [entries, key, weeks, now]);

  const max = Math.max(1, ...rows.map((r) => Math.max(r.inPaise, r.outPaise)));
  const sum = rows.reduce((t, r) => ({ inPaise: t.inPaise + r.inPaise, outPaise: t.outPaise + r.outPaise, netPaise: t.netPaise + r.netPaise }), { inPaise: 0, outPaise: 0, netPaise: 0 });
  const focus = active != null ? rows[active] : undefined;

  return (
    <Panel
      title={title}
      description={`Money in vs out per week (Monday start), from the ledger · last ${weeks} weeks`}
      actions={
        <div className="flex items-center gap-2">
          <div className="w-40">
            <Segmented
              name="Cash flow view"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          </div>
          <CsvButton filename="weekly-cash-flow" rows={rows} columns={csv} />
        </div>
      }
      flush={view === "table"}
    >
      {view === "table" ? (
        <DataTable
          rows={ready ? [...rows].reverse() : []}
          rowKey={(r) => r.week}
          empty="Loading…"
          columns={[
            { header: "Week starting", cell: (r) => formatIsoDate(r.week) },
            { header: "Money in", align: "right", cell: (r) => formatPaise(r.inPaise) },
            { header: "Money out", align: "right", cell: (r) => formatPaise(r.outPaise) },
            { header: "Net", align: "right", cell: (r) => <SignedAmount paise={r.netPaise} /> },
          ]}
        />
      ) : (
        <figure>
          {/* Readout: totals by default, the hovered week otherwise. Text in ink tokens. */}
          <figcaption className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm" aria-live="polite">
            <span className="w-full text-xs text-muted sm:w-auto">{focus ? `Week of ${formatIsoDate(focus.week)}` : `${weeks}-week total`}</span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm bg-chart" />
              <span className="text-muted">In</span>
              <span className="font-semibold tabular-nums">{formatPaise((focus ?? sum).inPaise)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm bg-muted" />
              <span className="text-muted">Out</span>
              <span className="font-semibold tabular-nums">{formatPaise((focus ?? sum).outPaise)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted">Net</span>
              <SignedAmount paise={(focus ?? sum).netPaise} />
            </span>
          </figcaption>

          <div className="flex gap-2">
            {/* One shared axis: +max at top, 0 at the baseline, −max at the bottom. */}
            <div className="flex w-10 shrink-0 flex-col justify-between text-right text-[11px] text-muted tabular-nums" style={{ height: 200 }} aria-hidden>
              <span>{compact(max)}</span>
              <span>₹0</span>
              <span>−{compact(max)}</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-x-0 border-t border-line-strong" style={{ top: 100 }} aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: 199 }} aria-hidden />
              <div className="relative flex" style={{ height: 200 }} onMouseLeave={() => setActive(undefined)}>
                {rows.map((r, i) => (
                  <div
                    key={r.week}
                    tabIndex={0}
                    role="img"
                    aria-label={`Week of ${formatIsoDate(r.week)}: in ${formatPaise(r.inPaise)}, out ${formatPaise(r.outPaise)}, net ${formatPaise(r.netPaise)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(undefined)}
                    className={cn("flex flex-1 cursor-default flex-col items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand", active === i && "bg-sunken/70")}
                  >
                    <div className="flex w-full flex-1 items-end justify-center pb-px">
                      <div className="w-3/5 max-w-5 rounded-t bg-chart" style={{ height: `${(r.inPaise / max) * 98}%`, minHeight: r.inPaise ? 2 : 0 }} />
                    </div>
                    <div className="flex w-full flex-1 items-start justify-center pt-px">
                      <div className="w-3/5 max-w-5 rounded-b bg-muted" style={{ height: `${(r.outPaise / max) * 98}%`, minHeight: r.outPaise ? 2 : 0 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex text-[11px] text-muted tabular-nums" aria-hidden>
                {rows.map((r, i) => (
                  <span key={r.week} className={cn("flex-1 text-center", i % 2 === 1 && "max-sm:invisible")}>
                    {shortDate(r.week)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm bg-chart" /> Money in (above the line)
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm bg-muted" /> Money out (below the line)
            </span>
          </p>
        </figure>
      )}
    </Panel>
  );
}
