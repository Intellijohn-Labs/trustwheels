"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CircleCheck, TriangleAlert, Undo2 } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { BRANCHES, branchName } from "@/lib/masters";
import { branchPositions, isSettlementReversed, recordSettlement, useSettlements, type BranchPosition, type Settlement } from "@/lib/settlements";
import { ledger } from "@/lib/ledger";
import { reversedIds } from "@/lib/finance";
import { formatDate, formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import { csvDate, rupees, type CsvColumn } from "@/lib/csv";
import { DataTable } from "../data-table";
import { Button, Field, Panel, Pill, cn, inputClass, textareaClass } from "../ui";
import { CsvButton } from "./csv-button";
import { Dialog, useInlineAction } from "./dialog";

/** Branch positions (owed by Angamaly) for the branches in the role's scope, hub excluded. */
export function useBranchPositions() {
  const { vehicles, ready: vReady } = useScopedVehicles();
  const { items, ready: sReady } = useSettlements();
  const { items: entries } = ledger.useItems();
  const { inScope } = useRole();
  const positions = useMemo(
    () =>
      branchPositions(
        vehicles,
        items,
        BRANCHES.filter((b) => b.id !== "ang" && inScope(b.id)).map((b) => b.id),
        reversedIds(entries),
      ),
    [vehicles, items, entries, inScope],
  );
  const outstandingPaise = positions.reduce((s, p) => s + p.outstandingPaise, 0);
  return { positions, outstandingPaise, ready: vReady && sReady };
}

export function RecordSettlementButton({ branchId, suggestedPaise, size = "sm" }: { branchId?: string; suggestedPaise?: number; size?: "sm" | "md" }) {
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  if (!can("settlement.record")) return null;
  return (
    <>
      <Button size={size} variant={branchId ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-3.5" /> {branchId ? "Settle" : "Record settlement"}
      </Button>
      {open && <SettlementDialog branchId={branchId} suggestedPaise={suggestedPaise} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettlementDialog({ branchId: initialBranch, suggestedPaise, onClose }: { branchId?: string; suggestedPaise?: number; onClose: () => void }) {
  const { positions } = useBranchPositions();
  const [branchId, setBranchId] = useState(initialBranch ?? positions.find((p) => p.outstandingPaise > 0)?.branchId ?? "b1");
  const [amount, setAmount] = useState(suggestedPaise && suggestedPaise > 0 ? String(Math.round(suggestedPaise / 100)) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const { submit: run, failure, busy } = useInlineAction();
  const position = positions.find((p) => p.branchId === branchId);
  const paise = (Number(amount) || 0) * 100;
  const over = position && paise > position.outstandingPaise;

  async function submit() {
    if (await run(() => recordSettlement(branchId, paise, reference, note), `Settlement of ${formatPaise(paise)} to ${branchName(branchId)} recorded · posted to ledger`)) onClose();
  }

  return (
    <Dialog
      title="Record settlement"
      subtitle="Angamaly pays the branch for vehicles it has received"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy}>
            <ArrowLeftRight className="size-4" /> Record &amp; post
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Branch" htmlFor="st-branch" required>
          <select id="st-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass()}>
            {positions.map((p) => (
              <option key={p.branchId} value={p.branchId}>
                {p.name} · {formatPaise(p.outstandingPaise)} outstanding
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Amount"
          htmlFor="st-amount"
          required
          hint={over ? undefined : position ? `Outstanding ${formatPaise(position.outstandingPaise)}` : undefined}
          error={over ? `More than the ${formatPaise(position!.outstandingPaise)} outstanding. Check before recording.` : undefined}
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">₹</span>
            <input
              id="st-amount"
              inputMode="numeric"
              value={groupIndian(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className={cn(inputClass(!!over), "pl-8 text-lg font-semibold tabular-nums")}
            />
          </div>
        </Field>
        <Field label="UTR / reference" htmlFor="st-ref" required>
          <input id="st-ref" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} autoComplete="off" className={cn(inputClass(), "font-mono")} />
        </Field>
        <Field label="Note" htmlFor="st-note">
          <textarea id="st-note" value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass()} placeholder="e.g. Vehicles received 01/09 – 15/09" />
        </Field>
      </div>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

const positionCsv: CsvColumn<BranchPosition>[] = [
  { header: "Branch", value: (p) => p.name },
  { header: "Vehicles received at Angamaly", value: (p) => p.vehicles },
  { header: "Due from Angamaly (INR)", value: (p) => rupees(p.duePaise) },
  { header: "Settled (INR)", value: (p) => rupees(p.settledPaise) },
  { header: "Outstanding (INR)", value: (p) => rupees(p.outstandingPaise) },
  { header: "Last settlement", value: (p) => csvDate(p.lastSettlement?.at) },
];

/** Branch-wise position: due from Angamaly, settled, outstanding. Settle action for the central accountant. */
export function SettlementPositionPanel({ title = "Branch positions", description }: { title?: string; description?: string }) {
  const { positions, outstandingPaise, ready } = useBranchPositions();
  const { can } = useRole();
  return (
    <Panel
      flush
      title={title}
      description={description ?? `Purchase value of vehicles received at Angamaly, less settlements · ${formatPaise(outstandingPaise)} outstanding`}
      actions={<CsvButton filename="branch-positions" rows={positions} columns={positionCsv} />}
    >
      <DataTable
        rows={ready ? positions : []}
        rowKey={(p) => p.branchId}
        empty={ready ? "No branches in your scope." : "Loading…"}
        columns={[
          { header: "Branch", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Received", align: "right", cell: (p) => p.vehicles },
          { header: "Due from Angamaly", align: "right", cell: (p) => formatPaise(p.duePaise) },
          { header: "Settled", align: "right", cell: (p) => formatPaise(p.settledPaise) },
          { header: "Outstanding", align: "right", cell: (p) => <span className="font-semibold">{formatPaise(p.outstandingPaise)}</span> },
          {
            header: "Status",
            cell: (p) =>
              p.outstandingPaise > 0 ? (
                <Pill tone="warn" icon={<TriangleAlert className="size-3" />}>
                  Outstanding
                </Pill>
              ) : p.outstandingPaise < 0 ? (
                <Pill tone="danger" icon={<TriangleAlert className="size-3" />}>
                  Over-settled
                </Pill>
              ) : (
                <Pill tone="ok" icon={<CircleCheck className="size-3" />}>
                  Settled
                </Pill>
              ),
          },
          { header: "Last settled", cell: (p) => <span className="text-xs whitespace-nowrap text-muted">{p.lastSettlement ? formatDate(p.lastSettlement.at) : "Never"}</span> },
          ...(can("settlement.record") ? [{ header: "", align: "right" as const, cell: (p: BranchPosition) => (p.outstandingPaise > 0 ? <RecordSettlementButton branchId={p.branchId} suggestedPaise={p.outstandingPaise} /> : null) }] : []),
        ]}
      />
    </Panel>
  );
}

type HistoryRow = Settlement & { reversed: boolean };

const historyCsv: CsvColumn<HistoryRow>[] = [
  { header: "Date", value: (s) => csvDate(s.at) },
  { header: "Branch", value: (s) => branchName(s.branchId) },
  { header: "Amount (INR)", value: (s) => rupees(s.amountPaise) },
  { header: "Reference", value: (s) => s.reference },
  { header: "Recorded by", value: (s) => s.by },
  { header: "Note", value: (s) => s.note },
  { header: "Reversed", value: (s) => (s.reversed ? "yes" : "") },
];

export function SettlementHistoryPanel({ limit }: { limit?: number }) {
  const { items, ready } = useSettlements();
  const { items: entries } = ledger.useItems();
  const { inScope } = useRole();
  const reversed = reversedIds(entries);
  const rows: HistoryRow[] = items
    .filter((s) => inScope(s.branchId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((s) => ({ ...s, reversed: isSettlementReversed(s, reversed) }));
  return (
    <Panel flush title="Settlement history" description={`${rows.length} settlement${rows.length === 1 ? "" : "s"} · each posts hub-out and branch-in entries to the ledger`} actions={<CsvButton filename="settlements" rows={rows} columns={historyCsv} />}>
      <DataTable
        rows={ready ? (limit ? rows.slice(0, limit) : rows) : []}
        rowKey={(s) => s.id}
        empty={ready ? "No settlements recorded yet." : "Loading…"}
        columns={[
          { header: "Date", cell: (s) => <span className="whitespace-nowrap text-muted">{formatDateTime(s.at)}</span> },
          { header: "Branch", cell: (s) => <span className="font-medium">{branchName(s.branchId)}</span> },
          {
            header: "Amount",
            align: "right",
            cell: (s) => (
              <span className="flex flex-col items-end gap-0.5">
                <span className={cn("font-semibold", s.reversed && "text-muted line-through")}>{formatPaise(s.amountPaise)}</span>
                {s.reversed && (
                  <Pill tone="neutral" icon={<Undo2 className="size-3" />}>
                    Reversed
                  </Pill>
                )}
              </span>
            ),
          },
          { header: "Reference", cell: (s) => <span className="font-mono text-xs">{s.reference}</span> },
          { header: "By", cell: (s) => <span className="whitespace-nowrap">{s.by}</span> },
          { header: "Note", cell: (s) => <span className="text-xs text-muted">{s.note || "–"}</span> },
        ]}
      />
    </Panel>
  );
}
