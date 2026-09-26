"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "./ui";

/** Accent palettes. Colours live in globals.css (html[data-accent]); these are for the swatches. */
export const ACCENTS = [
  { id: "ocean", label: "Ocean", from: "#1d4ed8", to: "#22d3ee" },
  { id: "aurora", label: "Aurora", from: "#6d28d9", to: "#f472b6" },
  { id: "sunset", label: "Sunset", from: "#c2410c", to: "#fb7185" },
  { id: "emerald", label: "Emerald", from: "#047857", to: "#2dd4bf" },
  { id: "gold", label: "Gold", from: "#a16207", to: "#facc15" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

const KEY = "tw-accent";
const listeners = new Set<() => void>();

function currentAccent(): AccentId {
  const a = document.documentElement.dataset.accent;
  return ACCENTS.some((x) => x.id === a) ? (a as AccentId) : "ocean";
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setAccent(id: AccentId) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.accent = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: applies for this visit only
  }
  listeners.forEach((l) => l());
  setTimeout(() => root.classList.remove("theme-switching"), 400);
}

export function useAccent() {
  return useSyncExternalStore(subscribe, currentAccent, () => "ocean" as const);
}

export function AccentPicker() {
  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = ACCENTS.find((a) => a.id === accent)!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Colour theme: ${current.label}`}
        title="Colour theme"
        className="group grid size-10 place-items-center rounded-xl border border-line-strong bg-surface transition hover:bg-sunken"
      >
        <span className="grid size-6 place-items-center rounded-full text-white shadow-sm transition-transform duration-300 group-hover:rotate-45" style={{ backgroundImage: `linear-gradient(135deg, ${current.from}, ${current.to})` }}>
          <Palette className="size-3.5" />
        </span>
      </button>
      {open && (
        <div className="anim-pop absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted">Colour theme</p>
          <ul role="listbox" aria-label="Colour theme" className="grid gap-1">
            {ACCENTS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={a.id === accent}
                  onClick={() => setAccent(a.id)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-medium transition hover:bg-sunken", a.id === accent && "bg-brand-soft")}
                >
                  <span className="size-7 shrink-0 rounded-full shadow-sm ring-2 ring-surface" style={{ backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` }} />
                  <span className="flex-1">{a.label}</span>
                  {a.id === accent && <Check className="size-4 text-brand" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
