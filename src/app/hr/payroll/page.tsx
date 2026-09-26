"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { branchName } from "@/lib/masters";
import { formatNumber } from "@/lib/format";
import { useScopedVehicles } from "@/lib/scoped";
import { INCENTIVE_PER_SALE_RUPEES, LATE_AFTER, attendance, leaveRequests, monthLabel, payrollCsv, payrollInput, type PayrollRow } from "@/lib/hr";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { Button, PageHeader, Panel, inputClass } from "@/components/ui";
import { BranchSelect, EmployeeCell, useEmployees, useToday } from "@/components/panels/hr-bits";

function recentMonths(today: string, count = 6) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export default function PayrollPage() {
  const today = useToday();
  const toast = useToast();
  const [picked, setPicked] = useState<string>();
  const month = picked ?? today.slice(0, 7);
  const [branch, setBranch] = useState("all");
  const { employees, ready } = useEmployees();
  const { items: records } = attendance.useItems();
  const { items: leaves } = leaveRequests.useItems();
  // Sales in the viewer's scope (HR and the proprietor see every branch).
  const { vehicles } = useScopedVehicles();

  const rows = useMemo(
    () => payrollInput(month, { employees, attendance: records, leaves, vehicles }, today).filter((r) => branch === "all" || r.employee.branchId === branch),
    [month, employees, records, leaves, vehicles, today, branch],
  );
  const totalIncentive = rows.reduce((s, r) => s + r.incentiveRupees, 0);

  function exportCsv() {
    const csv = payrollCsv(month, rows, branchName);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-input-${month}${branch === "all" ? "" : `-${branch}`}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("ok", `Payroll input for ${monthLabel(month)} downloaded (${rows.length} employees)`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll input"
        icon={<FileSpreadsheet className="size-6 text-brand" />}
        description="Attendance, leave, late marks and sales incentives per employee, ready to hand to payroll."
        actions={
          <Button variant="primary" onClick={exportCsv} disabled={!ready || rows.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <p className="flex gap-2 rounded-xl bg-sunken px-3.5 py-2.5 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          This is the input sheet only. Salary structure, statutory deductions (PF, ESI, PT, TDS) and pay processing are out of scope. Incentive rule: ₹{INCENTIVE_PER_SALE_RUPEES} per vehicle marked
          sold in the month by that sales executive. Late mark: check-in after {LATE_AFTER}.
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-[14rem_14rem]">
        <select aria-label="Month" value={month} onChange={(e) => setPicked(e.target.value)} className={inputClass()}>
          {recentMonths(today).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <BranchSelect value={branch} onChange={setBranch} />
      </div>

      <Panel flush title={`${monthLabel(month)} · ${rows.length} employees`} description={`Incentives total ₹${formatNumber(totalIncentive)}`}>
        {ready && (
          <DataTable<PayrollRow>
            rows={rows}
            rowKey={(r) => r.employee.id}
            empty="No one on the roll for this month."
            columns={[
              { header: "Employee", cell: (r) => <EmployeeCell employee={r.employee} /> },
              { header: "Branch", cell: (r) => <span className="whitespace-nowrap">{branchName(r.employee.branchId)}</span> },
              { header: "Working days", align: "right", cell: (r) => r.workingDays },
              { header: "Present", align: "right", cell: (r) => r.present },
              { header: "Half days", align: "right", cell: (r) => r.halfDays },
              { header: "Absent", align: "right", cell: (r) => r.absent },
              { header: "CL", align: "right", cell: (r) => r.leave.casual },
              { header: "SL", align: "right", cell: (r) => r.leave.sick },
              { header: "EL", align: "right", cell: (r) => r.leave.earned },
              { header: "Not marked", align: "right", cell: (r) => r.notMarked },
              { header: "Late marks", align: "right", cell: (r) => r.lateMarks },
              { header: "Sales", align: "right", cell: (r) => r.salesClosed || <span className="text-faint">—</span> },
              { header: "Incentive", align: "right", cell: (r) => (r.incentiveRupees ? `₹${formatNumber(r.incentiveRupees)}` : <span className="text-faint">—</span>) },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
