"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, Plus, ShieldCheck, Trash2, Undo2, Wrench, X } from "lucide-react";
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
  setTechnician,
} from "@/lib/stock-store";
import { formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import { reconCostPaise, reconHours } from "@/lib/workflow";
import type { JobKind, Vehicle } from "@/lib/types";
import { useAction } from "../toast";
import { Button, Segmented, cn, inputClass } from "../ui";
import { Dialog, VehicleSummary } from "./dialog";
import { ReconFlagPill } from "./recon-panel";
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
  const [startDate, setStartDate] = useState(recon.reconStartDate ? recon.reconStartDate.slice(0, 10) : "");
  const [startTime, setStartTime] = useState(recon.reconStartDate && recon.reconStartDate.length > 10 ? recon.reconStartDate.slice(11, 16) : "");
  const [endDate, setEndDate] = useState(recon.reconEndDate ? recon.reconEndDate.slice(0, 10) : "");
  const [endTime, setEndTime] = useState(recon.reconEndDate && recon.reconEndDate.length > 10 ? recon.reconEndDate.slice(11, 16) : "");
  const [uploading, setUploading] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
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
        {/* 3D Flip Playing Card for Vehicle Specs */}
        <div className="flex justify-center py-1">
          <div
            className="group relative h-56 w-full max-w-sm cursor-pointer [perspective:1200px]"
            onClick={() => setShowSpecs(!showSpecs)}
            title="Click to flip card"
          >
            <div
              className={cn(
                "relative size-full rounded-2xl transition-all duration-700 [transform-style:preserve-3d]",
                showSpecs ? "[transform:rotateY(180deg)]" : ""
              )}
            >
              {/* FRONT: Adaptive Rummy Card using [data-theme] attribute */}
              <div className="absolute inset-0 size-full rounded-2xl border-4 border-slate-200 [html[data-theme='dark']_&]:border-slate-800 bg-white [html[data-theme='dark']_&]:bg-slate-900 p-3 [backface-visibility:hidden] flex flex-col justify-between overflow-hidden shadow-xl [html[data-theme='dark']_&]:shadow-cyan-950/40">
                {/* Decorative Inset Border */}
                <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-red-600/40 [html[data-theme='dark']_&]:border-cyan-400/40"></div>
                <div className="pointer-events-none absolute inset-2 rounded-lg border border-red-500/20 [html[data-theme='dark']_&]:border-cyan-500/20"></div>

                {/* Top Corner Pip */}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center leading-none text-red-600 [html[data-theme='dark']_&]:text-cyan-400 font-serif">
                      <span className="text-base font-extrabold">A</span>
                      <span className="text-xs [html[data-theme='dark']_&]:hidden">♥</span>
                      <span className="text-xs hidden [html[data-theme='dark']_&]:inline">♠</span>
                    </div>
                    <div className="pl-1">
                      <span className="block font-sans text-xs font-black tracking-tight text-slate-900 [html[data-theme='dark']_&]:text-white">
                        {v.make} {v.model}
                      </span>
                      <span className="block text-[10px] font-semibold text-slate-500 [html[data-theme='dark']_&]:text-slate-400 font-mono">
                        {v.variant || "Standard"}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-md border border-red-300 [html[data-theme='dark']_&]:border-cyan-700 bg-red-50 [html[data-theme='dark']_&]:bg-cyan-950/80 px-2 py-0.5 font-mono text-[11px] font-bold text-red-700 [html[data-theme='dark']_&]:text-cyan-300 shadow-sm">
                    {v.registrationNo || "KL REG"}
                  </span>
                </div>

                {/* Center: Rummy Bike Emblem */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center py-0.5">
                    <svg
                      className="size-20 transition-transform duration-300 group-hover:scale-105"
                      viewBox="0 0 200 120"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Rear Wheel */}
                      <circle cx="45" cy="85" r="22" className="stroke-slate-800 [html[data-theme='dark']_&]:stroke-slate-200" strokeWidth="4" />
                      <circle cx="45" cy="85" r="13" className="stroke-red-600 [html[data-theme='dark']_&]:stroke-cyan-400" strokeWidth="2.5" strokeDasharray="4 2" />
                      <circle cx="45" cy="85" r="4" className="fill-red-600 [html[data-theme='dark']_&]:fill-cyan-400" />
                      {/* Front Wheel */}
                      <circle cx="155" cy="85" r="22" className="stroke-slate-800 [html[data-theme='dark']_&]:stroke-slate-200" strokeWidth="4" />
                      <circle cx="155" cy="85" r="13" className="stroke-red-600 [html[data-theme='dark']_&]:stroke-cyan-400" strokeWidth="2.5" strokeDasharray="4 2" />
                      <circle cx="155" cy="85" r="4" className="fill-red-600 [html[data-theme='dark']_&]:fill-cyan-400" />
                      {/* Frame */}
                      <path d="M45 85 L85 85 L115 55 L70 55 Z" className="stroke-red-600 [html[data-theme='dark']_&]:stroke-cyan-400" strokeWidth="4" />
                      <path d="M85 85 L135 45" className="stroke-red-700 [html[data-theme='dark']_&]:stroke-cyan-500" strokeWidth="3.5" />
                      {/* Front Fork */}
                      <path d="M155 85 L135 35 L125 35" className="stroke-slate-800 [html[data-theme='dark']_&]:stroke-slate-200" strokeWidth="4" />
                      <path d="M135 35 L145 32" className="stroke-slate-600 [html[data-theme='dark']_&]:stroke-slate-400" strokeWidth="3" />
                      {/* Tank */}
                      <path d="M70 55 Q95 38 120 48" className="stroke-red-600 [html[data-theme='dark']_&]:stroke-cyan-400" strokeWidth="5" />
                      <path d="M55 58 Q70 50 85 58" className="stroke-slate-800 [html[data-theme='dark']_&]:stroke-slate-200" strokeWidth="5" />
                      {/* Headlight beam */}
                      <polygon points="145,35 185,22 185,50" className="fill-red-500/15 [html[data-theme='dark']_&]:fill-cyan-400/20" />
                      {/* Exhaust */}
                      <path d="M85 75 L60 88 L35 88" className="stroke-slate-500 [html[data-theme='dark']_&]:stroke-slate-400" strokeWidth="3.5" />
                    </svg>
                  </div>
                  <span className="font-serif text-[10px] font-bold tracking-wider text-red-700/80 [html[data-theme='dark']_&]:text-cyan-400/90 uppercase">
                    ♦ TrustWheels Ace Card · Tap to Flip ♦
                  </span>
                </div>

                {/* Bottom Corner Pip */}
                <div className="relative z-10 flex items-end justify-between">
                  <span className="font-mono text-[9px] font-semibold text-slate-400 [html[data-theme='dark']_&]:text-slate-500">FLIP FOR SPECS ↻</span>
                  <div className="flex flex-col items-center leading-none text-red-600 [html[data-theme='dark']_&]:text-cyan-400 font-serif rotate-180">
                    <span className="text-base font-extrabold">A</span>
                    <span className="text-xs [html[data-theme='dark']_&]:hidden">♥</span>
                    <span className="text-xs hidden [html[data-theme='dark']_&]:inline">♠</span>
                  </div>
                </div>
              </div>

              {/* BACK: Rummy Card Back */}
              <div className="absolute inset-0 size-full rounded-2xl border-4 border-slate-200 [html[data-theme='dark']_&]:border-slate-800 bg-red-700 [html[data-theme='dark']_&]:bg-slate-950 p-2.5 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-between overflow-y-auto shadow-xl text-xs">
                <div className="relative size-full rounded-xl border border-red-300/60 [html[data-theme='dark']_&]:border-cyan-500/30 bg-red-800 [html[data-theme='dark']_&]:bg-slate-900 p-2.5 flex flex-col justify-between">
                  
                  <div className="flex items-center justify-between border-b border-red-600 [html[data-theme='dark']_&]:border-slate-800 pb-1 text-white">
                    <div className="flex items-center gap-1 font-bold text-[11px] text-white [html[data-theme='dark']_&]:text-cyan-300">
                      <span className="[html[data-theme='dark']_&]:hidden">♥</span>
                      <span className="hidden [html[data-theme='dark']_&]:inline">♠</span>
                      <span>Mechanical Specifications</span>
                    </div>
                    <span className="text-[10px] text-red-200 [html[data-theme='dark']_&]:text-cyan-400 font-mono">Flip Back ↺</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 my-1 text-[11px]">
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Engine CC</span>
                      <span className="font-mono font-bold text-red-700 [html[data-theme='dark']_&]:text-cyan-400">{v.engineCc ? `${v.engineCc} cc` : "—"}</span>
                    </div>
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Year / Fuel</span>
                      <span className="font-semibold text-slate-800 [html[data-theme='dark']_&]:text-slate-200 truncate">{v.year} · {v.fuel ? v.fuel.toUpperCase() : "PETROL"}</span>
                    </div>
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Odo (KM)</span>
                      <span className="font-mono font-bold text-slate-900 [html[data-theme='dark']_&]:text-white">{v.odometerKm ? v.odometerKm.toLocaleString() : "—"}</span>
                    </div>
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Front Tyre</span>
                      <span className="font-mono font-bold text-slate-800 [html[data-theme='dark']_&]:text-slate-200">{v.frontTyrePercent != null ? `${v.frontTyrePercent}%` : "—"}</span>
                    </div>
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Rear Tyre</span>
                      <span className="font-mono font-bold text-slate-800 [html[data-theme='dark']_&]:text-slate-200">{v.rearTyrePercent != null ? `${v.rearTyrePercent}%` : "—"}</span>
                    </div>
                    <div className="rounded border border-red-200/50 [html[data-theme='dark']_&]:border-slate-700 bg-white [html[data-theme='dark']_&]:bg-slate-950 p-1 shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Battery</span>
                      <span className="font-bold text-emerald-700 [html[data-theme='dark']_&]:text-emerald-400 uppercase">{v.batteryStatus || "GOOD"}</span>
                    </div>
                  </div>

                  <div className="rounded border border-red-200/40 [html[data-theme='dark']_&]:border-slate-800 bg-white/95 [html[data-theme='dark']_&]:bg-slate-950/90 p-1.5 text-[10px] space-y-0.5">
                    <div className="truncate text-slate-700 [html[data-theme='dark']_&]:text-slate-300">
                      <span className="font-bold text-slate-500 [html[data-theme='dark']_&]:text-slate-400">Chassis: </span>
                      <span className="font-mono font-bold text-slate-900 [html[data-theme='dark']_&]:text-cyan-300">{v.chassisNo || "—"}</span>
                    </div>
                    {v.knownDefects && (
                      <div className="text-red-700 [html[data-theme='dark']_&]:text-rose-400 truncate border-t border-slate-200 [html[data-theme='dark']_&]:border-slate-800 pt-0.5 font-medium">
                        <span className="font-bold">Defect: </span>{v.knownDefects}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

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
                <ReconFlagPill vehicle={v} now={now} />
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
            <div className="col-span-2 rounded-lg border border-line/60 bg-panel/70 p-2.5 sm:col-span-2">
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
                      placeholder="Assign Lead Technician (Required)..."
                      className="h-7 w-full rounded border border-line bg-panel px-2 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
                    />
                    <datalist id="technician-options">
                      {technicianOptions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <span className="text-xs font-medium text-foreground">{recon.technicianName || "Not assigned"}</span>
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
