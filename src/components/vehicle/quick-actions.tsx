"use client";

import { useState } from "react";
import { Camera, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useAction } from "../toast";
import { setAskingPrice, updateVehiclePhotos } from "@/lib/stock-store";
import { PHOTO_SLOTS } from "@/lib/masters";
import { displayReg } from "@/lib/format";
import type { PhotoSlot, Vehicle } from "@/lib/types";
import { Button, Field } from "../ui";
import { Dialog } from "../panels/dialog";
import { RupeeInput } from "../panels/job-card-dialog";
import { PhotoSlotInput } from "../photo-slot";
import { DocumentVault } from "./document-vault";

/*
 * Three card-level quick actions shared by every screen that lists a Ready for Sale vehicle
 * (Book & Sell's Available/Booked tabs and the Stock page's Ready for Sale panel) - one
 * implementation each, so "edit price/photos/documents from the card" behaves identically and
 * stays in sync everywhere it appears, instead of drifting between two hand-maintained copies.
 */

const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

/**
 * Quick asking-price edit from the card itself, instead of sending someone to the Stock page's
 * "Final Verification" dialog (which is unreachable once a vehicle is already marked ready) or the
 * vehicle detail page. `stock.verify` only, same gate as setAskingPrice()/setSaleReadiness()
 * everywhere else; hidden once the vehicle is booked/sold, same as that store call already refuses.
 */
export function PriceEditButton({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(v.proposedPricePaise ? String(v.proposedPricePaise / 100) : "");
  const { run, busy } = useAction();
  const canEdit = can("stock.verify") && !v.sale;

  if (!canEdit) return null;

  async function save() {
    if (await run(() => setAskingPrice(v.id, Number(price) * 100), "Asking price updated")) setOpen(false);
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Edit asking price for ${label(v)}`}>
        <Pencil className="size-3.5" /> Edit price
      </Button>
      {open && (
        <Dialog
          title="Update asking price"
          subtitle={label(v)}
          onClose={() => setOpen(false)}
          onSubmit={save}
          footer={
            <>
              <Button size="lg" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy || !price || Number(price) <= 0}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Save price
              </Button>
            </>
          }
        >
          <Field label="Asking price" htmlFor="quick-price-edit" required>
            <RupeeInput id="quick-price-edit" value={price} onChange={setPrice} disabled={busy} />
          </Field>
        </Dialog>
      )}
    </>
  );
}

/**
 * The six intake gallery photo slots, editable in a modal right from the card - upload or replace
 * (camera or gallery, via PhotoSlotInput), staged locally and only saved via updateVehiclePhotos()
 * on "Save photos". `stock.verify` only, same gate as Edit price/Documents.
 */
export function PhotosEditButton({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, string>>>(v.photos);
  const { run, busy } = useAction();

  if (!can("stock.verify")) return null;

  async function save() {
    if (await run(() => updateVehiclePhotos(v.id, photos), "Photos updated")) setOpen(false);
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setPhotos(v.photos);
          setOpen(true);
        }}
        aria-label={`Edit photos for ${label(v)}`}
      >
        <Camera className="size-3.5" /> Edit photos
      </Button>
      {open && (
        <Dialog
          wide
          title="Edit photos"
          subtitle={label(v)}
          onClose={() => setOpen(false)}
          onSubmit={save}
          footer={
            <>
              <Button size="lg" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Save photos
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PHOTO_SLOTS.map((p) => (
              <PhotoSlotInput key={p.slot} label={p.label} hint={p.hint} value={photos[p.slot]} onChange={(url) => setPhotos((ph) => ({ ...ph, [p.slot]: url }))} />
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}

/** Documents & vault in a modal, right from the card - upload, replace, verify or delete without navigating away. */
export function DocumentsButton({ vehicle: v }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Documents for ${label(v)}`}>
        <FileText className="size-3.5" /> Documents
      </Button>
      {open && (
        <Dialog title="Documents & vault" subtitle={label(v)} onClose={() => setOpen(false)} wide>
          <DocumentVault vehicle={v} />
        </Dialog>
      )}
    </>
  );
}
