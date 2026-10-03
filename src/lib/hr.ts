"use client";

import { defineCollection, newId } from "./collections";
import { HOLIDAYS } from "./masters";
import { can, ROLES, type PanelModule, type Role } from "./rbac";
import { assertCan, currentRole, getActor } from "./session";
import { logActivity } from "./activity-log";
import type { Vehicle } from "./types";
import { istDate } from "./working-days";

/*
 * HR / Admin: employee master, attendance, leave, shift roster and the payroll input sheet.
 * Browser-only stand-in for the HR API. Every mutation checks hr.manage first, as the server will.
 * Dates are YYYY-MM-DD in Asia/Kolkata; times are "HH:MM" (24h, IST).
 */

// ---- types ---------------------------------------------------------------------------

export type EmployeeStatus = "active" | "on_notice" | "exited";
export type AttendanceStatus = "present" | "absent" | "leave" | "half_day" | "week_off";
export type LeaveType = "casual" | "sick" | "earned";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type Shift = "morning" | "general" | "evening" | "off";

export interface Employee {
  id: string;
  name: string;
  /** Job title. */
  role: string;
  /** System login role, for the people who use this app. */
  rbacRole?: Role;
  /** Per-employee override of which panels rbacRole's permissions actually grant. Unset = use the role's own defaults untouched. */
  allowedPanels?: PanelModule[];
  /** Home branch - attendance, rosters and payroll all key off this single id; keep setting it. */
  branchId: string;
  /** Every branch this employee is assigned to, for the Add/Edit form's multi-select. `branchId`
   * (above) is always kept equal to the first entry, so existing single-branch logic elsewhere
   * never has to change. Optional/absent on records saved before this field existed - treat as
   * just `[branchId]`. */
  branchIds?: string[];
  phone: string;
  whatsapp: string;
  email: string;
  joinedAt: string; // YYYY-MM-DD
  /** Employee id of the manager. Empty for the Managing Partner. */
  reportingTo: string;
  status: EmployeeStatus;
  salaryBand?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD, IST
  checkIn?: string; // HH:MM
  checkOut?: string; // HH:MM
  branchId: string;
  status: AttendanceStatus;
  marked?: { at: string; by: string };
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  from: string;
  to: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  decided?: { at: string; by: string; note: string };
}

export interface RosterShift {
  employeeId: string;
  /** 0 = Monday ... 6 = Sunday. */
  day: number;
  shift: Shift;
}

export interface Roster {
  id: string;
  branchId: string;
  weekStart: string; // Monday, YYYY-MM-DD
  shifts: RosterShift[];
}

// ---- labels & rules ------------------------------------------------------------------

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = { active: "Active", on_notice: "On notice", exited: "Exited" };
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On leave",
  half_day: "Half day",
  week_off: "Week off",
};
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = { casual: "Casual", sick: "Sick", earned: "Earned" };
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
export const SHIFTS: Shift[] = ["morning", "general", "evening", "off"];
export const SHIFT_LABEL: Record<Shift, string> = { morning: "Morning", general: "General", evening: "Evening", off: "Off" };
export const SHIFT_HOURS: Record<Shift, string> = { morning: "07:00–15:00", general: "09:30–18:30", evening: "12:00–20:00", off: "" };
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A check-in after this time is a late mark. */
export const LATE_AFTER = "09:30";

/**
 * Sales incentive rule used on the payroll input sheet: every vehicle marked sold in the month
 * (sale.status "sold", sale.soldAt in that IST month) earns the executive named in sale.by this amount.
 */
export const INCENTIVE_PER_SALE_RUPEES = 500;

/** The Managing Partner and partners don't punch in; they're kept out of attendance, roster and payroll input. */
export function attendanceExempt(e: Employee) {
  return e.rbacRole === "managing_partner" || e.rbacRole === "partner";
}

/** People expected at work on `date`: not exited, joined by then, not exempt. */
export function onRollOn(e: Employee, date: string) {
  return e.status !== "exited" && e.joinedAt <= date && !attendanceExempt(e);
}

export function isLate(a: Pick<Attendance, "checkIn" | "status">) {
  return (a.status === "present" || a.status === "half_day") && !!a.checkIn && a.checkIn > LATE_AFTER;
}

export function isSalesStaff(e: Employee) {
  return /sales/i.test(e.role);
}

/**
 * HR / Admin manages people records; everyone else with hr.view (the Managing Partner) is read-only.
 * rbac.ts gives the Managing Partner every permission including hr.manage, so this narrows it here
 * until rbac.ts drops hr.manage from the Managing Partner.
 */
export function canManageHr(role: Role) {
  return role !== "managing_partner" && can(role, "hr.manage");
}

function assertManage() {
  // The dedicated Employee & Access panel is Managing-Partner-only and deliberately overrides the
  // "HR is view-only for the Managing Partner" rule below - everyone else still goes through the
  // normal hr.manage check.
  if (can(currentRole(), "staff.manage")) return;
  assertCan("hr.manage");
  if (!canManageHr(currentRole())) throw new Error("Not allowed: HR records are view-only for the Managing Partner");
}

// ---- date helpers --------------------------------------------------------------------

const DAY = 86_400_000;
const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();

export function addDays(ymd: string, n: number) {
  return new Date(utc(ymd) + n * DAY).toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(ymd: string) {
  return (new Date(utc(ymd)).getUTCDay() + 6) % 7;
}

export function mondayOf(ymd: string) {
  return addDays(ymd, -weekdayIndex(ymd));
}

export function isWeeklyOff(ymd: string) {
  return weekdayIndex(ymd) === 6 || HOLIDAYS.includes(ymd);
}

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthDates(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return datesBetween(`${month}-01`, `${month}-${String(last).padStart(2, "0")}`);
}

export function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function leaveDays(l: Pick<LeaveRequest, "from" | "to">) {
  return datesBetween(l.from, l.to).filter((d) => !isWeeklyOff(d));
}

export function todayIst() {
  return istDate(Date.now());
}

/*
 * No demo roster: this app runs on real hr_employees records only. These stay as functions
 * (not plain []) so each defineCollection(...) call site and its seedVersion's "bump to re-seed"
 * convention stay meaningful if a genuine local fixture is ever needed again.
 */
function seedEmployees(): Employee[] {
  return [];
}

function seedLeaves(): LeaveRequest[] {
  return [];
}

function seedAttendance(): Attendance[] {
  return [];
}

function seedRosters(): Roster[] {
  return [];
}

export const employees = defineCollection<Employee>("hr-employees", seedEmployees, 3, { supabaseTable: "hr_employees" });
export const attendance = defineCollection<Attendance>("hr-attendance", seedAttendance, 3);
export const leaveRequests = defineCollection<LeaveRequest>("hr-leave", seedLeaves, 2);
export const rosters = defineCollection<Roster>("hr-rosters", seedRosters, 3);

// ---- mutations -----------------------------------------------------------------------

/*
 * collections.ts all()/add()/update() currently resolve to the list as first loaded, so a second
 * mutation in the same page session would overwrite the first. Until that's fixed there, HR reads
 * the persisted list (every save awaits its IndexedDB write) and writes whole lists with
 * replaceAll(), one mutation at a time.
 */
type Collection<T> = { name: string; all(): Promise<T[]>; replaceAll(items: T[]): Promise<void> };

/**
 * The collection's current items, from whatever source it actually reads from (Supabase when
 * configured, local IndexedDB otherwise) - never a raw local read, so this stays correct for
 * a Supabase-backed collection like `employees` instead of silently reading stale local data.
 */
async function latest<T>(c: Collection<T>) {
  return c.all();
}

let queue: Promise<unknown> = Promise.resolve();
function serial<R>(fn: () => Promise<R>): Promise<R> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function modify<T extends { id: string }>(c: Collection<T>, id: string, change: (item: T) => T) {
  const items = await latest(c);
  const current = items.find((i) => i.id === id);
  if (!current) throw new Error(`${c.name}: ${id} not found`);
  const next = change(current);
  await c.replaceAll(items.map((i) => (i.id === id ? next : i)));
  return next;
}

export type EmployeeInput = Omit<Employee, "id">;

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Field errors for an employee form; empty when valid. Also enforced by add/updateEmployee. */
export function employeeErrors(e: Partial<EmployeeInput>) {
  const errors: Partial<Record<keyof EmployeeInput, string>> = {};
  if (!e.name?.trim()) errors.name = "Required";
  if (!e.role?.trim()) errors.role = "Required";
  if (!e.branchId) errors.branchId = "Required";
  if (!MOBILE.test(e.phone ?? "")) errors.phone = e.phone ? "Enter a 10-digit mobile number" : "Required";
  if (e.whatsapp && !MOBILE.test(e.whatsapp)) errors.whatsapp = "Enter a 10-digit mobile number";
  if (!e.email?.trim()) errors.email = "Required";
  else if (!EMAIL.test(e.email)) errors.email = "Enter a valid email";
  if (!YMD.test(e.joinedAt ?? "")) errors.joinedAt = "Required";
  return errors;
}

function clean(input: EmployeeInput): EmployeeInput {
  const errors = employeeErrors(input);
  const first = Object.entries(errors)[0];
  if (first) throw new Error(`Blocked: ${first[0]} — ${first[1]}`);
  return { ...input, name: input.name.trim(), role: input.role.trim(), email: input.email.trim(), whatsapp: input.whatsapp || input.phone };
}

/** Hard cap on active employees - deliberately small for this deployment's headcount. */
export const MAX_EMPLOYEES = 15;

export function activeEmployeeCount(all: Employee[]) {
  return all.filter((e) => e.status === "active").length;
}

/**
 * Managing Partner is the protected head role: exactly one account holds it, and it can't be
 * handed to, or taken from, anyone, nor deleted, via this app. Reassigning or removing it would
 * mean either locking the current holder out of their own master-admin account or quietly minting
 * a second one - both are mistakes this app should refuse outright rather than rely on everyone
 * remembering not to.
 */
const PROTECTED_ROLE: Role = "managing_partner";
const PROTECTED_LABEL = ROLES[PROTECTED_ROLE].label;

/**
 * Whether `e` is the protected Managing Partner account. Checked two ways on purpose: the
 * authoritative `rbacRole` enum, and a case-insensitive fallback against the free-text job title
 * (`role`). A live record could in principle carry the job title "Managing Partner" without
 * `rbacRole` ever having been set - e.g. entered before the system-login field existed, imported,
 * or hand-edited in Supabase directly - and relying on `rbacRole` alone would leave exactly that
 * record unprotected. Either signal being true is enough to lock it down.
 */
export function isManagingPartner(e: Pick<Employee, "rbacRole" | "role">): boolean {
  return e.rbacRole === PROTECTED_ROLE || e.role.trim().toLowerCase() === PROTECTED_LABEL.toLowerCase();
}

export function addEmployee(input: EmployeeInput) {
  assertManage();
  if (isManagingPartner(input)) {
    throw new Error(`Blocked: ${PROTECTED_LABEL} is a protected role and can't be assigned to a new employee.`);
  }
  const data = clean(input);
  return serial(async () => {
    const all = await latest(employees);
    if (data.status === "active" && activeEmployeeCount(all) >= MAX_EMPLOYEES) {
      throw new Error(`Blocked: maximum employee limit reached (${MAX_EMPLOYEES}/${MAX_EMPLOYEES}). Deactivate or delete an existing employee first.`);
    }
    // Sign-in resolves a role by matching the Auth account's email back to exactly one active
    // employee (see lib/auth.ts) - two active employees sharing an email would make that
    // ambiguous, so it's refused here rather than left as a silent "whichever matches first".
    if (data.status !== "exited" && all.some((e) => e.status !== "exited" && e.email.trim().toLowerCase() === data.email.trim().toLowerCase())) {
      throw new Error("Blocked: another active employee already uses this email - each employee needs a unique email to sign in.");
    }
    const next = all.reduce((max, e) => Math.max(max, Number(e.id.replace(/\D/g, "")) || 0), 0) + 1;
    const employee: Employee = { ...data, id: `e-${String(next).padStart(2, "0")}` };
    await employees.replaceAll([employee, ...all]);
    logActivity("EMPLOYEE", employee.name, `Added employee ${employee.name} (${employee.role})${employee.rbacRole ? ` · signs in as ${ROLES[employee.rbacRole].label}` : ""}`);
    return employee;
  });
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  assertManage();
  if (input.reportingTo === id) throw new Error("Blocked: an employee can't report to themselves");
  const data = clean(input);
  return serial(async () => {
    const all = await latest(employees);
    const current = all.find((e) => e.id === id);
    const wasProtected = !!current && isManagingPartner(current);
    const willBeProtected = isManagingPartner(data);
    if (wasProtected && !willBeProtected) {
      throw new Error(`Blocked: ${PROTECTED_LABEL}'s role can't be changed, demoted, or cleared.`);
    }
    if (!wasProtected && willBeProtected) {
      throw new Error(`Blocked: ${PROTECTED_LABEL} is a protected role and can't be assigned to another employee.`);
    }
    // Defense in depth: even if a disabled control were bypassed, a protected-head record can
    // never end up with a restricted panel set - the form already locks this, this just makes
    // sure the store agrees no matter what reaches it.
    const safeData = wasProtected ? { ...data, allowedPanels: undefined } : data;
    if (safeData.status === "active" && current?.status !== "active" && activeEmployeeCount(all) >= MAX_EMPLOYEES) {
      throw new Error(`Blocked: maximum employee limit reached (${MAX_EMPLOYEES}/${MAX_EMPLOYEES}). Deactivate or delete an existing employee first.`);
    }
    if (
      safeData.status !== "exited" &&
      all.some((e) => e.id !== id && e.status !== "exited" && e.email.trim().toLowerCase() === safeData.email.trim().toLowerCase())
    ) {
      throw new Error("Blocked: another active employee already uses this email - each employee needs a unique email to sign in.");
    }
    const updated = await modify(employees, id, (e) => ({ ...e, ...safeData, id }));
    logActivity("EMPLOYEE", updated.name, `Edited employee ${updated.name} (${updated.role})`);
    return updated;
  });
}

/** Permanently remove one employee record. Managing Partner only; every other role never sees the option. */
export function deleteEmployee(id: string) {
  assertCan("hr.delete");
  return serial(async () => {
    const all = await latest(employees);
    const target = all.find((e) => e.id === id);
    if (!target) throw new Error("Employee not found");
    if (isManagingPartner(target)) throw new Error(`Blocked: the ${PROTECTED_LABEL} account can't be deleted.`);
    await employees.remove(id);
    logActivity("EMPLOYEE", target.name, `Deleted employee ${target.name} (${target.role})`);
  });
}

/**
 * Permanently remove several employee records in one write, e.g. from a bulk selection. The
 * Managing Partner's id is filtered out before the delete runs no matter how it got into `ids` -
 * including via a "select all" that doesn't itself know which rows are protected - so a bulk
 * delete still removes every other eligible employee instead of refusing the whole batch.
 */
export function deleteEmployees(ids: string[]) {
  assertCan("hr.delete");
  return serial(async () => {
    const all = await latest(employees);
    const targets = all.filter((e) => ids.includes(e.id));
    const protectedTargets = targets.filter(isManagingPartner);
    const eligible = targets.filter((e) => !isManagingPartner(e));
    if (eligible.length) {
      await employees.removeMany(eligible.map((e) => e.id));
      logActivity("EMPLOYEE", `${eligible.length} employees`, `Deleted ${eligible.length} employees: ${eligible.map((e) => e.name).join(", ")}`);
    }
    if (protectedTargets.length) {
      throw new Error(`Blocked: the ${PROTECTED_LABEL} account can't be deleted.${eligible.length ? ` The other ${eligible.length} selected employee${eligible.length === 1 ? "" : "s"} ${eligible.length === 1 ? "was" : "were"} removed.` : ""}`);
    }
  });
}

function upsertDay(rows: Attendance[], employee: Employee, date: string, change: Omit<Attendance, "id" | "employeeId" | "date" | "branchId">) {
  const existing = rows.find((a) => a.employeeId === employee.id && a.date === date);
  const record: Attendance = { id: existing?.id ?? newId("att"), employeeId: employee.id, date, branchId: existing?.branchId ?? employee.branchId, ...change };
  return existing ? rows.map((a) => (a === existing ? record : a)) : [record, ...rows];
}

export async function markAttendance(employeeId: string, date: string, status: AttendanceStatus, checkIn?: string, checkOut?: string) {
  assertManage();
  if (!YMD.test(date)) throw new Error("Blocked: pick a date");
  if (date > todayIst()) throw new Error("Blocked: attendance can't be marked for a future date");
  return serial(async () => {
    const employee = (await latest(employees)).find((e) => e.id === employeeId);
    if (!employee) throw new Error("Employee not found");
    if (employee.status === "exited") throw new Error(`Blocked: ${employee.name} has exited`);
    const timed = status === "present" || status === "half_day";
    if (timed && !checkIn) throw new Error("Blocked: enter the check-in time");
    if (checkIn && !TIME.test(checkIn)) throw new Error("Blocked: check-in must be HH:MM");
    if (checkOut && !TIME.test(checkOut)) throw new Error("Blocked: check-out must be HH:MM");
    if (checkIn && checkOut && checkOut <= checkIn) throw new Error("Blocked: check-out must be after check-in");
    const rows = await latest(attendance);
    await attendance.replaceAll(
      upsertDay(rows, employee, date, {
        status,
        checkIn: timed ? checkIn : undefined,
        checkOut: timed ? checkOut || undefined : undefined,
        marked: { at: new Date().toISOString(), by: getActor().name },
      }),
    );
  });
}

export function decideLeave(id: string, approve: boolean, note: string) {
  assertManage();
  return serial(async () => {
    const request = (await latest(leaveRequests)).find((l) => l.id === id);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== "pending") throw new Error(`Blocked: this request is already ${request.status}`);
    if (!approve && !note.trim()) throw new Error("Blocked: add a note explaining the rejection");
    const actor = getActor().name;
    const at = new Date().toISOString();
    if (approve) {
      const employee = (await latest(employees)).find((e) => e.id === request.employeeId);
      if (!employee) throw new Error("Employee not found");
      let rows = await latest(attendance);
      for (const date of leaveDays(request)) rows = upsertDay(rows, employee, date, { status: "leave", marked: { at, by: actor } });
      await attendance.replaceAll(rows);
    }
    return modify(leaveRequests, id, (l): LeaveRequest => ({ ...l, status: approve ? "approved" : "rejected", decided: { at, by: actor, note: note.trim() } }));
  });
}

export function setShift(rosterId: string, employeeId: string, day: number, shift: Shift) {
  assertManage();
  if (day < 0 || day > 6) throw new Error("Blocked: day must be Monday to Sunday");
  return serial(() =>
    modify(rosters, rosterId, (r) => {
      const exists = r.shifts.some((s) => s.employeeId === employeeId && s.day === day);
      return {
        ...r,
        shifts: exists ? r.shifts.map((s) => (s.employeeId === employeeId && s.day === day ? { ...s, shift } : s)) : [...r.shifts, { employeeId, day, shift }],
      };
    }),
  );
}

/** Starts a branch's roster for a week, copying the latest earlier week (or a default pattern). */
export function createRoster(branchId: string, weekStart: string) {
  assertManage();
  return serial(async () => {
    const all = await latest(rosters);
    if (all.some((r) => r.branchId === branchId && r.weekStart === weekStart)) throw new Error("Blocked: this week already has a roster");
    const staff = (await latest(employees)).filter((e) => e.branchId === branchId && onRollOn(e, addDays(weekStart, 6)));
    const previous = all.filter((r) => r.branchId === branchId && r.weekStart < weekStart).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    const shifts = staff.flatMap((e) =>
      WEEKDAYS.map((_, day) => ({
        employeeId: e.id,
        day,
        shift: previous?.shifts.find((s) => s.employeeId === e.id && s.day === day)?.shift ?? (day === 6 ? "off" : "general"),
      })),
    );
    const roster: Roster = { id: newId("ros"), branchId, weekStart, shifts };
    await rosters.replaceAll([roster, ...all]);
    return roster;
  });
}

// ---- payroll input -------------------------------------------------------------------

export interface PayrollRow {
  employee: Employee;
  /** Mon–Sat days in the month, excluding HOLIDAYS (and days before joining). */
  workingDays: number;
  present: number;
  halfDays: number;
  absent: number;
  leave: Record<LeaveType, number>;
  weekOffs: number;
  /** Working days already past with no attendance record. */
  notMarked: number;
  lateMarks: number;
  salesClosed: number;
  incentiveRupees: number;
}

/**
 * The payroll input sheet for a month ("YYYY-MM"): attendance counts, leave by type, late marks
 * and the sales incentive (see INCENTIVE_PER_SALE_RUPEES). Leave days are split by type using the
 * approved leave requests; leave marked directly on attendance without a request counts as casual.
 * Salary structure and statutory deductions are out of scope.
 */
export function payrollInput(month: string, data: { employees: Employee[]; attendance: Attendance[]; leaves: LeaveRequest[]; vehicles: Vehicle[] }, today = todayIst()): PayrollRow[] {
  const dates = monthDates(month);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const approved = data.leaves.filter((l) => l.status === "approved");

  return data.employees
    .filter((e) => !attendanceExempt(e) && e.joinedAt <= last && (e.status !== "exited" || data.attendance.some((a) => a.employeeId === e.id && a.date >= first && a.date <= last)))
    .map((employee) => {
      const days = dates.filter((d) => d >= employee.joinedAt);
      const records = new Map(data.attendance.filter((a) => a.employeeId === employee.id && a.date.startsWith(month)).map((a) => [a.date, a]));
      const row: PayrollRow = {
        employee,
        workingDays: days.filter((d) => !isWeeklyOff(d)).length,
        present: 0,
        halfDays: 0,
        absent: 0,
        leave: { casual: 0, sick: 0, earned: 0 },
        weekOffs: 0,
        notMarked: 0,
        lateMarks: 0,
        salesClosed: 0,
        incentiveRupees: 0,
      };
      for (const d of days) {
        const a = records.get(d);
        if (!a) {
          if (!isWeeklyOff(d) && d <= today && employee.status !== "exited") row.notMarked++;
          continue;
        }
        if (isLate(a)) row.lateMarks++;
        if (a.status === "present") row.present++;
        else if (a.status === "half_day") row.halfDays++;
        else if (a.status === "absent") row.absent++;
        else if (a.status === "week_off") row.weekOffs++;
        else {
          const req = approved.find((l) => l.employeeId === employee.id && l.from <= d && d <= l.to);
          row.leave[req?.type ?? "casual"]++;
        }
      }
      if (isSalesStaff(employee)) {
        row.salesClosed = data.vehicles.filter((v) => v.sale?.status === "sold" && v.sale.by === employee.name && v.sale.soldAt && istDate(v.sale.soldAt).startsWith(month)).length;
        row.incentiveRupees = row.salesClosed * INCENTIVE_PER_SALE_RUPEES;
      }
      return row;
    })
    .sort((a, b) => a.employee.branchId.localeCompare(b.employee.branchId) || a.employee.name.localeCompare(b.employee.name));
}

export function payrollCsv(month: string, rows: PayrollRow[], branchName: (id: string) => string) {
  const header = [
    "Employee ID",
    "Name",
    "Job title",
    "Branch",
    "Salary band",
    "Month",
    "Working days",
    "Present",
    "Half days",
    "Absent",
    "Casual leave",
    "Sick leave",
    "Earned leave",
    "Week offs",
    "Not marked",
    "Late marks",
    "Sales closed",
    "Incentive (INR)",
  ];
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.map((r) =>
    [
      r.employee.id,
      r.employee.name,
      r.employee.role,
      branchName(r.employee.branchId),
      r.employee.salaryBand ?? "",
      month,
      r.workingDays,
      r.present,
      r.halfDays,
      r.absent,
      r.leave.casual,
      r.leave.sick,
      r.leave.earned,
      r.weekOffs,
      r.notMarked,
      r.lateMarks,
      r.salesClosed,
      r.incentiveRupees,
    ]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

/**
 * Change the name of whoever holds a system role (Team & roles screen). Updates the linked
 * employee record, so the new name shows everywhere; past records keep the old name.
 */
export async function renameRoleHolder(role: Role, name: string) {
  assertCan("settings.manage");
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2) throw new Error("Enter a name (at least 2 letters)");
  if (clean.length > 60) throw new Error("Name is too long (60 characters max)");
  return serial(async () => {
    const holder = (await latest(employees)).find((e) => e.rbacRole === role && e.status !== "exited");
    if (!holder) throw new Error("No active employee holds this role. Add them in Employees first.");
    return modify(employees, holder.id, (e) => ({ ...e, name: clean }));
  });
}
