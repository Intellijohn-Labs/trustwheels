"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert, Wrench } from "lucide-react";
import { Dialog, useInlineAction } from "./dialog";
import { RupeeInput } from "./job-card-dialog";
import { PhotoSlotInput } from "../photo-slot";
import { DocumentVault } from "../vehicle/document-vault";
import { Button, Field, Pill, textareaClass } from "../ui";
import { displayReg, formatPaise } from "@/lib/format";
import { allRequiredDocsVerified, missingDocuments } from "@/lib/documents";
import { PHOTO_SLOTS } from "@/lib/masters";
import { sendToReconditioning, setAskingPrice, setSaleReadiness, updateVehiclePhotos } from "@/lib/stock-store";
import { collapseThenRun } from "@/lib/exit-animation";
import type { PhotoSlot, Vehicle } from "@/lib/types";

/** One stat in the Final Verification summary row. */
function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-sunken/50 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={tone === "ok" ? "mt-0.5 font-semibold text-ok" : tone === "warn" ? "mt-0.5 font-semibold text-warn" : "mt-0.5 font-semibold"}>{value}</p>
    </div>
  );
}

/**
 * Final Verification: the last checkpoint before a vehicle is flagged "Ready for Sale" and becomes
 * selectable for booking/sale immediately, so this asks first rather than firing on a single click.
 * Opens on a clean summary (asking price, photo count, document status) with three independent
 * toggles - price, photos, documents - each hiding its own edit controls until switched on, so a
 * reviewer who just wants to confirm everything looks right isn't shown three edit forms by default.
 * Price and photo edits are staged locally and only saved on Confirm; document edits go through the
 * embedded vault, which (like everywhere else it's used) saves each change immediately.
 */
export function MarkReadyForSaleDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const alreadyReady = vehicle.saleReadiness?.status === "ready_for_sale";
  const { submit, failure, busy } = useInlineAction();

  const [editPrice, setEditPrice] = useState(false);
  const [price, setPrice] = useState(vehicle.proposedPricePaise ? String(vehicle.proposedPricePaise / 100) : "");
  const priceError = editPrice && (!price || Number(price) <= 0) ? "Enter a valid selling price" : undefined;

  const [editPhotos, setEditPhotos] = useState(false);
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, string>>>(vehicle.photos);
  const photoCount = PHOTO_SLOTS.filter((p) => vehicle.photos[p.slot]).length;

  const [editDocuments, setEditDocuments] = useState(false);
  const missing = missingDocuments(vehicle);
  const docsComplete = allRequiredDocsVerified(vehicle);

  async function confirm() {
    const paise = Number(price) * 100;
    // Only animate the row away on a fresh "ready" decision - re-confirming an already-ready
    // vehicle doesn't move it out of the current view, so there's nothing to collapse.
    const action = async () => {
      if (editPrice && paise !== vehicle.proposedPricePaise) await setAskingPrice(vehicle.id, paise);
      if (editPhotos && JSON.stringify(photos) !== JSON.stringify(vehicle.photos)) await updateVehiclePhotos(vehicle.id, photos);
      await setSaleReadiness(vehicle.id, "ready_for_sale");
    };
    if (await submit(() => (alreadyReady ? action() : collapseThenRun([vehicle.id], action)), "Marked as Ready for Sale")) onClose();
  }

  return (
    <Dialog
      wide
      title="Final Verification"
      subtitle={`${vehicle.make} ${vehicle.model} · ${displayReg(vehicle.registrationNo)}`}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="success" className="flex-[2]" disabled={busy || !!priceError}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm & Mark Ready for Sale
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Current asking price" value={vehicle.proposedPricePaise ? formatPaise(vehicle.proposedPricePaise) : "Not set"} />
        <SummaryStat label="Photos" value={`${photoCount} of ${PHOTO_SLOTS.length}`} tone={photoCount === PHOTO_SLOTS.length ? "ok" : "warn"} />
        <SummaryStat
          label="Documents"
          value={docsComplete ? "All verified" : `${missing.length} outstanding`}
          tone={docsComplete ? "ok" : "warn"}
        />
      </div>

      <div className="mt-4 space-y-4 divide-y divide-line">
        <div>
          <label className="flex cursor-pointer items-center gap-2 py-3 text-sm font-medium">
            <input type="checkbox" checked={editPrice} onChange={(e) => setEditPrice(e.target.checked)} className="size-4 cursor-pointer accent-[var(--brand)]" />
            Change final selling price?
          </label>
          {editPrice && (
            <div className="pb-3">
              <Field
                label="Selling price"
                htmlFor="fv-price"
                required
                error={priceError}
                hint={vehicle.proposedPricePaise ? `Previously set to ${formatPaise(vehicle.proposedPricePaise)}` : "No asking price was set during reconditioning - enter one now"}
              >
                <RupeeInput id="fv-price" value={price} onChange={setPrice} placeholder="1,25,000" disabled={busy} />
              </Field>
            </div>
          )}
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-2 py-3 text-sm font-medium">
            <input type="checkbox" checked={editPhotos} onChange={(e) => setEditPhotos(e.target.checked)} className="size-4 cursor-pointer accent-[var(--brand)]" />
            Update or add photos?
          </label>
          {editPhotos && (
            <div className="grid grid-cols-2 gap-3 pb-3 sm:grid-cols-3">
              {PHOTO_SLOTS.map((p) => (
                <PhotoSlotInput key={p.slot} label={p.label} hint={p.hint} value={photos[p.slot]} onChange={(url) => setPhotos((ph) => ({ ...ph, [p.slot]: url }))} />
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-2 py-3 text-sm font-medium">
            <input type="checkbox" checked={editDocuments} onChange={(e) => setEditDocuments(e.target.checked)} className="size-4 cursor-pointer accent-[var(--brand)]" />
            Update or add documents?
          </label>
          {editDocuments && (
            <div className="pb-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                <Pill tone="neutral">Saves immediately</Pill> Document changes below apply right away, separately from Confirm.
              </p>
              <DocumentVault vehicle={vehicle} />
            </div>
          )}
        </div>
      </div>

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
    if (await submit(() => collapseThenRun([vehicle.id], () => sendToReconditioning(vehicle.id)), "Sent to Reconditioning")) onClose();
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
