"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { BRANCHES, branchName } from "@/lib/masters";
import { ATTENDANCE_LABEL, addDays, isLate, leaveRequests, monthLabel, payrollInput, type AttendanceStatus, type PayrollRow } from "@/lib/hr";
import { DataTable } from "@/components/data-table";
import { Button, PageHeader, Panel, Pill, Segmented, cn, inputClass } from "@/components/ui";
import { AttendanceDayTable, useAttendanceLines } from "@/components/panels/attendance-panel";
import { BranchSelect, EmployeeCell, ViewOnlyNote, longDate, useEmployees, useToday, useCanManageHr } from "@/components/panels/hr-bits";

type View = "day" | "month";

export default function AttendancePage() {
  const manageHr = useCanManageHr();
  const today = useToday();
  const [picked, setPicked] = useState<string>();
  const date = picked ?? today;
  const [branch, setBranch] = useState("all");
  const [view, setView] = useState<View>("day");
  const { lines, records, ready } = useAttendanceLines(date);
  const { employees } = useEmployees();
  const { items: leaves } = leaveRequests.useItems();

  const visible = lines.filter((l) => branch === "all" || l.employee.branchId === branch);
  const tally = (s: AttendanceStatus) => visible.filter((l) => l.record?.status === s).length;
  const late = visible.filter((l) => l.record && isLate(l.record)).length;
  const unmarked = visible.filter((l) => !l.record).length;

  const month = date.slice(0, 7);
  const summary = useMemo(
    () => payrollInput(month, { employees, attendance: records, leaves, vehicles: [] }, today).filter((r) => branch === "all" || r.employee.branchId === branch),
    [month, employees, records, leaves, today, branch],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" icon={<CalendarCheck className="size-6 text-brand" />} description="Daily attendance by branch. Check-in after 09:30 counts as a late mark." />
      {!manageHr && <ViewOnlyNote />}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_14rem] sm:items-center">
        <div className="flex items-center gap-2">
          <Button aria-label="Previous day" onClick={() => setPicked(addDays(date, -1))} className="h-12 w-12 px-0">
            <ChevronLeft className="size-5" />
          </Button>
          <input type="date" aria-label="Date" value={date} max={today} onChange={(e) => e.target.value && setPicked(e.target.value)} className={cn(inputClass(), "min-w-0 flex-1 sm:w-44")} />
          <Button aria-label="Next day" onClick={() => setPicked(addDays(date, 1))} disabled={date >= today} className="h-12 w-12 px-0">
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <p className="text-sm font-medium">
          {longDate(date)}
          {date !== today && (
            <button type="button" onClick={() => setPicked(undefined)} className="ml-2 text-brand hover:underline">
              Today
            </button>
          )}
        </p>
        <BranchSelect value={branch} onChange={setBranch} />
      </div>

      <div className="sm:max-w-sm">
        <Segmented<View>
          name="View"
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "month", label: `${monthLabel(month)}` },
          ]}
        />
      </div>

      {view === "day" ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Pill tone="ok">
              {ATTENDANCE_LABEL.present} {tally("present")}
            </Pill>
            <Pill tone="warn">
              {ATTENDANCE_LABEL.half_day} {tally("half_day")}
            </Pill>
            <Pill tone="danger">
              {ATTENDANCE_LABEL.absent} {tally("absent")}
            </Pill>
            <Pill tone="brand">
              {ATTENDANCE_LABEL.leave} {tally("leave")}
            </Pill>
            <Pill>
              {ATTENDANCE_LABEL.week_off} {tally("week_off")}
            </Pill>
            <Pill tone="warn">Late {late}</Pill>
            <Pill>Not marked {unmarked}</Pill>
          </div>
          {ready &&
            BRANCHES.filter((b) => branch === "all" || b.id === branch).map((b) => {
              const branchLines = visible.filter((l) => l.employee.branchId === b.id);
              if (branch === "all" && branchLines.length === 0) return null;
              const inCount = branchLines.filter((l) => l.record?.status === "present" || l.record?.status === "half_day").length;
              return (
                <Panel key={b.id} flush title={b.name} description={`${inCount} of ${branchLines.length} in`}>
                  <AttendanceDayTable lines={branchLines} date={date} />
                </Panel>
              );
            })}
        </>
      ) : (
        <Panel flush title={`Month summary · ${monthLabel(month)}`} description="Counts up to today. The full input sheet with leave types and incentives is on Payroll input.">
          <DataTable<PayrollRow>
            rows={summary}
            rowKey={(r) => r.employee.id}
            empty="No one on the roll this month."
            columns={[
              { header: "Employee", cell: (r) => <EmployeeCell employee={r.employee} /> },
              { header: "Branch", cell: (r) => <span className="whitespace-nowrap">{branchName(r.employee.branchId)}</span> },
              { header: "Present", align: "right", cell: (r) => r.present },
              { header: "Half day", align: "right", cell: (r) => r.halfDays },
              { header: "Absent", align: "right", cell: (r) => (r.absent ? <span className="font-semibold text-danger">{r.absent}</span> : 0) },
              { header: "Leave", align: "right", cell: (r) => r.leave.casual + r.leave.sick + r.leave.earned },
              { header: "Late", align: "right", cell: (r) => (r.lateMarks ? <span className="font-semibold text-warn">{r.lateMarks}</span> : 0) },
              { header: "Not marked", align: "right", cell: (r) => r.notMarked },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
