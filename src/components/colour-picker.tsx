"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { COLOUR_SWATCHES, colourHex } from "@/lib/masters";
import { cn, inputClass } from "@/components/ui";

const STORE_KEY = "tw-custom-colours";
const DEFAULT_HEX = "#2563eb";

interface Custom {
  name: string;
  hex: string;
}

/** Custom colours added on this device, so they stay in the dropdown for the next vehicle too. */
function loadCustom(): Custom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((c): c is Custom => typeof c?.name === "string" && /^#[0-9a-f]{6}$/i.test(c?.hex)) : [];
  } catch {
    return [];
  }
}

function saveCustom(list: Custom[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked - the list just won't outlive this form */
  }
}

/** Hex for a typed colour: our own names first, then any CSS colour keyword ("violet", "teal"...). */
function hexForName(name: string): string | undefined {
  const known = colourHex(name);
  if (known) return known;
  const key = name.trim().toLowerCase();
  if (!key || typeof document === "undefined" || !CSS.supports("color", key)) return undefined;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#010203"; // sentinel: assigning a non-colour keyword (e.g. "inherit") leaves this untouched
  ctx.fillStyle = key;
  const out = ctx.fillStyle;
  return out.startsWith("#") && out !== "#010203" ? out : undefined;
}

/** Colour preview dot. The mid-grey inset ring keeps White/Silver visible on light and dark surfaces alike. */
function Dot({ name, hex: given }: { name: string; hex?: string }) {
  const hex = given ?? colourHex(name);
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
  onChange: (name: string, hex?: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftHex, setDraftHex] = useState(DEFAULT_HEX);
  const [picked, setPicked] = useState(false); // once the user picks a shade by hand, typing stops overriding it
  const [extras, setExtras] = useState<Custom[]>(loadCustom);

  // A value we didn't offer ourselves (e.g. a legacy name like "Matt Black") still gets a row.
  const known = new Set([...COLOUR_SWATCHES, ...extras].map((c) => c.name.toLowerCase()));
  const custom = value && !known.has(value.toLowerCase()) ? [...extras, { name: value, hex: colourHex(value) ?? "" }] : extras;
  const options = [...COLOUR_SWATCHES, ...custom];
  const names = options.map((c) => c.name);
  const hexOf = (name: string) => options.find((c) => c.name === name)?.hex || undefined;
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
    // Only a custom shade carries its own hex; presets are looked up from their name.
    onChange(item, extras.find((c) => c.name === item)?.hex);
  }

  function commit() {
    const name = draft.trim().slice(0, 40);
    if (!name) return;
    const preset = COLOUR_SWATCHES.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (preset) {
      onChange(preset.name);
    } else {
      const next = [...extras.filter((c) => c.name.toLowerCase() !== name.toLowerCase()), { name, hex: draftHex }];
      setExtras(next);
      saveCustom(next);
      onChange(name, draftHex);
    }
    setDraft("");
    setPicked(false);
    setDraftHex(DEFAULT_HEX);
    setAdding(false);
  }

  function typeName(text: string) {
    setDraft(text);
    if (picked) return;
    const hex = hexForName(text);
    if (hex) setDraftHex(hex);
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
        {value ? <Dot name={value} hex={hexOf(value)} /> : null}
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
                {isAdd ? <Plus className="size-4 shrink-0" /> : <Dot name={item} hex={hexOf(item)} />}
                <span className="flex-1 truncate">{isAdd ? "Add new colour…" : item}</span>
                {selected && <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />}
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="flex items-center gap-2">
          <label
            title={`Pick the exact shade (${draftHex.toUpperCase()})`}
            style={{ backgroundColor: draftHex }}
            className="relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_rgba(128,128,128,0.5)] transition focus-within:ring-4 focus-within:ring-brand/15 hover:scale-105"
          >
            <input
              type="color"
              aria-label="Pick colour shade"
              value={draftHex}
              onChange={(e) => {
                setDraftHex(e.target.value);
                setPicked(true);
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
          <input
            type="text"
            aria-label="New colour name"
            autoFocus
            value={draft}
            onChange={(e) => typeName(e.target.value)}
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
            placeholder="Colour name, e.g. Violet"
            className={cn(inputClass(), "min-w-0 flex-1")}
          />
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="h-12 shrink-0 rounded-xl bg-brand px-5 text-sm font-semibold text-surface transition hover:brightness-110 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
