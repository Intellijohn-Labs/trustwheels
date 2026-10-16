"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import { mfgLabel } from "@/lib/deck";
import type { Vehicle } from "@/lib/types";
import { cn } from "../ui";

/** Corner motif: ace of hearts on the light theme, ace of spades on dark. */
function Pip({ flipped }: { flipped?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center font-serif leading-none text-[var(--ace)]", flipped && "rotate-180")} aria-hidden>
      <span className="text-lg font-extrabold">A</span>
      <span className="text-sm [html[data-theme='dark']_&]:hidden">♥</span>
      <span className="hidden text-sm [html[data-theme='dark']_&]:inline">♠</span>
    </div>
  );
}

function BikeEmblem() {
  const id = useId();
  return (
    <div className="relative grid place-items-center">
      <div
        className="absolute size-24 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--ace) 45%, transparent), transparent 70%)" }}
        aria-hidden
      />
      <svg
        viewBox="0 0 200 120"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative h-[84px] w-[140px] transition-transform duration-300 group-hover:scale-105"
        style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--ace) 55%, transparent))" }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ace-2)" />
            <stop offset="1" stopColor="var(--ace)" />
          </linearGradient>
        </defs>
        {/* wheels */}
        {[45, 155].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="85" r="22" stroke="#e2e8f0" strokeWidth="3.5" />
            <circle cx={cx} cy="85" r="13" stroke={`url(#${id}-g)`} strokeWidth="2.5" strokeDasharray="4 3" />
            <circle cx={cx} cy="85" r="3.5" fill={`url(#${id}-g)`} />
          </g>
        ))}
        {/* frame, tank, fork */}
        <path d="M45 85 L85 85 L115 55 L70 55 Z" stroke={`url(#${id}-g)`} strokeWidth="4" />
        <path d="M85 85 L135 45" stroke={`url(#${id}-g)`} strokeWidth="3.5" />
        <path d="M155 85 L135 35 L125 35" stroke="#e2e8f0" strokeWidth="4" />
        <path d="M135 35 L145 32" stroke="#94a3b8" strokeWidth="3" />
        <path d="M70 55 Q95 38 120 48" stroke={`url(#${id}-g)`} strokeWidth="5" />
        <path d="M55 58 Q70 50 85 58" stroke="#e2e8f0" strokeWidth="5" />
        <path d="M85 75 L60 88 L35 88" stroke="#94a3b8" strokeWidth="3.5" />
        {/* headlight beam */}
        <polygon points="145,35 188,21 188,51" fill="var(--ace)" fillOpacity="0.16" />
      </svg>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ace-tile min-w-0">
      <span className="block truncate text-[10px] font-semibold tracking-wider text-gray-400 uppercase max-[389px]:text-[9px] max-[389px]:tracking-normal">{label}</span>
      <span className="mt-0.5 block truncate font-mono text-[13px] font-bold tracking-tight sm:text-sm sm:tracking-normal">{children}</span>
    </div>
  );
}

/**
 * The TrustWheels "Ace Card": a playing card for the vehicle. Front is the identity (name,
 * registration, emblem); tap to flip to the specs. See globals.css (.ace-*) for the 3D rules.
 */
export function AceCard({ vehicle: v }: { vehicle: Vehicle }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="flex justify-center py-1">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "Vehicle specifications. Press to flip back." : `${v.make} ${v.model} card. Press to see specifications.`}
        onClick={toggle}
        onKeyDown={onKey}
        className="ace-scene group h-64 w-full max-w-sm cursor-pointer rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
      >
        <div className="ace-tilt">
          <div className="ace-card" data-flipped={flipped}>
            {/* FRONT */}
            <div className="ace-front ace-face flex flex-col justify-between p-4" aria-hidden={flipped}>
              <div className="relative flex items-start gap-3">
                <Pip />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold tracking-tight text-white">
                    {v.make} {v.model}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-gray-400">{v.variant || "Standard"}</span>
                </div>
                <span className="ace-glass shrink-0 rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-white">{v.registrationNo || "KL REG"}</span>
              </div>

              <div className="relative flex justify-center">
                <BikeEmblem />
              </div>

              <div className="relative flex items-end justify-between">
                <div>
                  <span className="block font-serif text-[10px] font-bold tracking-[0.2em] text-[var(--ace)] uppercase">TrustWheels · Ace Card</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                    <RotateCcw className="size-3" /> Tap to see specs
                  </span>
                </div>
                <Pip flipped />
              </div>
            </div>

            {/* BACK */}
            <div className="ace-back ace-face flex flex-col gap-2.5 p-4 max-[359px]:p-3" aria-hidden={!flipped}>
              <div className="relative flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[var(--ace)] uppercase">
                <span className="[html[data-theme='dark']_&]:hidden">♥</span>
                <span className="hidden [html[data-theme='dark']_&]:inline">♠</span>
                Specifications
              </div>

              <div className="relative grid grid-cols-3 gap-2">
                <Metric label="Engine CC">
                  <span className="text-[var(--ace)]">{v.engineCc ? `${v.engineCc} cc` : "—"}</span>
                </Metric>
                <Metric label={`Mfg · ${v.fuel === "electric" ? "EV" : "Petrol"}`}>
                  <span className="text-white">{mfgLabel(v)}</span>
                </Metric>
                <Metric label="Odo (km)">
                  <span className="text-[var(--ace)]">{v.odometerKm ? v.odometerKm.toLocaleString("en-IN") : "—"}</span>
                </Metric>
                <Metric label="Front tyre">
                  <span className="text-white">{v.frontTyrePercent != null ? `${v.frontTyrePercent}%` : "—"}</span>
                </Metric>
                <Metric label="Rear tyre">
                  <span className="text-white">{v.rearTyrePercent != null ? `${v.rearTyrePercent}%` : "—"}</span>
                </Metric>
                <Metric label="Battery">
                  <span className={v.batteryStatus === "not_good" ? "text-red-400" : v.batteryStatus ? "text-emerald-400" : "text-gray-500"}>
                    {v.batteryStatus === "not_good" ? "Bad" : v.batteryStatus ? "Good" : "—"}
                  </span>
                </Metric>
              </div>

              <div className="relative mt-auto flex flex-col gap-1.5">
                {v.knownDefects && (
                  <p className="truncate text-[11px] font-medium text-rose-300">
                    <span className="font-bold">Defect:</span> {v.knownDefects}
                  </p>
                )}
                <div className="ace-tile flex items-center justify-between gap-3 !py-1.5">
                  <span className="min-w-0 truncate text-[11px]">
                    <span className="font-semibold tracking-wider text-gray-400 uppercase">Chassis </span>
                    <span className="font-mono font-bold text-white">{v.chassisNo || "—"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-gray-500">
                    <RotateCcw className="size-3" /> Tap to flip back
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
