"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronDown, Clock, ChevronUp, Info, Loader2, Plus, ShieldCheck, Trash2, Undo2, UserRound, Wrench, X } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { localInput } from "@/lib/datetime-input";
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

type SignOffField = "advisor" | "technician" | "start" | "end" | "photos";

const cardCls = (invalid: boolean) => cn("rounded-lg border bg-panel/70 p-2.5", invalid ? "border-danger ring-1 ring-danger" : "border-line/60");
const smallInput = (invalid: boolean, width: string) =>
  cn("h-7 rounded border bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none", width, invalid ? "border-danger" : "border-line");

/** Stored dates may be date-only ("2026-10-16", older records) or "YYYY-MM-DDTHH:mm"; <input type="datetime-local"> needs the latter. */
const toLocalInput = (s?: string) => (!s ? "" : s.length === 10 ? `${s}T00:00` : s.slice(0, 16));

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] font-semibold text-foreground transition hover:border-brand hover:text-brand"
    >
      <Clock className="size-3" /> {children}
    </button>
  );
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
  // Start defaults to when the vehicle was entered into stock, end to the moment this card was opened. Both are
  // editable, and are saved when changed or at sign-off.
  const entryAt = Number.isNaN(Date.parse(v.createdAt)) ? "" : localInput(Date.parse(v.createdAt));
  const [startAt, setStartAt] = useState(() => toLocalInput(recon.reconStartDate) || entryAt);
  const [endAt, setEndAt] = useState(() => toLocalInput(recon.reconEndDate) || localInput(Date.now()));
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { items: staff } = employees.useItems();
  const technicianOptions = [...new Set(staff.filter((e) => e.status === "active").map((e) => e.name))].sort();

  const total = reconCostPaise(v);
  const photosLeft = Math.max(0, MIN_COMPLETION_PHOTOS - recon.photos.length);

  // Sign-off checks. The button is always clickable; clicking it with something missing lists what, outlines it in red and scrolls to it.
  const [attempted, setAttempted] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);
  const issues: { key: SignOffField; message: string }[] = [];
  if (!advisor.trim()) issues.push({ key: "advisor", message: "Please assign a Service Advisor" });
  if (!technician.trim()) issues.push({ key: "technician", message: "Please assign a Lead Technician" });
  if (!startAt) issues.push({ key: "start", message: "Enter the recon start date and time" });
  if (!endAt) issues.push({ key: "end", message: "Enter the recon end date and time" });
  else if (startAt && endAt < startAt) issues.push({ key: "end", message: "End time can't be before the start time" });
  if (photosLeft > 0) issues.push({ key: "photos", message: `Minimum ${MIN_COMPLETION_PHOTOS} inspection photos required (${recon.photos.length}/${MIN_COMPLETION_PHOTOS} added)` });
  // Highlights follow the live values once a sign-off has been attempted, so each clears as it's fixed.
  const bad = new Set<SignOffField>(attempted ? issues.map((i) => i.key) : []);
  const startBad = bad.has("start");
  const endBad = bad.has("end");

  useEffect(() => {
    if (!attemptTick) return;
    const first = document.querySelector<HTMLElement>("[data-signoff-error]");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
  }, [attemptTick]);

  // Not a disabled button: a name field saving on blur sets `busy` mid-click and would swallow the click.
  const signing = useRef(false);

  async function handleSignOff() {
    if (signing.current) return;
    setAttempted(true);
    if (issues.length) {
      setAttemptTick((t) => t + 1);
      return;
    }
    signing.current = true;
    await run(async () => {
      // Names save on blur; flush any typed-but-unsaved one first so the sign-off can't race ahead of it.
      if (technician.trim() !== (recon.technicianName ?? "")) await setTechnician(v.id, technician);
      if (advisor.trim() !== (recon.serviceAdvisor ?? "")) await setServiceAdvisor(v.id, advisor);
      // Start/end may still be the defaults shown on screen, which aren't stored until they change.
      if (startAt !== toLocalInput(recon.reconStartDate) || endAt !== toLocalInput(recon.reconEndDate)) await setReconDates(v.id, startAt, endAt);
      await completeRecon(v.id);
    }, "Work signed off. The vehicle is back in stock for sale-readiness review.");
    signing.current = false;
  }
  const lastSendBack = recon.sendBacks.at(-1);

  function saveDates(start: string, end: string) {
    run(() => setReconDates(v.id, start || undefined, end || undefined));
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
          <div className="flex w-full flex-col gap-3">
            {attempted && issues.length > 0 && (
              <div role="alert" className="rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                <p className="font-semibold">Cannot sign off:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {issues.map((i) => (
                    <li key={i.message}>{i.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <Button size="lg" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button size="lg" variant="success" className="flex-[2]" onClick={handleSignOff}>
                <ShieldCheck className="size-4" /> Authorize & Sign off
                {photosLeft > 0 && <span className="font-normal">· {recon.photos.length}/{MIN_COMPLETION_PHOTOS} photos</span>}
              </Button>
            </div>
          </div>
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

          {/* Vehicle, people and timeline */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="col-span-2 rounded-lg border border-line/60 bg-panel/70 p-2.5 sm:col-span-1">
              <span className="block font-semibold uppercase tracking-wider text-muted">Vehicle</span>
              <span className="mt-0.5 block truncate font-medium text-foreground">{v.make} {v.model}</span>
              <span className="text-[11px] text-muted">{v.variant || "Standard"}</span>
            </div>
            <div className={cardCls(bad.has("advisor"))} data-signoff-error={bad.has("advisor") ? "" : undefined}>
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Service Advisor <span className="text-red-500 font-bold">*</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <UserRound className="size-3.5 shrink-0 text-brand" />
                {manage && !locked ? (
                  <>
                    <input
                      id="service_advisor_input"
                      name="service_advisor_name"
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      aria-label="Service advisor name"
                      list="advisor-options"
                      value={advisor}
                      onChange={(e) => setAdvisorInput(e.target.value)}
                      onBlur={() => advisor.trim() !== (recon.serviceAdvisor ?? "") && run(() => setServiceAdvisor(v.id, advisor))}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      placeholder="Assign…"
                      className={smallInput(bad.has("advisor"), "w-full min-w-0")}
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
            <div className={cardCls(bad.has("technician"))} data-signoff-error={bad.has("technician") ? "" : undefined}>
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Lead Technician <span className="text-red-500 font-bold">*</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Wrench className="size-3.5 text-brand shrink-0" />
                {manage && !locked ? (
                  <>
                    <input
                      id="lead_technician_input"
                      name="lead_technician_name"
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      aria-label="Technician name"
                      list="technician-options"
                      value={technician}
                      onChange={(e) => setTechnicianInput(e.target.value)}
                      onBlur={() => technician.trim() !== (recon.technicianName ?? "") && run(() => setTechnician(v.id, technician))}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      placeholder="Assign…"
                      className={smallInput(bad.has("technician"), "w-full min-w-0")}
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
          </div>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div className={cardCls(startBad)} data-signoff-error={startBad ? "" : undefined}>
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Recon Start Date & Time <span className="text-red-500 font-bold">*</span>
              </span>
              {manage && !locked ? (
                <>
                  <input
                    type="datetime-local"
                    aria-label="Recon Start Date & Time"
                    value={startAt}
                    onChange={(e) => {
                      setStartAt(e.target.value);
                      saveDates(e.target.value, endAt);
                    }}
                    className={smallInput(startBad, "mt-1 w-full")}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <QuickButton
                      onClick={() => {
                        const t = localInput(Date.now());
                        setStartAt(t);
                        saveDates(t, endAt);
                      }}
                    >
                      Set to now
                    </QuickButton>
                    {entryAt && (
                      <QuickButton
                        onClick={() => {
                          setStartAt(entryAt);
                          saveDates(entryAt, endAt);
                        }}
                      >
                        Use entry time
                      </QuickButton>
                    )}
                  </div>
                </>
              ) : (
                <span className="mt-1 block text-xs font-medium text-foreground">
                  {recon.reconStartDate ? recon.reconStartDate.replace("T", " ") : "Not set"}
                </span>
              )}
            </div>
            <div className={cardCls(endBad)} data-signoff-error={endBad ? "" : undefined}>
              <span className="block font-semibold uppercase tracking-wider text-muted">
                Recon End Date & Time <span className="text-red-500 font-bold">*</span>
              </span>
              {manage && !locked ? (
                <>
                  <input
                    type="datetime-local"
                    aria-label="Recon End Date & Time"
                    value={endAt}
                    onChange={(e) => {
                      setEndAt(e.target.value);
                      saveDates(startAt, e.target.value);
                    }}
                    className={smallInput(endBad, "mt-1 w-full")}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <QuickButton
                      onClick={() => {
                        const t = localInput(Date.now());
                        setEndAt(t);
                        saveDates(startAt, t);
                      }}
                    >
                      Set to now
                    </QuickButton>
                  </div>
                </>
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
            Signed off by {recon.completed!.by} on {formatDateTime(recon.completed!.at)}.
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
        <section
          className={cn("rounded-xl border bg-panel p-3.5", bad.has("photos") ? "border-danger ring-1 ring-danger" : "border-line")}
          data-signoff-error={bad.has("photos") ? "" : undefined}
        >
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
