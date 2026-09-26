"use client";

import { useState } from "react";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { LEDGER_TYPE_LABEL, type LedgerEntry } from "@/lib/ledger";
import { reverseLedgerEntry } from "@/lib/ledger-actions";
import { reversedIds, useScopedLedger } from "@/lib/finance";
import { useRole } from "@/lib/role-context";
import { branchName } from "@/lib/masters";
import { formatDateTime, formatPaise } from "@/lib/format";
import { DataTable } from "../data-table";
import { Button, Field, Panel, Pill, cn, textareaClass } from "../ui";
import { Dialog, useInlineAction } from "./dialog";

/** Signed amount: money in plain, money out with a minus sign. Text ink, never colour alone. */
export function SignedAmount({ paise, className }: { paise: number; className?: string }) {
  return <span className={cn("font-semibold whitespace-nowrap tabular-nums", className)}>{paise < 0 ? `−${formatPaise(-paise)}` : `+${formatPaise(paise)}`}</span>;
}

function ReverseButton({ entry }: { entry: LedgerEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Reverse
      </Button>
      {open && <ReverseDialog entry={entry} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReverseDialog({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const { submit: run, failure, busy } = useInlineAction();
  async function submit() {
    if (await run(() => reverseLedgerEntry(entry.id, reason), "Reversal posted")) onClose();
  }
  return (
    <Dialog
      title="Reverse ledger entry"
      subtitle="Posts a new entry with the opposite amount. The original stays as it is."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="danger" className="flex-[2]" disabled={busy}>
            <Undo2 className="size-4" /> Post reversal
          </Button>
        </>
      }
    >
      <dl className="grid gap-1 rounded-xl bg-sunken p-3.5 text-sm">
        <dt className="text-xs text-muted">
          {LEDGER_TYPE_LABEL[entry.type]} · {branchName(entry.branchId)} · {formatDateTime(entry.at)}
        </dt>
        <dd>{entry.memo}</dd>
        <dd className="flex justify-between pt-1">
          <span className="text-muted">Original</span>
          <SignedAmount paise={entry.amountPaise} />
        </dd>
        <dd className="flex justify-between">
          <span className="text-muted">Reversal</span>
          <SignedAmount paise={-entry.amountPaise} />
        </dd>
      </dl>
      <div className="mt-4">
        <Field label="Reason" htmlFor="rev-reason" required>
          <textarea id="rev-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass(!!failure)} placeholder="e.g. Duplicate entry, wrong amount keyed" />
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

/**
 * Ledger rows. `all` is the full scoped ledger, used to mark originals as reversed even
 * when a filter hides the reversal entry. Reverse action only for `ledger.reverse`.
 */
export function LedgerTable({ entries, all, empty = "No transactions." }: { entries: LedgerEntry[]; all?: LedgerEntry[]; empty?: string }) {
  const { can } = useRole();
  const reversed = reversedIds(all ?? entries);
  const canReverse = can("ledger.reverse");
  return (
    <DataTable
      rows={entries}
      rowKey={(e) => e.id}
      empty={empty}
      columns={[
        {
          header: "Entry",
          cell: (e) => (
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-medium whitespace-nowrap">{LEDGER_TYPE_LABEL[e.type]}</span>
              <span className="text-xs whitespace-nowrap text-muted">{formatDateTime(e.at)}</span>
              {reversed.has(e.id) && (
                <Pill tone="neutral" icon={<Undo2 className="size-3" />}>
                  Reversed
                </Pill>
              )}
            </span>
          ),
        },
        { header: "Amount", align: "right", cell: (e) => <SignedAmount paise={e.amountPaise} className={reversed.has(e.id) ? "text-muted line-through" : undefined} /> },
        { header: "Branch", cell: (e) => <span className="whitespace-nowrap">{branchName(e.branchId)}</span> },
        {
          header: "Details",
          cell: (e) => (
            <span className="block max-w-80 min-w-48">
              <span className={cn("block text-sm", reversed.has(e.id) && "text-muted line-through")}>{e.memo}</span>
              <span className="text-xs text-muted">
                by {e.by}
                {e.vehicleId && (
                  <>
                    {" · "}
                    <Link href={`/stock/${e.vehicleId}`} className="text-brand hover:underline">
                      vehicle
                    </Link>
                  </>
                )}
              </span>
            </span>
          ),
        },
        ...(canReverse
          ? [{ header: "", align: "right" as const, cell: (e: LedgerEntry) => (e.type !== "reversal" && !reversed.has(e.id) ? <ReverseButton entry={e} /> : null) }]
          : []),
      ]}
    />
  );
}

/** Latest ledger entries in the role's scope. */
export function RecentTransactionsPanel({ limit = 8, title = "Recent transactions" }: { limit?: number; title?: string }) {
  const { entries, ready } = useScopedLedger();
  const { can } = useRole();
  return (
    <Panel
      flush
      title={title}
      description={`${entries.length} entries in your scope`}
      actions={
        can("ledger.view") ? (
          <Link href="/ledger" className="text-sm font-medium text-brand hover:underline">
            Full ledger
          </Link>
        ) : undefined
      }
    >
      <LedgerTable entries={ready ? entries.slice(0, limit) : []} all={entries} empty={ready ? "No transactions yet." : "Loading…"} />
    </Panel>
  );
}
