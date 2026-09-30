"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarOff, Check, CircleSlash, Clock, Hourglass, LogOut, Plane, X } from "lucide-react";
import { BRANCHES } from "@/lib/masters";
import { formatIsoDate } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useRole } from "@/lib/role-context";
import { istDate } from "@/lib/working-days";
import {
  ATTENDANCE_LABEL,
  EMPLOYEE_STATUS_LABEL,
  LEAVE_STATUS_LABEL,
  SHIFT_LABEL,
  canManageHr,
  employees,
  type AttendanceStatus,
  type Employee,
  type EmployeeStatus,
  type LeaveStatus,
  type Shift,
} from "@/lib/hr";
import { Pill, cn, inputClass } from "../ui";

/** Today's IST date, refreshed every minute. */
export function useToday() {
  const now = useNow(60_000);
  return istDate(now);
}

/** Employees plus an id -> employee lookup. */
export function useEmployees() {
  const { items, ready } = employees.useItems();
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  return { employees: items, byId, ready };
}

/** "Thursday, 25/09/2026" */
export function longDate(ymd: string) {
  const weekday = new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return `${weekday}, ${formatIsoDate(ymd)}`;
}

export function AttendancePill({ status }: { status?: AttendanceStatus }) {
  if (!status)
    return (
      <Pill tone="neutral" icon={<Hourglass className="size-3" />}>
        Not marked
      </Pill>
    );
  const map: Record<AttendanceStatus, { tone: "ok" | "warn" | "danger" | "brand" | "neutral"; icon: ReactNode }> = {
    present: { tone: "ok", icon: <Check className="size-3" /> },
    half_day: { tone: "warn", icon: <Clock className="size-3" /> },
    absent: { tone: "danger", icon: <X className="size-3" /> },
    leave: { tone: "brand", icon: <Plane className="size-3" /> },
    week_off: { tone: "neutral", icon: <CalendarOff className="size-3" /> },
  };
  return (
    <Pill tone={map[status].tone} icon={map[status].icon}>
      {ATTENDANCE_LABEL[status]}
    </Pill>
  );
}

export function LatePill() {
  return (
    <Pill tone="warn" icon={<Clock className="size-3" />}>
      Late
    </Pill>
  );
}

export function EmployeeStatusPill({ status }: { status: EmployeeStatus }) {
  if (status === "active")
    return (
      <Pill tone="ok" icon={<Check className="size-3" />}>
        {EMPLOYEE_STATUS_LABEL.active}
      </Pill>
    );
  if (status === "on_notice")
    return (
      <Pill tone="warn" icon={<Hourglass className="size-3" />}>
        {EMPLOYEE_STATUS_LABEL.on_notice}
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={<LogOut className="size-3" />}>
      {EMPLOYEE_STATUS_LABEL.exited}
    </Pill>
  );
}

export function LeaveStatusPill({ status }: { status: LeaveStatus }) {
  if (status === "approved")
    return (
      <Pill tone="ok" icon={<Check className="size-3" />}>
        {LEAVE_STATUS_LABEL.approved}
      </Pill>
    );
  if (status === "rejected")
    return (
      <Pill tone="neutral" icon={<CircleSlash className="size-3" />}>
        {LEAVE_STATUS_LABEL.rejected}
      </Pill>
    );
  return (
    <Pill tone="warn" icon={<Hourglass className="size-3" />}>
      {LEAVE_STATUS_LABEL.pending}
    </Pill>
  );
}

const shiftTone: Record<Shift, string> = {
  morning: "bg-warn-soft text-warn border-warn/30",
  general: "bg-brand-soft text-brand border-brand/30",
  evening: "bg-ok-soft text-ok border-ok/30",
  off: "bg-sunken text-muted border-line",
};

export function shiftChipClass(shift: Shift) {
  return cn("inline-flex h-8 w-full min-w-[4.75rem] items-center justify-center rounded-lg border px-2 text-xs font-semibold", shiftTone[shift]);
}

export function ShiftChip({ shift }: { shift: Shift }) {
  return <span className={shiftChipClass(shift)}>{SHIFT_LABEL[shift]}</span>;
}

/** Initials avatar, name and job title. */
export function EmployeeCell({ employee, onOpen }: { employee?: Employee; onOpen?: () => void }) {
  if (!employee) return <span className="text-muted">Unknown employee</span>;
  const initials = employee.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const body = (
    <>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
        {initials}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate font-medium text-ink", onOpen && "group-hover:underline")}>{employee.name}</span>
        <span className="block truncate text-xs text-muted">{employee.role}</span>
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="group flex min-w-0 items-center gap-2.5 text-left">
      {body}
    </button>
  ) : (
    <span className="flex min-w-0 items-center gap-2.5">{body}</span>
  );
}

export function BranchSelect({ value, onChange, id, allLabel = "All branches" }: { value: string; onChange: (v: string) => void; id?: string; allLabel?: string | null }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Branch" className={inputClass()}>
      {allLabel !== null && <option value="all">{allLabel}</option>}
      {BRANCHES.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

/** True for HR / Admin; the Managing Partner sees HR read-only. */
export function useCanManageHr() {
  const { role } = useRole();
  return canManageHr(role);
}

/** Read-only notice for roles that can view HR but not change it. */
export function ViewOnlyNote() {
  return <p className="rounded-xl bg-sunken px-3.5 py-2.5 text-sm text-muted">View only. Changes are made by HR / Admin.</p>;
}
