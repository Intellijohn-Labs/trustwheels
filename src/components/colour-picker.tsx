"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COLOUR_NAMES } from "@/lib/masters";
import { cn, inputClass } from "@/components/ui";

const OTHER = "__other__";
const isPreset = (v: string) => COLOUR_NAMES.some((n) => n.toLowerCase() === v.trim().toLowerCase());

/** Colour as plain text: pick a common name, or choose "Other" and type your own. */
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
  // "Other" stays on while the user is typing, and whenever the stored value isn't one of the
  // listed names (a custom colour, or an older record's name like "Matt Black").
  const [otherOpen, setOtherOpen] = useState(false);
  const other = otherOpen || (value !== "" && !isPreset(value));
  const preset = COLOUR_NAMES.find((n) => n.toLowerCase() === value.trim().toLowerCase());

  return (
    // Blur is reported only when focus leaves the whole picker, so moving from the dropdown to the
    // custom-name box (which opens and takes focus on "Other...") doesn't count as leaving the field.
    <div
      className="flex flex-col gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur?.();
      }}
    >
      <div className="relative">
        <select
          id={id}
          value={other ? OTHER : (preset ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setOtherOpen(true);
              if (isPreset(value)) onChange("");
            } else {
              setOtherOpen(false);
              onChange(v);
            }
          }}
          className={cn(inputClass(invalid), "appearance-none pr-10")}
        >
          <option value="">Select colour</option>
          {COLOUR_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
      </div>

      {other && (
        <input
          type="text"
          aria-label="Colour name"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 40))}
          autoFocus={otherOpen}
          data-error-focus={invalid ? "" : undefined}
          placeholder="Enter custom colour name (e.g. Matte Olive Green, Candy Red)"
          className={inputClass(invalid)}
        />
      )}
    </div>
  );
}
