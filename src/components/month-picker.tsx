"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, inputClass } from "@/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/**
 * Month & year picker. Browsers without a native <input type="month"> (Safari, desktop Firefox)
 * fall back to a plain text box, so this renders the same calendar everywhere. The value is a
 * "YYYY-MM" string, exactly what <input type="month"> would give. Click the year in the header
 * to jump straight to any year from a scrollable list instead of stepping with the arrows.
 */
export function MonthPicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  min,
  max,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  min: string; // "YYYY-MM"
  max: string; // "YYYY-MM"
}) {
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));
  const selected = /^\d{4}-\d{2}$/.test(value) ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) } : null;
  const [viewYear, setViewYear] = useState(selected?.year ?? maxYear);
  const [pickingYear, setPickingYear] = useState(false);
  const currentYearRef = useRef<HTMLButtonElement>(null);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i); // newest first

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Opening the year list: bring the year being viewed into the middle of it.
  useEffect(() => {
    if (pickingYear) currentYearRef.current?.scrollIntoView({ block: "center" });
  }, [pickingYear]);

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (pickingYear) setPickingYear(false);
          else setOpen(false);
        }
      }}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) {
            setViewYear(selected?.year ?? maxYear);
            setPickingYear(false);
          }
          setOpen((o) => !o);
        }}
        onBlur={onBlur}
        className={cn(inputClass(invalid), "flex items-center gap-2.5 text-left")}
      >
        <span className={cn("flex-1 truncate", !selected && "text-faint")}>{selected ? `${FULL[selected.month - 1]} ${selected.year}` : "Select month & year"}</span>
        <CalendarDays className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label="Choose month and year" className="absolute top-full left-0 z-30 mt-1 w-72 max-w-full rounded-xl border border-line bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              disabled={pickingYear || viewYear <= minYear}
              onClick={() => setViewYear((y) => y - 1)}
              className="grid size-9 place-items-center rounded-lg text-ink transition hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-expanded={pickingYear}
              aria-label={`Year ${viewYear}, choose another year`}
              onClick={() => setPickingYear((p) => !p)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold tabular-nums text-ink transition hover:bg-sunken"
            >
              {viewYear}
              <ChevronDown className={cn("size-4 text-muted transition-transform duration-150", pickingYear && "rotate-180")} />
            </button>
            <button
              type="button"
              aria-label="Next year"
              disabled={pickingYear || viewYear >= maxYear}
              onClick={() => setViewYear((y) => y + 1)}
              className="grid size-9 place-items-center rounded-lg text-ink transition hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {pickingYear ? (
            <div role="listbox" aria-label="Year" className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
              {years.map((y) => (
                <button
                  key={y}
                  ref={y === viewYear ? currentYearRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={y === viewYear}
                  onClick={() => {
                    setViewYear(y);
                    setPickingYear(false);
                  }}
                  className={cn(
                    "h-10 rounded-lg text-sm tabular-nums transition",
                    y === viewYear ? "bg-brand font-semibold text-surface" : "text-ink hover:bg-sunken",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((label, i) => {
                const key = ym(viewYear, i + 1);
                const disabled = key > max || key < min;
                const active = selected?.year === viewYear && selected.month === i + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`${FULL[i]} ${viewYear}`}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-10 rounded-lg text-sm transition",
                      active ? "bg-brand font-semibold text-surface" : "text-ink hover:bg-sunken",
                      disabled && "cursor-not-allowed text-faint opacity-40 hover:bg-transparent",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
