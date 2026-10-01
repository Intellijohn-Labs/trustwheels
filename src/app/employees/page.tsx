"use client";

import { useState } from "react";
import { Search, TriangleAlert, Trash2, UserPlus, Users } from "lucide-react";
import { branchName } from "@/lib/masters";
import { ROLES } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { activeEmployeeCount, deleteEmployee, deleteEmployees, EMPLOYEE_STATUS_LABEL, MAX_EMPLOYEES, type Employee, type EmployeeStatus } from "@/lib/hr";
import { DataTable } from "@/components/data-table";
import { Button, PageHeader, Panel, Pill, Segmented, cn, inputClass } from "@/components/ui";
import { BranchSelect, EmployeeCell, EmployeeStatusPill, useEmployees } from "@/components/panels/hr-bits";
import { EmployeeFormDialog, ModuleAccessChips } from "@/components/panels/employee-panels";
import { ConfirmDeleteDialog } from "@/components/panels/confirm-delete-dialog";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "@/components/selection";

type StatusFilter = EmployeeStatus | "all";

/**
 * Employee & Access Management - Managing Partner only (staff.manage), separate from the HR
 * team's own /hr/employees workspace (hr.view/hr.manage), which stays exactly as it was: HR keeps
 * full CRUD there and the Managing Partner still sees it as view-only. This page reads and writes
 * the same underlying employee master, so a change here shows up everywhere else that reads it -
 * the Technician dropdown on job cards, the GPS attendance sheet's staff roster, and the app's own
 * sign-in permissions, all keyed off the same `rbacRole` field edited below.
 */
export default function EmployeeAccessPage() {
  const { can } = useRole();
  const manage = can("staff.manage");
  const { employees, ready } = useEmployees();
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<Employee | "new">();
  const label = (e: Employee) => `${e.name} · ${e.role}`;

  const q = query.trim().toLowerCase();
  const inBranch = employees.filter((e) => branch === "all" || e.branchId === branch);
  const rows = inBranch
    .filter((e) => status === "all" || e.status === status)
    .filter((e) => !q || [e.name, e.role, e.phone, e.email, e.id].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = (s: StatusFilter) => inBranch.filter((e) => s === "all" || e.status === s).length;
  const selection = useSelection(rows, (e) => e.id);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; labels: string[] } | null>(null);
  const activeCount = activeEmployeeCount(employees);
  const atCap = activeCount >= MAX_EMPLOYEES;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees & access"
        icon={<Users className="size-6 text-brand" />}
        description="Add staff, assign a job title and branch, and grant a system login role where one's needed - the role decides exactly which panels they can open."
        actions={
          manage && (
            <Button variant="primary" onClick={() => setEditing("new")} disabled={atCap} title={atCap ? `Maximum employee limit reached (${activeCount}/${MAX_EMPLOYEES})` : undefined}>
              <UserPlus className="size-4" /> Add employee
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={atCap ? "warn" : "neutral"}>
          Employees: {activeCount} / {MAX_EMPLOYEES} slots used
        </Pill>
        {atCap && (
          <span className="inline-flex items-center gap-1.5 text-sm text-warn">
            <TriangleAlert className="size-3.5" />
            Maximum employee limit reached ({activeCount}/{MAX_EMPLOYEES}). To add a new person, delete or deactivate an existing employee.
          </span>
        )}
      </div>

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

      {manage && selection.count > 0 && (
        <SelectionToolbar
          count={selection.count}
          noun="employee"
          onClear={selection.clear}
          onDelete={() =>
            setConfirmDelete({
              ids: [...selection.selected],
              labels: rows.filter((e) => selection.selected.has(e.id)).map(label),
            })
          }
        />
      )}

      <Panel flush>
        {ready && (
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            empty="No employees match these filters."
            columns={[
              ...(manage
                ? [
                    {
                      header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown employees" />,
                      cell: (e: Employee) =>
                        e.rbacRole === "managing_partner" ? (
                          <span className="grid place-items-center p-2.5" title="Managing Partner can't be bulk-deleted" />
                        ) : (
                          <RowCheckbox checked={selection.isSelected(e.id)} onChange={() => selection.toggle(e.id)} label={`Select ${label(e)}`} />
                        ),
                    },
                  ]
                : []),
              { header: "Employee", cell: (e) => <EmployeeCell employee={e} /> },
              {
                header: "Role",
                cell: (e) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="whitespace-nowrap">{e.role}</span>
                    {e.rbacRole && <span className="text-xs text-muted">Signs in as {ROLES[e.rbacRole].label}</span>}
                  </div>
                ),
              },
              { header: "Branch", cell: (e) => <span className="whitespace-nowrap">{branchName(e.branchId)}</span> },
              { header: "Panel access", cell: (e) => <ModuleAccessChips role={e.rbacRole} allowedPanels={e.allowedPanels} /> },
              { header: "Status", cell: (e) => <EmployeeStatusPill status={e.status} /> },
              ...(manage
                ? [
                    {
                      header: "",
                      align: "right" as const,
                      cell: (e: Employee) => (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={e.rbacRole === "managing_partner"}
                            title={e.rbacRole === "managing_partner" ? "Managing Partner cannot be deleted" : undefined}
                            onClick={() => setConfirmDelete({ ids: [e.id], labels: [label(e)] })}
                            aria-label={`Delete ${e.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Panel>

      {editing && <EmployeeFormDialog employee={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {confirmDelete && (
        <ConfirmDeleteDialog
          count={confirmDelete.ids.length}
          items={confirmDelete.labels}
          noun="employee"
          onConfirm={async () => {
            if (confirmDelete.ids.length === 1) await deleteEmployee(confirmDelete.ids[0]);
            else await deleteEmployees(confirmDelete.ids);
            selection.clear();
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
