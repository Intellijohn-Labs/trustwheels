"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { COLOUR_SWATCHES } from "@/lib/masters";
import { cn, inputClass } from "@/components/ui";

const isPreset = (v: string) => COLOUR_SWATCHES.some((c) => c.name.toLowerCase() === v.trim().toLowerCase());

/** Light swatches get a darker tick so the selected state is visible on White/Beige/Silver. */
function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 170;
}

export function ColourPicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  // "Other" is on when the user opened it, or when the stored value isn't one of the swatches
  // (e.g. a custom shade, or a legacy name like "Matt Black").
  const [otherOpen, setOtherOpen] = useState(false);
  const other = otherOpen || (value !== "" && !isPreset(value));

  return (
    <div id={id} className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Colour" aria-invalid={invalid || undefined} className="flex flex-wrap gap-x-3 gap-y-3.5">
        {COLOUR_SWATCHES.map((c) => {
          const active = !other && value.toLowerCase() === c.name.toLowerCase();
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              onClick={() => {
                setOtherOpen(false);
                onChange(c.name);
              }}
              onBlur={onBlur}
              className="group flex w-14 flex-col items-center gap-1.5 outline-none"
            >
              <span
                style={{ backgroundColor: c.hex }}
                className={cn(
                  "relative grid size-10 place-items-center rounded-full ring-1 ring-inset ring-black/15 shadow-sm transition duration-150",
                  "group-hover:scale-110 group-hover:shadow-md group-focus-visible:ring-4 group-focus-visible:ring-brand/30",
                  active && "scale-110 shadow-md ring-2 ring-brand ring-offset-2 ring-offset-surface",
                )}
              >
                <Check
                  strokeWidth={3}
                  className={cn(
                    "size-4 transition duration-150",
                    active ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    isLight(c.hex) ? "text-black/70" : "text-white",
                  )}
                />
              </span>
              <span className={cn("text-xs transition-colors", active ? "font-semibold text-ink" : "text-muted group-hover:text-ink")}>{c.name}</span>
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={other}
          aria-label="Other colour"
          onClick={() => {
            setOtherOpen(true);
            if (isPreset(value)) onChange("");
          }}
          onBlur={onBlur}
          className="group flex w-14 flex-col items-center gap-1.5 outline-none"
        >
          <span
            style={{ background: "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)" }}
            className={cn(
              "relative grid size-10 place-items-center rounded-full ring-1 ring-inset ring-black/15 shadow-sm transition duration-150",
              "group-hover:scale-110 group-hover:shadow-md group-focus-visible:ring-4 group-focus-visible:ring-brand/30",
              other && "scale-110 shadow-md ring-2 ring-brand ring-offset-2 ring-offset-surface",
            )}
          >
            <span className="grid size-5 place-items-center rounded-full bg-surface text-ink">
              {other ? <Check strokeWidth={3} className="size-3" /> : <Palette className="size-3" />}
            </span>
          </span>
          <span className={cn("text-xs transition-colors", other ? "font-semibold text-ink" : "text-muted group-hover:text-ink")}>Other</span>
        </button>
      </div>

      {other && (
        <input
          type="text"
          aria-label="Custom colour name"
          value={isPreset(value) ? "" : value}
          onChange={(e) => onChange(e.target.value.slice(0, 40))}
          onBlur={onBlur}
          placeholder="Type the exact shade, e.g. Candy Red, Midnight Teal"
          autoFocus={otherOpen}
          className={inputClass(invalid)}
        />
      )}
    </div>
  );
}
