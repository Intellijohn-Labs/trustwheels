"use client";

import { useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { branchName } from "@/lib/masters";
import { formatIsoDate } from "@/lib/format";
import { EMPLOYEE_STATUS_LABEL, type Employee, type EmployeeStatus } from "@/lib/hr";
import { DataTable } from "@/components/data-table";
import { Button, PageHeader, Panel, Segmented, cn, inputClass } from "@/components/ui";
import { BranchSelect, EmployeeCell, EmployeeStatusPill, ViewOnlyNote, useEmployees, useCanManageHr } from "@/components/panels/hr-bits";
import { EmployeeDrawer, EmployeeFormDialog } from "@/components/panels/employee-panels";

type StatusFilter = EmployeeStatus | "all";

export default function EmployeesPage() {
  const manage = useCanManageHr();
  const { employees, byId, ready } = useEmployees();
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [viewing, setViewing] = useState<string>();
  const [editing, setEditing] = useState<Employee | "new">();

  const q = query.trim().toLowerCase();
  const inBranch = employees.filter((e) => branch === "all" || e.branchId === branch);
  const rows = inBranch
    .filter((e) => status === "all" || e.status === status)
    .filter((e) => !q || [e.name, e.role, e.phone, e.email, e.id].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = (s: StatusFilter) => inBranch.filter((e) => s === "all" || e.status === s).length;
  const viewed = viewing ? byId.get(viewing) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        icon={<Users className="size-6 text-brand" />}
        description="Employee master for every branch and the Angamaly hub."
        actions={
          manage && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <UserPlus className="size-4" /> Add employee
            </Button>
          )
        }
      />
      {!manage && <ViewOnlyNote />}

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, job title, phone, email"
            aria-label="Search employees"
            className={cn(inputClass(), "pl-10")}
          />
        </div>
        <BranchSelect value={branch} onChange={setBranch} />
      </div>
      <div className="overflow-x-auto sm:max-w-xl">
        <Segmented<StatusFilter>
          name="Employee status"
          value={status}
          onChange={setStatus}
          options={(["active", "on_notice", "exited", "all"] as StatusFilter[]).map((s) => ({ value: s, label: `${s === "all" ? "All" : s === "on_notice" ? "Notice" : EMPLOYEE_STATUS_LABEL[s]} ${count(s)}` }))}
        />
      </div>

      <Panel flush>
        {ready && (
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            empty="No employees match these filters."
            columns={[
              { header: "Employee", cell: (e) => <EmployeeCell employee={e} onOpen={() => setViewing(e.id)} /> },
              { header: "Branch", cell: (e) => <span className="whitespace-nowrap">{branchName(e.branchId)}</span> },
              { header: "Mobile", cell: (e) => <span className="whitespace-nowrap tabular-nums">+91 {e.phone}</span> },
              { header: "Reports to", cell: (e) => <span className="whitespace-nowrap">{byId.get(e.reportingTo)?.name ?? <span className="text-faint">—</span>}</span> },
              { header: "Joined", cell: (e) => <span className="tabular-nums">{formatIsoDate(e.joinedAt)}</span> },
              { header: "Status", cell: (e) => <EmployeeStatusPill status={e.status} /> },
              ...(manage
                ? [
                    {
                      header: "",
                      align: "right" as const,
                      cell: (e: Employee) => (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`}>
                          Edit
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Panel>

      {viewed && (
        <EmployeeDrawer
          employee={viewed}
          onClose={() => setViewing(undefined)}
          onEdit={() => {
            setViewing(undefined);
            setEditing(viewed);
          }}
        />
      )}
      {editing && <EmployeeFormDialog employee={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
