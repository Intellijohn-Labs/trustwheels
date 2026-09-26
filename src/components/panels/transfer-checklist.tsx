"use client";

import { useState } from "react";
import { Check, IndianRupee } from "lucide-react";
import { Button, Pill, cn, inputClass } from "../ui";
import { useAction } from "../toast";
import { TRANSFER_STEPS } from "@/lib/masters";
import { formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { requestTransferFee, setTransferStep } from "@/lib/stock-store";
import { transferProgress } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";

const FEE_TONE = { requested: "warn", approved: "brand", paid: "ok" } as const;
const FEE_LABEL = { requested: "Fee requested · awaiting central accountant", approved: "Fee approved · awaiting payment", paid: "Fee paid" } as const;

/** Ownership-transfer checklist for one vehicle, with the RTO transfer-fee request. */
export function TransferChecklist({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const { run, busy } = useAction();
  const [fee, setFee] = useState("");
  const progress = transferProgress(v);
  const sold = v.sale?.status === "sold";
  const editable = can("delivery.transfer") && sold && !v.delivery?.released;
  const feePayment = v.delivery?.feePayment;
  const canRequestFee = editable && (!feePayment || feePayment.status === "requested");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          Ownership transfer · {progress.done}/{progress.total}
        </p>
        <span className="text-xs text-muted">{Math.round((progress.done / progress.total) * 100)}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Ownership transfer progress">
        <div className={cn("h-full rounded-full transition-all", progress.complete ? "bg-ok" : "bg-brand")} style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>
      {!sold && <p className="mt-2 text-xs text-muted">Transfer starts once the sale is recorded (balance received).</p>}

      <ul className="mt-3 space-y-1.5">
        {TRANSFER_STEPS.map((s) => {
          const done = v.delivery?.transfer[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={!!done}
                disabled={!editable || busy}
                onClick={() => run(() => setTransferStep(v.id, s.id, !done), done ? `Unticked: ${s.label}` : `Done: ${s.label}`)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition",
                  done ? "border-ok/30 bg-ok-soft/50" : "border-line",
                  editable ? "hover:bg-sunken" : "cursor-default",
                )}
              >
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", done ? "border-ok bg-ok text-surface" : "border-line-strong bg-surface")}>
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block", done && "font-medium")}>{s.label}</span>
                  <span className="block text-xs text-muted">{done ? `${done.by} · ${formatDateTime(done.at)}` : "Not done"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 rounded-xl bg-sunken/70 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <IndianRupee className="size-4 text-muted" /> RTO transfer fee
        </p>
        {feePayment ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-semibold tabular-nums">{formatPaise(v.delivery?.transferFeePaise ?? 0)}</span>
            <Pill tone={FEE_TONE[feePayment.status]} className="whitespace-normal!">
              {FEE_LABEL[feePayment.status]}
            </Pill>
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">Not requested yet. The central accountant approves and pays it.</p>
        )}
        {canRequestFee && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => requestTransferFee(v.id, Number(fee) * 100), "Fee request sent to the central accountant").then((ok) => ok && setFee(""));
            }}
          >
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                aria-label="Transfer fee amount"
                inputMode="numeric"
                value={groupIndian(fee)}
                onChange={(e) => setFee(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={feePayment ? "Revise amount" : "1,850"}
                className={cn(inputClass(), "h-10 pl-7 text-sm tabular-nums")}
              />
            </div>
            <Button type="submit" size="md" disabled={busy || !Number(fee)}>
              {feePayment ? "Update" : "Request fee"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
