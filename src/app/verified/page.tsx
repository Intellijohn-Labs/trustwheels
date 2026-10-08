"use client";

import { useState } from "react";
import { BadgeCheck, Camera, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { displayReg } from "@/lib/format";
import { setAskingPrice, updateVehiclePhotos } from "@/lib/stock-store";
import { PHOTO_SLOTS } from "@/lib/masters";
import { Button, Field, Segmented } from "@/components/ui";
import { useAction } from "@/components/toast";
import { VehicleRow } from "@/components/vehicle-row";
import { SaleActions } from "@/components/sale-actions";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/selection";
import { Dialog } from "@/components/panels/dialog";
import { RupeeInput } from "@/components/panels/job-card-dialog";
import { DocumentVault } from "@/components/vehicle/document-vault";
import { PhotoSlotInput } from "@/components/photo-slot";
import type { PhotoSlot, Vehicle } from "@/lib/types";

type Tab = "available" | "booked" | "sold";

const TABS: { id: Tab; label: string; test: (v: Vehicle) => boolean; empty: string }[] = [
  {
    id: "available",
    label: "Available",
    // A bike must be explicitly marked Ready for Sale (Stock page) to be offered for a new sale -
    // this is how procurement/workshop/in-transit bikes stay excluded here.
    test: (v) => !v.sale && v.saleReadiness?.status === "ready_for_sale",
    empty: "No vehicles are marked Ready for Sale yet. Mark one from the Stock page.",
  },
  { id: "booked", label: "Booked", test: (v) => v.sale?.status === "booked", empty: "No bookings right now." },
  { id: "sold", label: "Sold", test: (v) => v.sale?.status === "sold", empty: "Nothing sold yet." },
];

const latest = (v: Vehicle) => v.sale?.soldAt ?? v.sale?.bookedAt ?? v.saleReadiness?.at ?? v.createdAt;
const label = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

/**
 * Quick asking-price edit from the card itself, instead of sending someone to the Stock page's
 * "Ready for Sale" dialog (which is unreachable once a vehicle is already marked ready) or the
 * vehicle detail page. `stock.verify` only, same gate as setAskingPrice()/setSaleReadiness()
 * everywhere else; hidden once the vehicle is booked/sold, same as that store call already refuses.
 */
function PriceEditButton({ vehicle: v }: { vehicle: Vehicle }) {
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
          <Field label="Asking price" htmlFor="verified-price-edit" required>
            <RupeeInput id="verified-price-edit" value={price} onChange={setPrice} disabled={busy} />
          </Field>
        </Dialog>
      )}
    </>
  );
}

/** Documents & vault in a modal, right from the card - upload, replace, verify or delete without leaving /verified. */
function DocumentsButton({ vehicle: v }: { vehicle: Vehicle }) {
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

/**
 * The six intake gallery photo slots, editable in a modal right from the card - upload, replace
 * (camera or gallery, via PhotoSlotInput) or remove a slot, staged locally and only saved via
 * updateVehiclePhotos() on "Save photos". `stock.verify` only, same gate as Edit price/Documents.
 */
function PhotosEditButton({ vehicle: v }: { vehicle: Vehicle }) {
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

export default function VerifiedPage() {
  const { vehicles, ready } = useScopedVehicles();
  const { can } = useRole();
  const now = useNow(60_000);
  const [tab, setTab] = useState<Tab>("available");

  const current = TABS.find((t) => t.id === tab)!;
  const rows = vehicles.filter(current.test).sort((a, b) => latest(b).localeCompare(latest(a)));
  // Bulk select/delete is Sold-only and Managing Partner-only (stock.delete); the other tabs keep
  // their existing per-row actions with no checkboxes.
  const selection = useSelection(rows, (v) => v.id);
  const bulkSelect = tab === "sold" && can("stock.delete");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BadgeCheck className="size-6 text-ok" /> Book &amp; sell
        </h1>
        <p className="text-sm text-muted">Only vehicles marked Ready for Sale can be newly booked or sold.</p>
      </div>

      <div className="sm:max-w-md">
        <Segmented
          name="Sale status"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.id, label: `${t.label} ${vehicles.filter(t.test).length}` }))}
        />
      </div>

      {bulkSelect && <BulkDeleteBar vehicles={rows} selected={selection.selected} onClear={selection.clear} />}

      {ready && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-muted">{current.empty}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {bulkSelect && (
            <label className="flex items-center gap-2.5 border-b border-line bg-sunken/60 px-4 py-2 text-sm text-muted">
              <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown vehicles" />
              Select all ({rows.length} shown)
            </label>
          )}
          <ul className="divide-y divide-line">
            {rows.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                now={now}
                leading={bulkSelect && <RowCheckbox checked={selection.isSelected(v.id)} onChange={() => selection.toggle(v.id)} label={`Select ${label(v)}`} />}
                actions={
                  <>
                    {tab !== "sold" && <SaleActions vehicle={v} />}
                    <PriceEditButton vehicle={v} />
                    <PhotosEditButton vehicle={v} />
                    <DocumentsButton vehicle={v} />
                    <DeleteVehicleButton vehicle={v} />
                  </>
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
