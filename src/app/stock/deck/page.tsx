"use client";

import { useRef, useState, type TouchEvent } from "react";
import { CalendarDays, MapPin, Minus, Plus, RotateCcw, Search, Spade, X } from "lucide-react";
import { DeckCard } from "@/components/deck/deck-card";
import { DossierDialog } from "@/components/deck/dossier-dialog";
import { EmptyState, PageHeader, Segmented, cn, inputClass } from "@/components/ui";
import { DECK_STATUS_ORDER, DECK_THEMES, deckStatus, type DeckStatus } from "@/lib/deck";
import { displayReg } from "@/lib/format";
import { BRANCHES } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { useScopedVehicles } from "@/lib/scoped";
import { ZOOM_LABEL, ZOOM_LEVELS, useDeckZoom, type DeckZoom } from "@/lib/use-deck-zoom";
import { useNow } from "@/lib/use-now";
import { currentBranchId } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";

const PAGE_SIZE = 24;

type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range…" },
];

/** The calendar day (YYYY-MM-DD, India time) of a timestamp - the same day the rest of the app shows. */
const istDay = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Was this vehicle added to stock inside the chosen window? Compared by day, so a range is inclusive of both ends. */
function addedWithin(v: Vehicle, preset: DatePreset, from: string, to: string, today: string) {
  if (preset === "all") return true;
  const day = istDay(v.createdAt);
  switch (preset) {
    case "today":
      return day === today;
    case "yesterday":
      return day === shiftDay(today, -1);
    case "week":
      return day >= shiftDay(today, -6) && day <= today;
    case "month":
      return day.slice(0, 7) === today.slice(0, 7);
    case "custom": {
      // An inverted range (From after To) is read the other way round rather than matching nothing.
      const [a, b] = from && to && from > to ? [to, from] : [from, to];
      return (!a || day >= a) && (!b || day <= b);
    }
  }
}

export default function StockDeckPage() {
  const { vehicles, ready } = useScopedVehicles();
  const { inScope } = useRole();
  const now = useNow(30_000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeckStatus | "all">("all");
  const [branch, setBranch] = useState<string>("all");
  const [preset, setPreset] = useState<DatePreset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<Vehicle>();
  const [zoom, setZoom] = useDeckZoom();
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom);
  const stepZoom = (delta: number) => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIdx + delta))]);

  // Pinch: spreading two fingers makes cards larger, pinching in makes them smaller - one step per gesture.
  const pinch = useRef<{ start: number; stepped: boolean } | null>(null);
  const span = (t: TouchEvent["touches"]) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { start: span(e.touches), stepped: false };
  };
  const onTouchMove = (e: TouchEvent) => {
    const p = pinch.current;
    if (!p || p.stepped || e.touches.length !== 2) return;
    const ratio = span(e.touches) / p.start;
    if (ratio > 1.25 || ratio < 0.8) {
      stepZoom(ratio > 1 ? 1 : -1);
      p.stepped = true;
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
  };

  const today = istDay(now);
  const q = query.trim().toLowerCase();
  const withStatus = vehicles.map((v) => ({ v, status: deckStatus(v) })).sort((a, b) => b.v.createdAt.localeCompare(a.v.createdAt));

  // "At a hub" = added from that branch, or currently located there (a bike received at Angamaly is still the home branch's stock).
  const atBranch = (v: Vehicle, id: string) => v.branchId === id || currentBranchId(v) === id;
  const textOk = (v: Vehicle) => !q || `${v.make} ${v.model} ${v.variant} ${v.registrationNo} ${displayReg(v.registrationNo)} ${v.stockId ?? ""}`.toLowerCase().includes(q);
  // Every filter combines with every other. `skip` leaves one out, so that control's own counts reflect the rest.
  const matches = (item: { v: Vehicle; status: DeckStatus }, skip?: "status" | "branch" | "date") =>
    textOk(item.v) &&
    (skip === "branch" || branch === "all" || atBranch(item.v, branch)) &&
    (skip === "status" || status === "all" || item.status === status) &&
    (skip === "date" || addedWithin(item.v, preset, from, to, today));

  const rows = withStatus.filter((i) => matches(i));
  const visible = rows.slice(0, shown);

  const statusCounts = {} as Record<DeckStatus, number>;
  for (const i of withStatus) if (matches(i, "status")) statusCounts[i.status] = (statusCounts[i.status] ?? 0) + 1;
  const statusTotal = Object.values(statusCounts).reduce((n, c) => n + c, 0);

  const branches = BRANCHES.filter((b) => inScope(b.id)).map((b) => ({ id: b.id as string, name: b.name, n: withStatus.filter((i) => matches(i, "branch") && atBranch(i.v, b.id)).length }));
  const presetCount = (p: DatePreset) => withStatus.filter((i) => matches(i, "date") && addedWithin(i.v, p, "", "", today)).length;

  const filtersActive = !!q || status !== "all" || branch !== "all" || preset !== "all";
  const reset = () => {
    setQuery("");
    setStatus("all");
    setBranch("all");
    setPreset("all");
    setFrom("");
    setTo("");
    setShown(PAGE_SIZE);
  };
  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE_SIZE);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Spade className="size-6 text-brand" />}
        title="Stock Deck"
        description="Every vehicle as a playing card. Click a card to flip it for its status and specs, click again for the full dossier and files."
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,22rem)_minmax(0,18rem)_minmax(0,14rem)]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              aria-label="Search the deck"
              value={query}
              onChange={(e) => changed(setQuery)(e.target.value)}
              placeholder="Search by name, registration or stock ID"
              autoComplete="off"
              className={cn(inputClass(), "pl-10")}
            />
          </div>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <select aria-label="Hub or branch" value={branch} onChange={(e) => changed(setBranch)(e.target.value)} className={cn(inputClass(), "pl-10")}>
              <option value="all">All hubs / branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.n}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <select
              aria-label="Stock added date"
              value={preset}
              onChange={(e) => {
                const p = e.target.value as DatePreset;
                setPreset(p);
                if (p !== "custom") {
                  setFrom("");
                  setTo("");
                }
                setShown(PAGE_SIZE);
              }}
              className={cn(inputClass(), "pl-10")}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                  {p.value !== "all" && p.value !== "custom" ? ` · ${presetCount(p.value)}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 max-sm:w-full" role="group" aria-label="Card size">
          <div className="hidden items-center gap-1 rounded-xl border border-line-strong bg-surface p-1 sm:flex">
            <button
              type="button"
              onClick={() => stepZoom(-1)}
              disabled={zoomIdx === 0}
              aria-label="Zoom out: smaller cards, more per row"
              title="Zoom out"
              className="btn-tap grid size-9 place-items-center rounded-lg text-ink hover:bg-sunken disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-20 text-center text-xs font-semibold text-muted" aria-live="polite">
              {ZOOM_LABEL[zoom]}
            </span>
            <button
              type="button"
              onClick={() => stepZoom(1)}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              aria-label="Zoom in: larger cards, fewer per row"
              title="Zoom in"
              className="btn-tap grid size-9 place-items-center rounded-lg text-ink hover:bg-sunken disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Plus className="size-4" />
            </button>
            {zoom !== "normal" && (
              <button type="button" onClick={() => setZoom("normal")} aria-label="Reset card size" title="Reset" className="btn-tap grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
                <RotateCcw className="size-4" />
              </button>
            )}
          </div>
          <div className="w-full sm:hidden">
            <Segmented<DeckZoom> name="Card size" value={zoom} onChange={setZoom} options={ZOOM_LEVELS.map((z) => ({ value: z, label: ZOOM_LABEL[z] }))} />
          </div>
        </div>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              From
              <input type="date" value={from} max={to || undefined} onChange={(e) => changed(setFrom)(e.target.value)} className={cn(inputClass(), "w-44")} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              To
              <input type="date" value={to} min={from || undefined} onChange={(e) => changed(setTo)(e.target.value)} className={cn(inputClass(), "w-44")} />
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {([["all", "All", statusTotal], ...DECK_STATUS_ORDER.filter((s) => statusCounts[s] || status === s).map((s) => [s, DECK_THEMES[s].label, statusCounts[s] ?? 0] as const)] as const).map(([key, label, n]) => {
            const on = status === key;
            const accent = key === "all" ? undefined : DECK_THEMES[key as DeckStatus].accent;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => changed(setStatus)(key as DeckStatus | "all")}
                className={cn(
                  "btn-tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  on ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                {accent && <span className="size-2 rounded-full" style={{ background: accent }} />}
                {label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        {ready && vehicles.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite">
            <span>
              Showing <strong className="font-semibold text-ink tabular-nums">{rows.length}</strong> of <span className="tabular-nums">{vehicles.length}</span> cards
            </span>
            {filtersActive && (
              <button type="button" onClick={reset} className="btn-tap inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand hover:underline">
                <X className="size-3.5" /> Clear filters
              </button>
            )}
          </p>
        )}
      </div>

      {!ready ? (
        <EmptyState>Shuffling the deck…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>{vehicles.length === 0 ? "No vehicles in stock yet." : preset !== "all" ? "No stock added within this date range." : "No cards match."}</EmptyState>
      ) : (
        <>
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
            <ul className="deck-grid" data-zoom={zoom}>
              {visible.map(({ v }) => (
                <li key={v.id}>
                  <DeckCard vehicle={v} now={now} onOpen={setOpen} />
                </li>
              ))}
            </ul>
          </div>
          {rows.length > visible.length && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="btn-tap h-11 rounded-xl border border-line-strong bg-surface px-5 text-sm font-semibold hover:bg-sunken">
                Deal more cards · {rows.length - visible.length} left
              </button>
            </div>
          )}
        </>
      )}

      {open && <DossierDialog vehicle={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
