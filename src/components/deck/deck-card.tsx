"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { DECK_THEMES, deckStatus, deckStatusLabel, mfgLabel, rankFor, suitFor } from "@/lib/deck";
import { branchName } from "@/lib/masters";
import { displayReg, formatNumber } from "@/lib/format";
import { formatHM } from "@/lib/verification";
import { transitRemainingMs } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { cn } from "../ui";

/** Font size in container units, so type scales with the card's own width. */
const cq = (n: number): CSSProperties => ({ fontSize: `${n}cqw` });

const addedOn = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Rank and suit in a card corner; the bottom-right one is turned upside down, like a real card. */
function Corner({ rank, suit, red, flipped }: { rank: string; suit: string; red: boolean; flipped?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute flex flex-col items-center font-serif leading-none", flipped ? "right-[6cqw] bottom-[5cqw] rotate-180" : "top-[5cqw] left-[6cqw]")}
      style={{ color: red ? "#b91c1c" : "#1c1917" }}
    >
      <span className="font-bold" style={cq(11)}>
        {rank}
      </span>
      <span style={cq(9)}>{suit}</span>
    </div>
  );
}

function Bike() {
  return (
    <div className="relative grid place-items-center">
      <div className="absolute rounded-full blur-2xl" style={{ width: "52cqw", height: "52cqw", background: "radial-gradient(circle, color-mix(in srgb, var(--deck) 55%, transparent), transparent 70%)" }} aria-hidden />
      <svg
        viewBox="0 0 200 120"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative"
        style={{ width: "56cqw", filter: "drop-shadow(0 0 1.4cqw color-mix(in srgb, var(--deck) 55%, transparent))" }}
        aria-hidden
      >
        {[45, 155].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="85" r="22" stroke="#292524" strokeWidth="4" />
            <circle cx={cx} cy="85" r="13" stroke="var(--deck)" strokeWidth="2.5" strokeDasharray="4 3" />
            <circle cx={cx} cy="85" r="3.5" fill="var(--deck)" />
          </g>
        ))}
        <path d="M45 85 L85 85 L115 55 L70 55 Z" stroke="var(--deck)" strokeWidth="4" />
        <path d="M85 85 L135 45" stroke="var(--deck)" strokeWidth="3.5" />
        <path d="M155 85 L135 35 L125 35" stroke="#292524" strokeWidth="4" />
        <path d="M135 35 L145 32" stroke="#78716c" strokeWidth="3" />
        <path d="M70 55 Q95 38 120 48" stroke="var(--deck)" strokeWidth="5" />
        <path d="M55 58 Q70 50 85 58" stroke="#292524" strokeWidth="5" />
        <path d="M85 75 L60 88 L35 88" stroke="#78716c" strokeWidth="3.5" />
        <polygon points="145,35 188,21 188,51" fill="var(--deck)" fillOpacity="0.2" />
      </svg>
    </div>
  );
}

function Spec({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("deck-tile min-w-0", wide && "col-span-2")}>
      <span className="block truncate font-semibold tracking-wider text-white/55 uppercase" style={cq(3.3)}>
        {label}
      </span>
      <span className="mt-[0.6cqw] block truncate font-mono font-bold text-white" style={cq(5)}>
        {children}
      </span>
    </div>
  );
}

/**
 * One vehicle as a playing card. Click once to turn it over (specs, coloured by status), click
 * again to open the full dossier. See globals.css (.deck-*) for the 3D rules.
 */
export function DeckCard({ vehicle: v, now, onOpen }: { vehicle: Vehicle; now: number; onOpen: (v: Vehicle) => void }) {
  const [flipped, setFlipped] = useState(false);
  const status = deckStatus(v);
  const theme = DECK_THEMES[status];
  const suit = suitFor(v.id);
  const rank = rankFor(v);
  const name = `${v.make} ${v.model}`;
  const d = v.dispatch;
  const transit = status === "in_transit" && d && !v.receipt;
  const left = transit ? transitRemainingMs(v, now) : 0;

  const style = { "--deck": theme.accent, "--deck-2": theme.accent2, "--deck-bg1": theme.bg1, "--deck-bg2": theme.bg2 } as CSSProperties;

  return (
    <div className="deck-scene" style={style}>
      <div className="deck-tilt">
        <div className="deck-card" data-flipped={flipped}>
          {/* FRONT */}
          <div className="deck-face deck-front" aria-hidden={flipped}>
            <Corner rank={rank} suit={suit.char} red={suit.red} />
            <Corner rank={rank} suit={suit.char} red={suit.red} flipped />

            <div className="pointer-events-none absolute inset-x-[17cqw] top-[10cqw] bottom-[13cqw] flex flex-col items-center justify-center gap-[3.2cqw] text-center">
              <Bike />
              <div className="w-full">
                <p className="line-clamp-2 font-extrabold tracking-tight" style={{ ...cq(8.4), lineHeight: 1.12 }}>
                  {name}
                </p>
                <p className="truncate font-medium text-stone-500" style={cq(4.4)}>
                  {v.variant || "Standard"}
                </p>
              </div>
              <span className="rounded-full border border-white/20 bg-stone-900 px-[4cqw] py-[1.2cqw] font-mono font-bold tracking-wider text-white shadow-md" style={cq(5.2)}>
                {displayReg(v.registrationNo) || "NO REG"}
              </span>
              <p className="font-medium text-stone-600" style={cq(4.4)}>
                Stock added: {addedOn(v.createdAt)}
              </p>
            </div>

            <p className="pointer-events-none absolute inset-x-0 bottom-[5.4cqw] flex items-center justify-center gap-[1.2cqw] font-semibold tracking-[0.18em] text-stone-400 uppercase" style={cq(3.3)}>
              <RotateCcw style={{ width: "3.6cqw", height: "3.6cqw" }} /> Click to flip card
            </p>

            <button
              type="button"
              tabIndex={flipped ? -1 : 0}
              onClick={() => setFlipped(true)}
              aria-label={`${name}, ${displayReg(v.registrationNo)}. Flip card to see its status and specs.`}
              className="absolute inset-0 cursor-pointer rounded-[5cqw] outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
            />
          </div>

          {/* BACK */}
          <div className="deck-face deck-back" aria-hidden={!flipped}>
            <div className="pointer-events-none absolute inset-x-[7cqw] top-[7cqw] bottom-[6cqw] flex flex-col gap-[3cqw]">
              <div className="flex items-start justify-between gap-[2cqw]">
                <div className="min-w-0">
                  <span className="deck-pill inline-flex items-center gap-[1.6cqw] rounded-full px-[3.4cqw] py-[1.3cqw] font-bold tracking-wider uppercase" style={cq(4.2)}>
                    <span className="rounded-full" style={{ width: "2.2cqw", height: "2.2cqw", background: "var(--deck)", boxShadow: "0 0 1.6cqw var(--deck)" }} />
                    {deckStatusLabel(v, status)}
                  </span>
                  <p className="mt-[2.6cqw] truncate font-extrabold" style={cq(6.8)}>
                    {name}
                  </p>
                  <p className="truncate font-mono text-white/60" style={cq(4)}>
                    {displayReg(v.registrationNo) || "NO REG"} · {branchName(v.branchId)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[2.2cqw]">
                <Spec label="Odometer">{v.odometerKm ? `${formatNumber(v.odometerKm)} km` : "—"}</Spec>
                <Spec label={`Mfg · ${v.fuel === "electric" ? "EV" : "Petrol"}`}>{mfgLabel(v)}</Spec>
                <Spec label={v.fuel === "electric" ? "Motor" : "Engine"}>{v.engineCc ? `${v.engineCc} ${v.fuel === "electric" ? "W" : "cc"}` : "—"}</Spec>
                <Spec label="Tyres F · R">{v.frontTyrePercent != null || v.rearTyrePercent != null ? `${v.frontTyrePercent ?? "–"}% · ${v.rearTyrePercent ?? "–"}%` : "—"}</Spec>
                {transit && d ? (
                  <div className="deck-tile col-span-2 min-w-0">
                    <span className="flex items-center justify-between font-semibold tracking-wider text-white/55 uppercase" style={cq(3.3)}>
                      <span>On the road</span>
                      <span className="font-mono font-bold" style={{ color: left < 0 ? "#fb7185" : "var(--deck-2)" }}>
                        {left < 0 ? `Overdue ${formatHM(-left)}` : `${formatHM(left)} left`}
                      </span>
                    </span>
                    <span className="mt-[0.8cqw] flex items-center gap-[1.4cqw] truncate font-bold text-white" style={cq(4.6)}>
                      {branchName(d.from)} <ArrowRight style={{ width: "4cqw", height: "4cqw", flex: "none" }} /> {branchName(d.to)}
                    </span>
                    <span className="block truncate text-white/60" style={cq(3.8)}>
                      Rider {d.rider} · {formatHM(now - new Date(d.handoverAt).getTime())} elapsed
                    </span>
                  </div>
                ) : (
                  <>
                    <Spec label="Battery">
                      <span style={{ color: v.batteryStatus === "not_good" ? "#fb7185" : v.batteryStatus ? "#34d399" : undefined }}>
                        {v.batteryStatus === "not_good" ? "Bad" : v.batteryStatus ? "Good" : "—"}
                      </span>
                    </Spec>
                    <Spec label="Colour">{v.colour || "—"}</Spec>
                  </>
                )}
              </div>

              <p className="mt-auto text-center font-semibold tracking-[0.12em] uppercase" style={{ ...cq(3.5), color: "var(--deck-2)" }}>
                Click again for full dossier &amp; files
              </p>
            </div>

            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={() => onOpen(v)}
              aria-label={`Open the full dossier and files for ${name}`}
              className="absolute inset-0 cursor-pointer rounded-[5cqw] outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
            />
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={() => setFlipped(false)}
              aria-label="Flip the card back"
              className="absolute top-[6cqw] right-[6cqw] grid cursor-pointer place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ width: "9cqw", height: "9cqw" }}
            >
              <RotateCcw style={{ width: "4.6cqw", height: "4.6cqw" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
