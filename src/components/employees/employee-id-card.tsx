"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MapPin, Pencil, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { Logo } from "../logo";
import { cn } from "../ui";
import { EmployeeStatusPill } from "../panels/hr-bits";
import { RowCheckbox } from "../selection";
import { isManagingPartner, type Employee } from "@/lib/hr";
import { formatPhone } from "@/lib/format";
import { branchName } from "@/lib/masters";
import { PANELS, ROLES, effectivePermissions, resolvePanels, type Role } from "@/lib/rbac";

/** A colour per system login role, so a glance at the badge says who it is. */
const ROLE_COLOURS: Record<Role | "none", [string, string]> = {
  managing_partner: ["#7c3aed", "#a78bfa"],
  partner: ["#0284c7", "#38bdf8"],
  branch_manager: ["#2563eb", "#60a5fa"],
  branch_accountant: ["#0d9488", "#2dd4bf"],
  hub_admin: ["#4f46e5", "#818cf8"],
  supervisor: ["#d97706", "#fbbf24"],
  gate_manager: ["#db2777", "#f472b6"],
  sales_executive: ["#059669", "#34d399"],
  telecaller: ["#0891b2", "#22d3ee"],
  central_accountant: ["#65a30d", "#a3e635"],
  hr: ["#c026d3", "#e879f9"],
  none: ["#64748b", "#94a3b8"],
};

const STATUS_COLOUR = { active: "#10b981", on_notice: "#f59e0b", exited: "#94a3b8" } as const;

/** `e-07` -> `EMP-TW-007`. */
export function employeeCode(e: Employee) {
  const n = /^e-(\d+)$/i.exec(e.id)?.[1];
  return n ? `EMP-TW-${n.padStart(3, "0")}` : `EMP-TW-${e.id.toUpperCase()}`;
}

/** The sidebar panels this person can open (their role, plus their own picks) - same logic the app enforces. */
function openPanels(e: Employee) {
  if (!e.rbacRole) return [];
  const permissions = effectivePermissions(e.rbacRole, resolvePanels(e.rbacRole, e.panelAccess, e.allowedPanels));
  return PANELS.filter((p) => permissions.includes(p.permission));
}

/** Bar positions and widths for a decorative barcode - the same seed always gives the same bars. */
function barcodeBars(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    return (h % 1000) / 1000;
  };
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 118) {
    const w = 1 + Math.floor(next() * 3);
    if (x + w > 118) break;
    bars.push({ x, w });
    x += w + 1 + Math.floor(next() * 2);
  }
  return bars;
}

function Barcode({ seed }: { seed: string }) {
  return (
    <svg viewBox="0 0 118 26" preserveAspectRatio="none" className="h-7 w-full text-ink" aria-hidden>
      {barcodeBars(seed).map((b) => (
        <rect key={b.x} x={b.x} y="0" width={b.w} height="26" fill="currentColor" />
      ))}
    </svg>
  );
}

/** "+3 more" with a popover listing every panel. Closes on outside click or Escape. */
function PanelMore({ panels, shown }: { panels: string[]; shown: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (ev: PointerEvent) => !box.current?.contains(ev.target as Node) && setOpen(false);
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn-tap rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-ink"
      >
        +{panels.length - shown} more
      </button>
      {open && (
        <div role="dialog" aria-label="All panels" className="absolute right-0 bottom-full z-20 mb-2 w-60 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Panel access · {panels.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {panels.map((p) => (
              <span key={p} className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeeIdCard({
  employee: e,
  manage,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  manage: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [c1, c2] = ROLE_COLOURS[e.rbacRole ?? "none"];
  const initials = e.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const protectedHead = isManagingPartner(e);
  const panels = openPanels(e).map((p) => p.label);
  const SHOWN = 4;
  const homes = (e.branchIds?.length ? e.branchIds : [e.branchId]).filter(Boolean);
  const branch = protectedHead || (e.rbacRole && ROLES[e.rbacRole].scope === "all" && e.rbacRole === "managing_partner") ? "All branches" : `${branchName(homes[0])}${homes.length > 1 ? ` +${homes.length - 1}` : ""}`;
  const status = STATUS_COLOUR[e.status];

  return (
    <article className="emp-badge flex h-full flex-col" style={{ "--emp": c1, "--emp-2": c2 } as React.CSSProperties} aria-label={`${e.name}, ${e.role}`}>
      <div className="emp-top" aria-hidden />
      <div className="emp-hole mx-auto mt-2.5 h-3 w-14 rounded-full" aria-hidden />

      {manage && !protectedHead && (
        <span className="absolute top-3 left-3">
          <RowCheckbox checked={selected} onChange={onSelect} label={`Select ${e.name}`} />
        </span>
      )}
      <span className="absolute top-3 right-3">
        <EmployeeStatusPill status={e.status} />
      </span>

      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <Logo variant="full" motion="none" className="h-7 w-auto" />
        <span className="text-[10px] font-bold tracking-[0.18em] whitespace-nowrap uppercase" style={{ color: c1 }}>
          Official staff ID
        </span>
      </div>

      <div className="flex flex-col items-center px-5 pt-4 text-center">
        <div className="relative">
          <div className="grid size-[5.25rem] place-items-center rounded-full border-[3px] bg-surface p-0.5" style={{ borderColor: status }}>
            {e.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar is a plain uploaded URL
              <img src={e.photoUrl} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-full place-items-center rounded-full text-xl font-bold text-white" style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}>
                {initials}
              </span>
            )}
          </div>
          <span className="absolute right-0.5 bottom-0.5 size-4 rounded-full border-2 border-surface" style={{ background: status }} title={e.status} />
        </div>
        <h3 className="mt-3 w-full truncate text-lg font-bold tracking-tight text-ink">{e.name}</h3>
        <p className="w-full truncate text-sm font-medium text-muted">{e.role}</p>
        <span
          className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: `color-mix(in srgb, ${c1} 14%, transparent)`, color: c1 }}
        >
          <ShieldCheck className="size-3 shrink-0" />
          <span className="truncate">{e.rbacRole ? ROLES[e.rbacRole].label : "No system login"}</span>
        </span>
      </div>

      <dl className="mt-4 space-y-2 px-5 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5 shrink-0 text-muted" />
          <dt className="sr-only">Branch</dt>
          <dd className="truncate font-medium text-ink">{branch}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="grid size-3.5 shrink-0 place-items-center text-[9px] font-bold text-muted">ID</span>
          <dt className="sr-only">Employee ID</dt>
          <dd className="font-mono text-xs font-semibold tracking-wider text-ink">{employeeCode(e)}</dd>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <a href={`tel:+91${e.phone}`} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink hover:text-brand">
            <Phone className="size-3 text-muted" /> {formatPhone(e.phone)}
          </a>
          {e.email && (
            <a href={`mailto:${e.email}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink hover:text-brand">
              <Mail className="size-3 shrink-0 text-muted" /> <span className="truncate">{e.email}</span>
            </a>
          )}
        </div>
      </dl>

      <div className="mt-4 px-5">
        <p className="mb-1.5 text-[10px] font-bold tracking-wider text-muted uppercase">Panel access</p>
        {panels.length === 0 ? (
          <span className="text-xs text-faint">{e.rbacRole ? "No panels" : "Doesn't sign in to the app"}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {panels.slice(0, SHOWN).map((p) => (
              <span key={p} className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                {p}
              </span>
            ))}
            {panels.length > SHOWN && <PanelMore panels={panels} shown={SHOWN} />}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-end gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <Barcode seed={e.id + e.name} />
          <p className="mt-1 font-mono text-[9px] tracking-[0.3em] text-faint">{employeeCode(e).replace(/-/g, " ")}</p>
        </div>
        {manage && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${e.name}`}
              title="Edit profile"
              className="btn-tap grid size-9 place-items-center rounded-xl border border-line-strong bg-surface text-ink hover:bg-sunken"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={protectedHead}
              aria-label={`Delete ${e.name}`}
              title={protectedHead ? "Managing Partner cannot be deleted" : "Revoke / delete"}
              className={cn("btn-tap grid size-9 place-items-center rounded-xl border border-line-strong bg-surface text-danger hover:bg-danger-soft", protectedHead && "cursor-not-allowed opacity-40 hover:bg-surface")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
