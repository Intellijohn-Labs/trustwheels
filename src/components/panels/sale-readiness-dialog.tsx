"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert, Wrench } from "lucide-react";
import { Dialog, useInlineAction } from "./dialog";
import { Button, Field, textareaClass } from "../ui";
import { displayReg } from "@/lib/format";
import { sendToReconditioning, setSaleReadiness } from "@/lib/stock-store";
import { collapseThenRun } from "@/lib/exit-animation";
import type { Vehicle } from "@/lib/types";

/** Confirm before flagging a vehicle "Ready for Sale" - it becomes selectable for booking/sale immediately, so this asks first rather than firing on a single click. */
export function MarkReadyForSaleDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const alreadyReady = vehicle.saleReadiness?.status === "ready_for_sale";
  const { submit, failure, busy } = useInlineAction();

  async function confirm() {
    // Only animate the row away on a fresh "ready" decision - re-confirming an already-ready
    // vehicle doesn't move it out of the current view, so there's nothing to collapse.
    const action = () => setSaleReadiness(vehicle.id, "ready_for_sale");
    if (await submit(() => (alreadyReady ? action() : collapseThenRun([vehicle.id], action)), "Marked as Ready for Sale")) onClose();
  }

  return (
    <Dialog
      title="Mark as Ready for Sale?"
      subtitle={`${vehicle.make} ${vehicle.model} · ${displayReg(vehicle.registrationNo)}`}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="success" className="flex-[2]" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mark Ready
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Are you sure you want to mark <span className="font-mono font-medium text-ink">{displayReg(vehicle.registrationNo)}</span> as ready for sale? This
        will make it available for booking and selling.
      </p>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

/** Confirm + optional reason before flagging a vehicle "Rejected Stock" - reversible any time via "Ready for Sale" or by reopening this dialog to edit the reason. */
export function RejectStockDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const alreadyRejected = vehicle.saleReadiness?.status === "rejected_stock";
  const [reason, setReason] = useState(vehicle.saleReadiness?.reason ?? "");
  const { submit, failure, busy } = useInlineAction();

  async function confirm() {
    // Only animate the row away on a fresh rejection - editing the reason on an already-rejected
    // vehicle doesn't move it out of the current view, so there's nothing to collapse.
    const action = () => setSaleReadiness(vehicle.id, "rejected_stock", reason);
    if (await submit(() => (alreadyRejected ? action() : collapseThenRun([vehicle.id], action)), "Marked as Rejected Stock")) onClose();
  }

  return (
    <Dialog
      title={alreadyRejected ? "Update rejection reason" : "Mark as Rejected Stock?"}
      subtitle={`${vehicle.make} ${vehicle.model} · ${displayReg(vehicle.registrationNo)}`}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="danger" className="flex-[2]" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />} {alreadyRejected ? "Save" : "Mark rejected"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl bg-warn-soft/60 p-3.5 text-warn">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm font-medium">This hides it from the &ldquo;Ready for Sale&rdquo; list until it&rsquo;s marked ready again.</p>
      </div>
      <div className="mt-4">
        <Field label="Reason (optional)" htmlFor="reject-reason">
          <textarea
            id="reject-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={textareaClass()}
            placeholder="e.g. Engine issue, accident damage, missing papers"
          />
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

/** Confirm before moving a rejected vehicle into reconditioning - clears its Rejected Stock flag and opens a job card, same as an arrival at the hub would. */
export function SendToReconDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { submit, failure, busy } = useInlineAction();

  async function confirm() {
    if (await submit(() => sendToReconditioning(vehicle.id), "Sent to Reconditioning")) onClose();
  }

  return (
    <Dialog
      title="Send to Reconditioning?"
      subtitle={`${vehicle.make} ${vehicle.model} · ${displayReg(vehicle.registrationNo)}`}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />} Send to Reconditioning
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        This clears the Rejected Stock flag on <span className="font-mono font-medium text-ink">{displayReg(vehicle.registrationNo)}</span> and moves it
        into reconditioning. It will leave this list and appear on the Reconditioning page.
      </p>
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}
