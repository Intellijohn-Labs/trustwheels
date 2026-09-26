"use client";

import { SHIFTS, SHIFT_HOURS, SHIFT_LABEL, WEEKDAYS, addDays, setShift, type Employee, type Roster, type Shift } from "@/lib/hr";
import { useAction } from "../toast";
import { EmptyState, cn } from "../ui";
import { EmployeeCell, ShiftChip, shiftChipClass, useCanManageHr } from "./hr-bits";

const nextShift = (s: Shift) => SHIFTS[(SHIFTS.indexOf(s) + 1) % SHIFTS.length];

/**
 * Employee × Mon–Sun shift grid for one branch-week. HR taps a chip to cycle
 * Morning → General → Evening → Off. Scrolls sideways inside its panel on phones.
 */
export function RosterGrid({ roster, staff, today }: { roster: Roster; staff: Employee[]; today: string }) {
  const manage = useCanManageHr();
  const { run } = useAction();
  const shiftOf = (employeeId: string, day: number): Shift => roster.shifts.find((s) => s.employeeId === employeeId && s.day === day)?.shift ?? "off";

  if (staff.length === 0) return <EmptyState>No one is on this branch&apos;s roll.</EmptyState>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-sunken/60 text-xs font-medium text-muted">
            <th className="sticky left-0 z-10 bg-sunken px-4 py-2.5 text-left font-medium">Employee</th>
            {WEEKDAYS.map((d, i) => {
              const date = addDays(roster.weekStart, i);
              return (
                <th key={d} className={cn("px-1.5 py-2.5 text-center font-medium whitespace-nowrap", date === today && "text-brand")}>
                  {d}
                  <span className="block text-[11px] font-normal tabular-nums">
                    {date.slice(8)}/{date.slice(5, 7)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {staff.map((e) => (
            <tr key={e.id}>
              <td className="sticky left-0 z-10 max-w-44 bg-surface px-4 py-2.5">
                <EmployeeCell employee={e} />
              </td>
              {WEEKDAYS.map((d, day) => {
                const shift = shiftOf(e.id, day);
                return (
                  <td key={d} className="px-1.5 py-2.5 text-center">
                    {manage ? (
                      <button
                        type="button"
                        title={`${SHIFT_LABEL[shift]}${SHIFT_HOURS[shift] ? ` ${SHIFT_HOURS[shift]}` : ""}. Tap to change.`}
                        aria-label={`${e.name}, ${d}: ${SHIFT_LABEL[shift]}. Change to ${SHIFT_LABEL[nextShift(shift)]}`}
                        onClick={() => run(() => setShift(roster.id, e.id, day, nextShift(shift)))}
                        className={cn(shiftChipClass(shift), "transition hover:brightness-95 focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none")}
                      >
                        {SHIFT_LABEL[shift]}
                      </button>
                    ) : (
                      <ShiftChip shift={shift} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ShiftLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {SHIFTS.map((s) => (
        <span key={s} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn(shiftChipClass(s), "h-6 w-auto min-w-0")}>{SHIFT_LABEL[s]}</span>
          {SHIFT_HOURS[s] || "Weekly off"}
        </span>
      ))}
    </div>
  );
}
