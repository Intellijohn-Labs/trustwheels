"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { COLOUR_SWATCHES, colourHex } from "@/lib/masters";
import { cn, inputClass } from "@/components/ui";

/** Colour preview dot. The mid-grey inset ring keeps White/Silver visible on light and dark surfaces alike. */
function Dot({ name }: { name: string }) {
  const hex = colourHex(name);
  return (
    <span
      aria-hidden
      style={hex ? { backgroundColor: hex } : undefined}
      className={cn(
        "size-4 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(128,128,128,0.5)]",
        !hex && "border border-dashed border-line-strong bg-sunken shadow-none",
      )}
    />
  );
}

const ADD = "__add__";

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
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [extras, setExtras] = useState<string[]>([]);

  // Typed-in shades stay in the list for the rest of this form, and so does a value we didn't
  // offer ourselves (e.g. a legacy name like "Matt Black").
  const known = new Set([...COLOUR_SWATCHES.map((c) => c.name), ...extras].map((n) => n.toLowerCase()));
  const custom = value && !known.has(value.toLowerCase()) ? [...extras, value] : extras;
  const names = [...COLOUR_SWATCHES.map((c) => c.name), ...custom];
  const items = [...names, ADD];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function openList() {
    const i = names.findIndex((n) => n.toLowerCase() === value.toLowerCase());
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }

  function pick(item: string) {
    setOpen(false);
    if (item === ADD) {
      setAdding(true);
      return;
    }
    setAdding(false);
    onChange(item);
  }

  function commit() {
    const name = draft.trim().slice(0, 40);
    if (!name) return;
    const existing = names.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!existing) setExtras((x) => [...x, name]);
    onChange(existing ?? name);
    setDraft("");
    setAdding(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(items[active]);
    }
  }

  return (
    <div ref={root} className="relative flex flex-col gap-2" onKeyDown={onKeyDown}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onBlur={onBlur}
        className={cn(inputClass(invalid), "flex items-center gap-2.5 text-left")}
      >
        {value ? <Dot name={value} /> : null}
        <span className={cn("flex-1 truncate", !value && "text-faint")}>{value || "Select colour"}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {items.map((item, i) => {
            const isAdd = item === ADD;
            const selected = !isAdd && item.toLowerCase() === value.toLowerCase();
            return (
              <li
                key={item}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors",
                  i === active && "bg-sunken",
                  isAdd && "mt-1 border-t border-line font-medium text-brand",
                  selected && "font-semibold",
                )}
              >
                {isAdd ? <Plus className="size-4 shrink-0" /> : <Dot name={item} />}
                <span className="flex-1 truncate">{isAdd ? "Add new colour…" : item}</span>
                {selected && <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />}
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="New colour name"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
            maxLength={40}
            placeholder="Type the colour name, e.g. Candy Red"
            className={cn(inputClass(), "min-w-0 flex-1")}
          />
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="h-12 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-surface transition hover:brightness-110 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
