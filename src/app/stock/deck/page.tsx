"use client";

import { useMemo, useState } from "react";
import { Search, Spade } from "lucide-react";
import { DeckCard } from "@/components/deck/deck-card";
import { DossierDialog } from "@/components/deck/dossier-dialog";
import { EmptyState, PageHeader, cn, inputClass } from "@/components/ui";
import { DECK_STATUS_ORDER, DECK_THEMES, deckStatus, type DeckStatus } from "@/lib/deck";
import { displayReg } from "@/lib/format";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import type { Vehicle } from "@/lib/types";

const PAGE_SIZE = 24;

export default function StockDeckPage() {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(30_000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeckStatus | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<Vehicle>();

  const withStatus = useMemo(() => vehicles.map((v) => ({ v, status: deckStatus(v) })).sort((a, b) => b.v.createdAt.localeCompare(a.v.createdAt)), [vehicles]);
  const counts = useMemo(() => {
    const c = {} as Record<DeckStatus, number>;
    for (const { status: s } of withStatus) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [withStatus]);

  const q = query.trim().toLowerCase();
  const rows = withStatus.filter(({ v, status: s }) => (status === "all" || s === status) && (!q || `${v.make} ${v.model} ${v.variant} ${v.registrationNo} ${displayReg(v.registrationNo)} ${v.stockId ?? ""}`.toLowerCase().includes(q)));
  const visible = rows.slice(0, shown);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Spade className="size-6 text-brand" />}
        title="Stock Deck"
        description="Every vehicle as a playing card. Click a card to flip it for its status and specs, click again for the full dossier and files."
      />

      <div className="flex flex-col gap-3">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="Search the deck"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE_SIZE);
            }}
            placeholder="Search by name, registration or stock ID"
            autoComplete="off"
            className={cn(inputClass(), "pl-10")}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {([["all", "All", vehicles.length], ...DECK_STATUS_ORDER.filter((s) => counts[s]).map((s) => [s, DECK_THEMES[s].label, counts[s]] as const)] as const).map(([key, label, n]) => {
            const on = status === key;
            const accent = key === "all" ? undefined : DECK_THEMES[key as DeckStatus].accent;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setStatus(key as DeckStatus | "all");
                  setShown(PAGE_SIZE);
                }}
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
      </div>

      {!ready ? (
        <EmptyState>Shuffling the deck…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>{vehicles.length === 0 ? "No vehicles in stock yet." : "No cards match."}</EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map(({ v }) => (
              <li key={v.id}>
                <DeckCard vehicle={v} now={now} onOpen={setOpen} />
              </li>
            ))}
          </ul>
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
