"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { Button, Field, KpiCard, PageHeader, Panel, inputClass } from "@/components/ui";
import { CsvButton } from "@/components/panels/csv-button";
import { LedgerTable, SignedAmount } from "@/components/panels/ledger-table";
import { reversedIds, totals, useScopedLedger } from "@/lib/finance";
import { LEDGER_TYPE_LABEL, type LedgerEntry, type LedgerType } from "@/lib/ledger";
import { useRole } from "@/lib/role-context";
import { BRANCHES, branchName } from "@/lib/masters";
import { formatPaise } from "@/lib/format";
import { csvDate, rupees, type CsvColumn } from "@/lib/csv";
import { istDate } from "@/lib/working-days";
import { useNow } from "@/lib/use-now";

const PAGE = 50;

export default function LedgerPage() {
  const { entries, ready } = useScopedLedger();
  const { inScope, can, roleDef } = useRole();
  const [type, setType] = useState<LedgerType | "">("");
  const [branch, setBranch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE);
  const now = useNow(60_000);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const day = istDate(e.at);
        return (!type || e.type === type) && (!branch || e.branchId === branch) && (!from || day >= from) && (!to || day <= to);
      }),
    [entries, type, branch, from, to],
  );
  const t = totals(filtered);
  const reversed = reversedIds(entries);
  const filtering = type || branch || from || to;

  const csv: CsvColumn<LedgerEntry>[] = [
    { header: "Date", value: (e) => csvDate(e.at) },
    { header: "Time", value: (e) => new Date(e.at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) },
    { header: "Entry id", value: (e) => e.id },
    { header: "Type", value: (e) => LEDGER_TYPE_LABEL[e.type] },
    { header: "Branch", value: (e) => branchName(e.branchId) },
    { header: "Memo", value: (e) => e.memo },
    { header: "Amount (INR)", value: (e) => rupees(e.amountPaise) },
    { header: "By", value: (e) => e.by },
    { header: "Vehicle", value: (e) => e.vehicleId ?? "" },
    { header: "Reverses", value: (e) => e.reversesId ?? "" },
    { header: "Reversed", value: (e) => (reversed.has(e.id) ? "yes" : "") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={can("ledger.reverse") || roleDef.scope === "all" ? "Master ledger" : "Transaction history"}
        icon={<BookOpen className="size-6 text-brand" />}
        description={`Append-only. Corrections are posted as reversal entries; nothing is edited or deleted.${roleDef.scope === "all" ? "" : ` Showing ${BRANCHES.filter((b) => inScope(b.id)).map((b) => b.name).join(", ")}.`}`}
      />

      <Panel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="Type" htmlFor="f-type">
            <select id="f-type" value={type} onChange={(e) => setType(e.target.value as LedgerType | "")} className={inputClass()}>
              <option value="">All types</option>
              {(Object.keys(LEDGER_TYPE_LABEL) as LedgerType[]).map((k) => (
                <option key={k} value={k}>
                  {LEDGER_TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" htmlFor="f-branch">
            <select id="f-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={inputClass()}>
              <option value="">All in scope</option>
              {BRANCHES.filter((b) => inScope(b.id)).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From" htmlFor="f-from">
            <input id="f-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass()} />
          </Field>
          <Field label="To" htmlFor="f-to">
            <input id="f-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass()} />
          </Field>
          <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
            <Button
              size="lg"
              className="flex-1"
              disabled={!filtering}
              onClick={() => {
                setType("");
                setBranch("");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
            <CsvButton filename={`ledger-${istDate(now)}`} rows={filtered} columns={csv} label="Export CSV" />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Entries" value={filtered.length} hint={filtering ? `of ${entries.length}` : "All in scope"} />
        <KpiCard label="Money in" value={formatPaise(t.inPaise)} />
        <KpiCard label="Money out" value={formatPaise(t.outPaise)} />
        <KpiCard label="Net" value={<SignedAmount paise={t.netPaise} className="font-semibold" />} hint={t.netPaise < 0 ? "More out than in" : "More in than out"} />
      </div>

      <Panel flush title="Entries" description="Newest first · reversed entries are struck through and tagged">
        <LedgerTable entries={ready ? filtered.slice(0, shown) : []} all={entries} empty={ready ? "No entries match these filters." : "Loading…"} />
        {filtered.length > shown && (
          <div className="border-t border-line p-3 text-center">
            <Button onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
