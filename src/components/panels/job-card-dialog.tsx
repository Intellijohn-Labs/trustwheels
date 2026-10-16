"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, Plus, ShieldCheck, Trash2, Undo2, UserRound, Wrench, X } from "lucide-react";
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
  setReconDates,
  setServiceAdvisor,
  setTechnician,
} from "@/lib/stock-store";
import { formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import { reconCostPaise, reconHours } from "@/lib/workflow";
import type { JobKind, Vehicle } from "@/lib/types";
import { useAction } from "../toast";
import { Button, Segmented, cn, inputClass } from "../ui";
import { AceCard } from "../vehicle/ace-card";
import { Dialog, VehicleSummary } from "./dialog";
import { formatHours } from "./vehicle-cell";

export const JOB_KINDS: { value: JobKind; label: string }[] = [
  { value: "part", label: "Part" },
  { value: "labour", label: "Labour" },
  { value: "vendor", label: "Vendor" },
];

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

export function PhotoGrid({ photos, onRemove, label = "Photo" }: { photos: string[]; onRemove?: (index: number) => void; label?: string }) {
  if (!photos.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {photos.map((src, i) => (
        <li key={i} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-sunken">
          <a href={src} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${label} ${i + 1}`} className="size-full object-cover" />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

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
  const [technician, setTechnicianInput] = useState(recon.technicianName ?? "");
  const [advisor, setAdvisorInput] = useState(recon.serviceAdvisor ?? "");
  const [startDate, setStartDate] = useState(recon.reconStartDate ? recon.reconStartDate.slice(0, 10) : "");
  const [startTime, setStartTime] = useState(recon.reconStartDate && recon.reconStartDate.length > 10 ? recon.reconStartDate.slice(11, 16) : "");
  const [endDate, setEndDate] = useState(recon.reconEndDate ? recon.reconEndDate.slice(0, 10) : "");
  const [endTime, setEndTime] = useState(recon.reconEndDate && recon.reconEndDate.length > 10 ? recon.reconEndDate.slice(11, 16) : "");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { items: staff } = employees.useItems();
  const technicianOptions = [...new Set(staff.filter((e) => e.status === "active").map((e) => e.name))].sort();

  const total = reconCostPaise(v);
  const photosLeft = Math.max(0, MIN_COMPLETION_PHOTOS - recon.photos.length);
  const lastSendBack = recon.sendBacks.at(-1);

  function saveDates(sDate: string, sTime: string, eDate: string, eTime: string) {
    const fullStart = sDate ? (sTime ? `${sDate}T${sTime}` : sDate) : undefined;
    const fullEnd = eDate ? (eTime ? `${eDate}T${eTime}` : eDate) : undefined;
    run(() => setReconDates(v.id, fullStart, fullEnd));
  }

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
      title="Workshop Job Card"
      subtitle={
        <>
          <VehicleSummary vehicle={v} /> · Stock #{v.stockId || "PENDING"}
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
              disabled={busy || photosLeft > 0 || !technician.trim() || !startDate || !endDate}
              onClick={() => run(() => completeRecon(v.id), "Work signed off. Sent to the quality gate.")}
            >
              <ShieldCheck className="size-4" /> Authorize & Sign off
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
      <div className="space-y-4">
        <AceCard vehicle={v} />

        {/* Physical Job Card Inspection Sheet Header */}
        <div className="rounded-xl border border-line bg-gradient-to-b from-sunken/80 to-panel p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-brand">TrustWheels Service Center</span>
                <span className="text-xs text-muted">/</span>
                <span className="font-mono text-xs font-semibold text-muted">Angamaly Recon Hub</span>
              </div>
              <h2 className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">
                JOB CARD #{v.stockId || "PENDING"}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-line bg-panel px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                  {v.registrationNo || "NO REG"}
                </span>
              </div>
              <span className="text-xs text-muted">
                ⏱ {formatHours(reconHours(v, now))} elapsed · Entry: {formatDateTime(String(v.createdAt || new Date().toISOString()))}
              </span>
            </div>
          </div>

          {/* Vehicle Metadata & Tech Assignment Matrix */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">Vehicle</span>
              <span className="mt-0.5 block truncate font-medium text-foreground">{v.make} {v.model}</span>
              <span className="text-[11px] text-muted">{v.variant || "Standard"}</span>
            </div>
            <div className="rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">Supervisor</span>
              <span className="mt-0.5 block font-medium text-foreground">{recon.supervisor || "Unassigned"}</span>
              <span className="text-[11px] text-muted">Floor In-Charge</span>
            </div>
            <div className="rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">Service Advisor</span>
              <div className="mt-1 flex items-center gap-2">
                <UserRound className="size-3.5 shrink-0 text-brand" />
                {manage && !locked ? (
                  <>
                    <input
                      aria-label="Service advisor name"
                      list="advisor-options"
                      value={advisor}
                      onChange={(e) => setAdvisorInput(e.target.value)}
                      onBlur={() => advisor.trim() !== (recon.serviceAdvisor ?? "") && run(() => setServiceAdvisor(v.id, advisor))}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      placeholder="Assign…"
                      className="h-7 w-full min-w-0 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                    />
                    <datalist id="advisor-options">
                      {technicianOptions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <span className="truncate text-xs font-medium text-foreground">{recon.serviceAdvisor || "Not assigned"}</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Lead Technician <span className="text-red-500 font-bold">*</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Wrench className="size-3.5 text-brand shrink-0" />
                {manage && !locked ? (
                  <>
                    <input
                      aria-label="Technician name"
                      list="technician-options"
                      value={technician}
                      onChange={(e) => setTechnicianInput(e.target.value)}
                      onBlur={() => technician.trim() !== (recon.technicianName ?? "") && run(() => setTechnician(v.id, technician))}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      placeholder="Assign…"
                      className="h-7 w-full min-w-0 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                    />
                    <datalist id="technician-options">
                      {technicianOptions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <span className="truncate text-xs font-medium text-foreground">{recon.technicianName || "Not assigned"}</span>
                )}
              </div>
            </div>

            {/* Reconditioning Timeline (Start Date & End Date) */}
            <div className="col-span-2 rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Recon Start Date & Time <span className="text-red-500 font-bold">*</span>
              </span>
              {manage && !locked ? (
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      saveDates(e.target.value, startTime, endDate, endTime);
                    }}
                    className="h-7 flex-1 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      saveDates(startDate, e.target.value, endDate, endTime);
                    }}
                    title="Optional time"
                    className="h-7 w-24 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                  />
                </div>
              ) : (
                <span className="mt-1 block text-xs font-medium text-foreground">
                  {recon.reconStartDate ? recon.reconStartDate.replace("T", " ") : "Not set"}
                </span>
              )}
            </div>

            <div className="col-span-2 rounded-lg border border-line/60 bg-panel/70 p-2.5">
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Recon End Date & Time <span className="text-red-500 font-bold">*</span>
              </span>
              {manage && !locked ? (
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      saveDates(startDate, startTime, e.target.value, endTime);
                    }}
                    className="h-7 flex-1 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      saveDates(startDate, startTime, endDate, e.target.value);
                    }}
                    title="Optional time"
                    className="h-7 w-24 rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                  />
                </div>
              ) : (
                <span className="mt-1 block text-xs font-medium text-foreground">
                  {recon.reconEndDate ? recon.reconEndDate.replace("T", " ") : "Not set"}
                </span>
              )}
            </div>
          </div>
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

        {/* Itemized Work Ledger Sheet */}
        <section className="rounded-xl border border-line bg-panel overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-line bg-sunken/50 px-4 py-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Work & Spares Ledger ({recon.items.length} items)
            </h3>
            <span className="font-mono text-xs font-semibold text-brand">
              Recon Subtotal: {formatPaise(total)}
            </span>
          </div>

          {recon.items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">
              No parts, labour, or vendor jobs recorded on this job card yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-sunken/20 text-muted">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Type</th>
                    <th className="px-3.5 py-2 font-medium">Description</th>
                    <th className="px-3.5 py-2 text-right font-medium">Cost</th>
                    {manage && !locked && <th className="w-10 px-2 py-2 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {recon.items.map((item) => (
                    <tr key={item.id} className="hover:bg-sunken/30 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <span className={cn(
                          "inline-block rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
                          item.kind === "part" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                          item.kind === "labour" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                          "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        )}>
                          {item.kind}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-foreground">{item.description}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                        {formatPaise(item.costPaise)}
                      </td>
                      {manage && !locked && (
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => run(() => removeJobItem(v.id, item.id), "Item removed")}
                            aria-label={`Remove ${item.description}`}
                            className="inline-grid size-6 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Job Item Form - Two clean, uncrowded rows */}
          {manage && !locked && (
            <div className="border-t border-line bg-sunken/40 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Select Item Category
                </span>
                <div className="w-full sm:w-64">
                  <Segmented
                    name="job-kind"
                    value={kind}
                    onChange={(k) => setKind(k as JobKind)}
                    options={JOB_KINDS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      kind === "vendor"
                        ? "Vendor work (e.g. Lathe work, Painting, Upholstery)..."
                        : kind === "part"
                        ? "Part name (e.g. Engine oil, Brake pads, Air filter)..."
                        : "Labour work (e.g. General service, Fork overhaul)..."
                    }
                    className={cn(inputClass(), "h-9 w-full text-xs")}
                  />
                </div>
                <div className="sm:col-span-3">
                  <RupeeInput
                    id="cost-input"
                    value={cost}
                    onChange={setCost}
                    placeholder="Cost"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy || !description.trim() || !cost}
                    onClick={addItem}
                    className="h-9 w-full text-xs font-semibold"
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Visual Inspection & Completion Photos */}
        <section className="rounded-xl border border-line bg-panel p-3.5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Inspection & Completion Photos
              </h3>
              <p className="text-[11px] text-muted">Minimum 2 photos required for sign-off (no upper limit).</p>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold",
              photosLeft === 0 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            )}>
              {recon.photos.length} captured (min 2)
            </span>
          </div>

          <PhotoGrid
            photos={recon.photos}
            onRemove={manage && !locked ? (i) => run(() => removeReconPhoto(v.id, i), "Photo removed") : undefined}
          />

          {manage && !locked && (
            <div className="mt-3">
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => addPhotos(e.target.files)}
                className="hidden"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || uploading}
                onClick={() => fileInput.current?.click()}
                className="text-xs"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                Upload Photos
              </Button>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
