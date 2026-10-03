"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Building2, CalendarDays, Mail, MessageCircle, Pencil, Phone, UserRound, X } from "lucide-react";
import { BRANCHES, branchName } from "@/lib/masters";
import { formatIsoDate } from "@/lib/format";
import { PANEL_MODULES, ROLE_ORDER, ROLES, effectivePermissions, roleDefaultPanels, type PanelModule, type Role } from "@/lib/rbac";
import { EMPLOYEE_STATUS_LABEL, addEmployee, employeeErrors, isManagingPartner, updateEmployee, type Employee, type EmployeeInput, type EmployeeStatus } from "@/lib/hr";
import { Button, Field, cn, inputClass } from "../ui";
import { Dialog, useInlineAction } from "./dialog";
import { EmployeeCell, EmployeeStatusPill, useEmployees, useToday, useCanManageHr } from "./hr-bits";

const blank = (today: string): EmployeeInput => ({
  name: "",
  role: "",
  branchId: "",
  branchIds: [],
  phone: "",
  whatsapp: "",
  email: "",
  joinedAt: today,
  reportingTo: "",
  status: "active",
  salaryBand: "",
});

function PhoneInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">+91</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className={cn(inputClass(invalid), "pl-12 tabular-nums")}
      />
    </div>
  );
}

/** Read-only checklist of the modules a role (with this employee's own overrides, if any) actually unlocks - derived live from rbac.ts, so it can never drift from what the app really enforces. */
export function ModuleAccessChips({ role, allowedPanels }: { role?: Role; allowedPanels?: PanelModule[] }) {
  const permissions = role ? effectivePermissions(role, allowedPanels) : [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {PANEL_MODULES.map((m) => {
        const allowed = permissions.includes(m.permission);
        return (
          <span
            key={m.key}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              allowed ? "bg-ok-soft text-ok" : "bg-sunken text-faint line-through decoration-1",
            )}
          >
            {m.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Multi-branch picker for the Add/Edit form: toggle pills, same interaction as the module access
 * toggles below. The first selected branch becomes `branchId`, kept in sync by the caller as the
 * employee's primary/home branch - the one attendance, rosters and payroll already key off.
 */
function BranchMultiSelect({ selected, onChange, invalid }: { selected: string[]; onChange: (next: string[]) => void; invalid?: boolean }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((b) => b !== id) : [...selected, id]);
  return (
    <div className={cn("flex flex-wrap gap-1.5 rounded-xl p-0.5", invalid && "ring-1 ring-danger")}>
      {BRANCHES.map((b) => {
        const on = selected.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(b.id)}
            className={cn(
              "btn-tap inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
              on ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {on && <Check className="size-3" />} {b.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Interactive per-employee panel toggles for the Add/Edit form. Starts from the selected system
 * role's defaults and lets the admin flip any panel on or off from there - the result is saved as
 * this employee's explicit `allowedPanels` override, taking effect the moment they sign in.
 */
function ModuleAccessToggles({ selected, onChange, disabled }: { selected: PanelModule[]; onChange: (next: PanelModule[]) => void; disabled?: boolean }) {
  const toggle = (key: PanelModule) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {PANEL_MODULES.map((m) => {
        const on = selected.includes(m.key);
        return (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(m.key)}
            className={cn(
              "btn-tap inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
              on ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {on && <Check className="size-3" />} {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** Add (no `employee`) or edit an employee. HR only; the store re-checks hr.manage. */
export function EmployeeFormDialog({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const today = useToday();
  const { employees } = useEmployees();
  const [form, setForm] = useState<EmployeeInput>(() =>
    employee
      ? { ...employee, branchIds: employee.branchIds ?? (employee.branchId ? [employee.branchId] : []), allowedPanels: employee.allowedPanels ?? roleDefaultPanels(employee.rbacRole) }
      : blank(today),
  );
  const [submitted, setSubmitted] = useState(false);
  const { submit, failure, busy } = useInlineAction();
  const errors = employeeErrors(form);
  const show = (k: keyof EmployeeInput) => (submitted ? errors[k] : undefined);
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setBranches = (branchIds: string[]) => setForm((f) => ({ ...f, branchIds, branchId: branchIds[0] ?? "" }));
  const roleHolder = form.rbacRole ? employees.find((e) => e.rbacRole === form.rbacRole && e.status !== "exited" && e.id !== employee?.id) : undefined;
  // Managing Partner is the protected head role: it can't be handed to anyone else, so the option
  // is hidden from every other employee's dropdown, and once an employee holds it the whole
  // control locks so it can't be changed, demoted, or cleared from here.
  const isProtectedHead = !!employee && isManagingPartner(employee);
  const roleOptions = ROLE_ORDER.filter((r) => r !== "managing_partner" || isProtectedHead);

  async function save() {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const ok = await submit(() => (employee ? updateEmployee(employee.id, form) : addEmployee(form)), employee ? `${form.name.trim()} updated` : `${form.name.trim()} added to the employee master`);
    if (ok) onClose();
  }

  return (
    <Dialog
      title={employee ? "Edit employee" : "Add employee"}
      subtitle={employee ? `${employee.id} · ${employee.name}` : "New joinee in the employee master"}
      onClose={onClose}
      onSubmit={save}
      wide
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="primary" className="flex-[2]" disabled={busy}>
            {employee ? "Save changes" : "Add employee"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          htmlFor="emp-name"
          required
          error={show("name")}
          hint={employee?.rbacRole ? `Signs in as ${ROLES[employee.rbacRole].label}. A new name shows everywhere in the app; past records keep the old name.` : undefined}
        >
          <input id="emp-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" className={inputClass(!!show("name"))} />
        </Field>
        <Field label="Job title" htmlFor="emp-role" required error={show("role")} hint="e.g. Rider, Mechanic, Sales Executive">
          <input id="emp-role" value={form.role} onChange={(e) => set("role", e.target.value)} list="emp-role-options" autoComplete="off" className={inputClass(!!show("role"))} />
          <datalist id="emp-role-options">
            {[...new Set(employees.map((e) => e.role))].sort().map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Branches"
          required
          error={show("branchId")}
          hint={(form.branchIds?.length ?? 0) > 1 ? `Primary branch: ${branchName(form.branchId)}` : undefined}
          wide
        >
          <BranchMultiSelect selected={form.branchIds ?? []} onChange={setBranches} invalid={!!show("branchId")} />
        </Field>
        <Field
          label="System login role"
          htmlFor="emp-rbac-role"
          hint={
            isProtectedHead
              ? "Managing Partner is the protected head role - it can't be changed, demoted, or cleared here."
              : roleHolder
                ? `${roleHolder.name} currently holds this role too - saving will not remove it from them`
                : "Leave blank if this person doesn't sign in to the app"
          }
        >
          <select
            id="emp-rbac-role"
            value={form.rbacRole ?? ""}
            disabled={isProtectedHead}
            onChange={(e) => {
              const rbacRole = (e.target.value || undefined) as Role | undefined;
              setForm((f) => ({ ...f, rbacRole, allowedPanels: roleDefaultPanels(rbacRole) }));
            }}
            className={cn(inputClass(), isProtectedHead && "cursor-not-allowed opacity-60")}
          >
            <option value="">No system login</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Panel access</p>
          {isProtectedHead ? (
            <p className="text-xs text-muted">Managing Partner always has full access to every panel - this can&apos;t be restricted.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">Starts from the role&apos;s defaults above - toggle any panel on or off for this person specifically.</p>
              <ModuleAccessToggles selected={form.allowedPanels ?? []} onChange={(allowedPanels) => set("allowedPanels", allowedPanels)} disabled={!form.rbacRole} />
            </>
          )}
        </div>
        <Field label="Mobile" htmlFor="emp-phone" required error={show("phone")}>
          <PhoneInput id="emp-phone" value={form.phone} onChange={(v) => set("phone", v)} invalid={!!show("phone")} />
        </Field>
        <Field label="WhatsApp" htmlFor="emp-wa" error={show("whatsapp")} hint="Leave blank if same as mobile">
          <PhoneInput id="emp-wa" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} invalid={!!show("whatsapp")} />
        </Field>
        <Field label="Email" htmlFor="emp-email" required error={show("email")}>
          <input
            id="emp-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
            className={inputClass(!!show("email"))}
          />
        </Field>
        <Field label="Joining date" htmlFor="emp-joined" required error={show("joinedAt")} hint={form.joinedAt ? formatIsoDate(form.joinedAt) : undefined}>
          <input id="emp-joined" type="date" value={form.joinedAt} max={today} onChange={(e) => set("joinedAt", e.target.value)} className={inputClass(!!show("joinedAt"))} />
        </Field>
        <Field label="Status" htmlFor="emp-status">
          <select id="emp-status" value={form.status} onChange={(e) => set("status", e.target.value as EmployeeStatus)} className={inputClass()}>
            {(Object.keys(EMPLOYEE_STATUS_LABEL) as EmployeeStatus[]).map((s) => (
              <option key={s} value={s}>
                {EMPLOYEE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salary band" htmlFor="emp-band" hint="Reference only; salaries are processed outside this app">
          <input id="emp-band" value={form.salaryBand ?? ""} onChange={(e) => set("salaryBand", e.target.value)} autoComplete="off" className={inputClass()} />
        </Field>
      </div>
      {failure && <p className="mt-4 text-sm font-medium text-danger">{failure}</p>}
    </Dialog>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-muted [&>svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <div className="text-sm font-medium break-words text-ink">{children}</div>
      </div>
    </div>
  );
}

/** Side drawer (bottom sheet on phones) with an employee's contact and org details. */
export function EmployeeDrawer({ employee, onClose, onEdit }: { employee: Employee; onClose: () => void; onEdit?: () => void }) {
  const { byId } = useEmployees();
  const manageHr = useCanManageHr();
  const manager = byId.get(employee.reportingTo);
  const reports = [...byId.values()].filter((e) => e.reportingTo === employee.id && e.status !== "exited");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(

    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-end bg-black/45 sm:items-stretch" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={employee.name}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col anim-dialog overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <EmployeeCell employee={employee} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <EmployeeStatusPill status={employee.status} />
              <span>{employee.id}</span>
              {employee.rbacRole && <span>· App login: {ROLES[employee.rbacRole].label}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-5">
          <DetailRow icon={<Phone />} label="Mobile">
            <a href={`tel:+91${employee.phone}`} className="tabular-nums hover:underline">
              +91 {employee.phone}
            </a>
          </DetailRow>
          <DetailRow icon={<MessageCircle />} label="WhatsApp">
            <a href={`https://wa.me/91${employee.whatsapp}`} target="_blank" rel="noreferrer" className="tabular-nums hover:underline">
              +91 {employee.whatsapp}
            </a>
          </DetailRow>
          <DetailRow icon={<Mail />} label="Email">
            {employee.email ? (
              <a href={`mailto:${employee.email}`} className="hover:underline">
                {employee.email}
              </a>
            ) : (
              <span className="text-muted">Not on file</span>
            )}
          </DetailRow>
          <DetailRow icon={<Building2 />} label="Branch">
            {branchName(employee.branchId)}
          </DetailRow>
          <DetailRow icon={<UserRound />} label="Reports to">
            {manager ? `${manager.name} · ${manager.role}` : <span className="text-muted">No one (top of the org)</span>}
            {reports.length > 0 && <p className="mt-1 text-xs font-normal text-muted">Manages {reports.map((r) => r.name).join(", ")}</p>}
          </DetailRow>
          <DetailRow icon={<CalendarDays />} label="Joined">
            {formatIsoDate(employee.joinedAt)}
            {employee.salaryBand && <span className="font-normal text-muted"> · Band {employee.salaryBand}</span>}
          </DetailRow>
        </div>
        {manageHr && onEdit && (
          <div className="border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button size="lg" variant="primary" className="w-full" onClick={onEdit}>
              <Pencil className="size-4" /> Edit employee
            </Button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
