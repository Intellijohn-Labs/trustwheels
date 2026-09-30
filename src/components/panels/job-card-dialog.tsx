"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, Undo2, Wrench, X } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { uploadVehiclePhoto } from "@/lib/vehicle-media";
import { employees } from "@/lib/hr";
import {
  MIN_COMPLETION_PHOTOS,
  addJobItem,
  addReconPhoto,
  completeRecon,
  removeJobItem,
  removeReconPhoto,
  setProposedPrice,
  setTechnician,
} from "@/lib/stock-store";
import { formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import { landedCostPaise, reconCostPaise, reconHours } from "@/lib/workflow";
import type { JobKind, Vehicle } from "@/lib/types";
import { useAction } from "../toast";
import { Button, EmptyState, Field, Pill, Segmented, cn, inputClass } from "../ui";
import { Dialog, VehicleSummary } from "./dialog";
import { ReconFlagPill } from "./recon-panel";
import { formatHours } from "./vehicle-cell";

export const JOB_KINDS: { value: JobKind; label: string }[] = [
  { value: "part", label: "Part" },
  { value: "labour", label: "Labour" },
  { value: "vendor", label: "Vendor" },
];

const kindLabel = (k: JobKind) => JOB_KINDS.find((j) => j.value === k)!.label;

/** ₹ amount typed as whole rupees with Indian grouping; returns the digits. */
export function RupeeInput({ id, value, onChange, placeholder, disabled }: { id: string; value: string; onChange: (digits: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">₹</span>
      <input
        id={id}
        inputMode="numeric"
        value={groupIndian(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(inputClass(), "pl-8 tabular-nums")}
      />
    </div>
  );
}

/** Photo thumbnails; `onRemove` adds a delete button to each. */
export function PhotoGrid({ photos, onRemove, label = "Photo" }: { photos: string[]; onRemove?: (index: number) => void; label?: string }) {
  if (!photos.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((src, i) => (
        <li key={i} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sunken">
          <a href={src} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={src} alt={`${label} ${i + 1}`} className="size-full object-cover" />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Job card for one vehicle: items and costing, proposed price, repair photos, sign-off. Read-only without recon.manage. */
export function JobCardDialog({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const { vehicles } = useScopedVehicles();
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle?.recon) return null;
  return <JobCard vehicle={vehicle} onClose={onClose} />;
}

function JobCard({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const recon = v.recon!;
  const { can } = useRole();
  const { run, busy } = useAction();
  const now = useNow(60_000);
  const manage = can("recon.manage") && !v.gate;
  const locked = !!recon.completed;

  const [kind, setKind] = useState<JobKind>("part");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState(v.proposedPricePaise ? String(v.proposedPricePaise / 100) : "");
  const [technician, setTechnicianInput] = useState(recon.technicianName ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { items: staff } = employees.useItems();
  const technicianOptions = [...new Set(staff.filter((e) => e.status === "active").map((e) => e.name))].sort();

  const total = reconCostPaise(v);
  const landed = landedCostPaise(v);
  const proposed = v.proposedPricePaise;
  const photosLeft = Math.max(0, MIN_COMPLETION_PHOTOS - recon.photos.length);
  const lastSendBack = recon.sendBacks.at(-1);

  async function addItem() {
    const ok = await run(() => addJobItem(v.id, { kind, description, costPaise: Number(cost) * 100 }), "Item added");
    if (ok) {
      setDescription("");
      setCost("");
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    await run(async () => {
      for (const file of Array.from(files)) await addReconPhoto(v.id, await uploadVehiclePhoto(file));
    }, files.length > 1 ? `${files.length} photos added` : "Photo added");
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Dialog
      wide
      title="Job card"
      subtitle={
        <>
          <VehicleSummary vehicle={v} /> · {v.stockId}
        </>
      }
      onClose={onClose}
      footer={
        manage && !locked ? (
          <>
            <Button size="lg" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button
              size="lg"
              variant="success"
              className="flex-[2]"
              disabled={busy || photosLeft > 0}
              onClick={() => run(() => completeRecon(v.id), "Work signed off. Sent to the quality gate.")}
            >
              <ShieldCheck className="size-4" /> Sign off work
              {photosLeft > 0 && <span className="font-normal">· {recon.photos.length}/{MIN_COMPLETION_PHOTOS} photos</span>}
            </Button>
          </>
        ) : (
          <Button size="lg" className="flex-1" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {/* Clock and status */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ReconFlagPill vehicle={v} now={now} />
          <span className="text-muted">
            {formatHours(reconHours(v, now))} since stock entry · Supervisor <span className="font-medium text-ink">{recon.supervisor}</span>
          </span>
        </div>

        {/* Technician - typed inline, saves quietly when you move on to the next field */}
        <div className="flex items-center gap-2">
          <Wrench className="size-4 shrink-0 text-muted" />
          {manage && !locked ? (
            <>
              <input
                aria-label="Technician name"
                list="technician-options"
                value={technician}
                onChange={(e) => setTechnicianInput(e.target.value)}
                onBlur={() => technician.trim() !== (recon.technicianName ?? "") && run(() => setTechnician(v.id, technician))}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                placeholder="Technician name"
                className={cn(inputClass(), "max-w-64")}
              />
              <datalist id="technician-options">
                {technicianOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          ) : (
            <span className="text-sm text-muted">
              Technician: <span className="font-medium text-ink">{recon.technicianName || "Not assigned"}</span>
            </span>
          )}
        </div>

        {locked && (
          <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            Signed off by {recon.completed!.by} on {formatDateTime(recon.completed!.at)}. Waiting for the quality gate.
          </p>
        )}
        {lastSendBack && !locked && (
          <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            <Undo2 className="mt-0.5 size-4 shrink-0" />
            <span>
              Sent back by {lastSendBack.by} on {formatDateTime(lastSendBack.at)}: <span className="font-semibold">{lastSendBack.reason}</span>
            </span>
          </p>
        )}

        {/* Items */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Work done</h3>
          {recon.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong">
              <EmptyState>No items yet.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {recon.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <Pill>{kindLabel(item.kind)}</Pill>
                  <span className="min-w-0 flex-1 truncate">{item.description}</span>
                  <span className="font-medium tabular-nums">{formatPaise(item.costPaise)}</span>
                  {manage && !locked && (
                    <button
                      type="button"
                      onClick={() => run(() => removeJobItem(v.id, item.id), "Item removed")}
                      aria-label={`Remove ${item.description}`}
                      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
              <li className="flex items-center justify-between bg-sunken/60 px-3.5 py-2.5 text-sm font-semibold">
                <span>Job card total</span>
                <span className="tabular-nums" data-testid="job-total">
                  {formatPaise(total)}
                </span>
              </li>
            </ul>
          )}

          {manage && !locked && (
            <div className="mt-3 grid gap-3 rounded-xl bg-sunken/60 p-3 sm:grid-cols-[auto_1fr_9rem_auto] sm:items-end">
              <Segmented name="Item type" value={kind} onChange={setKind} options={JOB_KINDS} />
              <input
                aria-label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Rear brake shoes"
                className={inputClass()}
              />
              <RupeeInput id="item-cost" value={cost} onChange={setCost} placeholder="Cost" />
              <Button size="lg" variant="primary" onClick={addItem} disabled={busy}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          )}
        </section>

        {/* Costing */}
        <section className="grid gap-3 sm:grid-cols-2">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl border border-line p-3.5 text-sm">
            <dt className="text-muted">Purchase (net)</dt>
            <dd className="text-right tabular-nums">{formatPaise(v.purchase?.netPayablePaise ?? v.agreedValuePaise)}</dd>
            <dt className="text-muted">Reconditioning</dt>
            <dd className="text-right tabular-nums">{formatPaise(total)}</dd>
            <dt className="font-semibold">Landed cost</dt>
            <dd className="text-right font-semibold tabular-nums" data-testid="landed-cost">
              {formatPaise(landed)}
            </dd>
            {proposed != null && (
              <>
                <dt className="text-muted">Margin at proposed price</dt>
                <dd className={cn("text-right font-medium tabular-nums", proposed - landed < 0 ? "text-danger" : "text-ok")}>{formatPaise(proposed - landed)}</dd>
              </>
            )}
          </dl>
          {manage ? (
            <Field label="Proposed selling price" htmlFor="proposed-price" hint={`Landed cost ${formatPaise(landed)}`}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <RupeeInput id="proposed-price" value={price} onChange={setPrice} placeholder="1,25,000" />
                </div>
                <Button
                  size="lg"
                  disabled={busy || !price || Number(price) * 100 === proposed}
                  onClick={() => run(() => setProposedPrice(v.id, Number(price) * 100), "Proposed price saved")}
                >
                  Save
                </Button>
              </div>
            </Field>
          ) : (
            <div className="rounded-xl border border-line p-3.5 text-sm">
              <p className="text-muted">Proposed selling price</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{proposed != null ? formatPaise(proposed) : "Not set"}</p>
            </div>
          )}
        </section>

        {/* Photos */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Completion photos</h3>
            <Pill tone={photosLeft ? "warn" : "ok"} icon={photosLeft ? <Camera className="size-3" /> : <CheckCircle2 className="size-3" />}>
              {recon.photos.length} of {MIN_COMPLETION_PHOTOS} required
            </Pill>
          </div>
          <PhotoGrid photos={recon.photos} onRemove={manage ? (i) => run(() => removeReconPhoto(v.id, i), "Photo removed") : undefined} />
          {recon.photos.length === 0 && !manage && <p className="text-sm text-muted">No photos yet.</p>}
          {manage && (
            <>
              <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} data-testid="recon-photo-input" />
              <Button className="mt-2 w-full sm:w-auto" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Add photos
              </Button>
            </>
          )}
          {manage && !locked && (
            <p className="mt-2 text-xs text-muted">
              {photosLeft
                ? `Add ${photosLeft} more photo${photosLeft > 1 ? "s" : ""} (front, rear, both sides) before you can sign off.`
                : "Photo requirement met. Sign off when the work is complete."}
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
