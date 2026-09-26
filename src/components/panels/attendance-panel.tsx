"use client";

import { useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import { branchName } from "@/lib/masters";
import { ATTENDANCE_LABEL, attendance, isLate, markAttendance, onRollOn, type Attendance, type AttendanceStatus, type Employee } from "@/lib/hr";
import { DataTable } from "../data-table";
import { Button, Field, cn, inputClass } from "../ui";
import { Dialog, useInlineAction } from "./dialog";
import { AttendancePill, EmployeeCell, LatePill, longDate, useEmployees, useCanManageHr } from "./hr-bits";

const STATUSES: AttendanceStatus[] = ["present", "half_day", "absent", "leave", "week_off"];

function nowIstTime() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Mark or change one person's attendance for a day. HR only; the store re-checks hr.manage. */
export function MarkAttendanceDialog({ employee, date, record, onClose }: { employee: Employee; date: string; record?: Attendance; onClose: () => void }) {
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? "present");
  const [checkIn, setCheckIn] = useState(record?.checkIn ?? "09:00");
  const [checkOut, setCheckOut] = useState(record?.checkOut ?? "");
  const { submit, failure, busy } = useInlineAction();
  const timed = status === "present" || status === "half_day";

  async function save() {
    const ok = await submit(
      () => markAttendance(employee.id, date, status, timed ? checkIn : undefined, timed ? checkOut || undefined : undefined),
      `${employee.name}: ${ATTENDANCE_LABEL[status].toLowerCase()} on ${longDate(date)}`,
    );
    if (ok) onClose();
  }

  return (
    <Dialog
      title={record ? "Change attendance" : "Mark attendance"}
      subtitle={`${employee.name} · ${longDate(date)}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-sm font-medium text-ink">Status</legend>
        <div role="radiogroup" aria-label="Status" className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(s)}
              className={cn("h-11 rounded-xl border px-3 text-sm font-medium transition", status === s ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink hover:bg-sunken")}
            >
              {ATTENDANCE_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
      {timed && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Check-in" htmlFor="att-in" required hint={checkIn > "09:30" ? "After 09:30, counts as a late mark" : undefined}>
            <input id="att-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass()} />
          </Field>
          <Field label="Check-out" htmlFor="att-out">
            <input id="att-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass()} />
          </Field>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCheckIn(nowIstTime())}>
              Check-in now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCheckOut(nowIstTime())}>
              Check-out now
            </Button>
          </div>
        </div>
      )}
      {record?.marked && <p className="mt-4 text-xs text-muted">Last marked by {record.marked.by}</p>}
      {failure && <p className="mt-4 text-sm font-medium text-danger">{failure}</p>}
    </Dialog>
  );
}

export interface AttendanceLine {
  employee: Employee;
  record?: Attendance;
}

/** Everyone on the roll for `date` with their attendance record (if marked). */
export function useAttendanceLines(date: string) {
  const { employees, ready: employeesReady } = useEmployees();
  const { items, ready } = attendance.useItems();
  const lines = useMemo(() => {
    const byEmployee = new Map(items.filter((a) => a.date === date).map((a) => [a.employeeId, a]));
    return employees
      .filter((e) => onRollOn(e, date) || byEmployee.has(e.id))
      .map((employee) => ({ employee, record: byEmployee.get(employee.id) }))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  }, [employees, items, date]);
  return { lines, records: items, ready: ready && employeesReady };
}

/** One branch's attendance for a day, with Mark / Change for HR. */
export function AttendanceDayTable({ lines, date, showBranch, empty = "No one on the roll for this day." }: { lines: AttendanceLine[]; date: string; showBranch?: boolean; empty?: string }) {
  const manage = useCanManageHr();
  const [editing, setEditing] = useState<AttendanceLine>();
  return (
    <>
      <DataTable
        rows={lines}
        rowKey={(l) => l.employee.id}
        rowTone={(l) => (l.record?.status === "absent" ? "danger" : undefined)}
        empty={empty}
        columns={[
          { header: "Employee", cell: (l) => <EmployeeCell employee={l.employee} /> },
          ...(showBranch ? [{ header: "Branch", cell: (l: AttendanceLine) => <span className="whitespace-nowrap">{branchName(l.employee.branchId)}</span> }] : []),
          {
            header: "Status",
            cell: (l) => (
              <div className="flex flex-wrap gap-1">
                <AttendancePill status={l.record?.status} />
                {l.record && isLate(l.record) && <LatePill />}
              </div>
            ),
          },
          { header: "Check-in", align: "right", cell: (l) => l.record?.checkIn ?? <span className="text-faint">—</span> },
          { header: "Check-out", align: "right", cell: (l) => l.record?.checkOut ?? <span className="text-faint">—</span> },
          ...(manage
            ? [
                {
                  header: "",
                  align: "right" as const,
                  cell: (l: AttendanceLine) => (
                    <Button size="sm" variant={l.record ? "ghost" : "primary"} onClick={() => setEditing(l)} aria-label={`${l.record ? "Change" : "Mark"} attendance for ${l.employee.name}`}>
                      <PencilLine className="size-3.5" /> {l.record ? "Change" : "Mark"}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {editing && <MarkAttendanceDialog employee={editing.employee} date={date} record={editing.record} onClose={() => setEditing(undefined)} />}
    </>
  );
}
