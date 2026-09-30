"use client";

import { defineCollection, newId } from "./collections";
import { HOLIDAYS } from "./masters";
import { can, type PanelModule, type Role } from "./rbac";
import { assertCan, currentRole, getActor } from "./session";
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
  branchId: string;
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

// ---- deterministic seed --------------------------------------------------------------

/** FNV-1a hash -> [0, 1). Keeps the demo seed stable between reloads and screenshots. */
function rand(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // murmur3 finaliser, so keys that differ only in the last character don't land close together
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type SeedRow = [name: string, role: string, branchId: string, reportingTo: string, joinedAt: string, band: string, rbacRole?: Role, status?: EmployeeStatus];

const SEED_ROWS: SeedRow[] = [
  ["Anoop", "Managing Partner", "ang", "", "2012-04-01", "Owner", "managing_partner"],
  ["Mathew Joseph", "Partner", "b1", "e-01", "2015-06-15", "Partner", "partner"],
  ["Jithin Varghese", "Branch Manager", "b1", "e-01", "2017-03-10", "M2", "branch_manager"],
  ["Divya Menon", "Branch Accountant", "b1", "e-03", "2019-07-01", "S3", "branch_accountant"],
  ["Rahul Nair", "Hub Administrator", "ang", "e-07", "2018-11-05", "S3", "hub_admin"],
  ["Biju Paul", "Reconditioning Supervisor", "ang", "e-07", "2016-02-20", "S3", "supervisor"],
  ["Sanjay Pillai", "Hub Manager (Gatekeeper)", "ang", "e-01", "2014-09-01", "M3", "gate_manager"],
  ["Aswathy Raj", "Sales Executive", "ang", "e-07", "2021-01-18", "S2", "sales_executive"],
  ["Fathima Beevi", "Telecaller", "ang", "e-11", "2022-08-08", "S1", "telecaller"],
  ["Lakshmi Iyer", "Central Accountant", "ang", "e-01", "2016-05-02", "M2", "central_accountant"],
  ["Reshma George", "HR / Admin Executive", "ang", "e-01", "2020-10-12", "M1", "hr"],
  ["Shibu Kuriakose", "Rider", "b1", "e-03", "2020-01-06", "W2"],
  ["Arun Das", "Rider", "b2", "e-14", "2021-04-12", "W2"],
  ["Joby Mathew", "Branch Manager", "b2", "e-01", "2018-06-04", "M2"],
  ["Nikhil Suresh", "Rider", "b3", "e-16", "2023-02-01", "W1"],
  ["Vineeth Kumar", "Branch Manager", "b3", "e-01", "2019-09-16", "M2"],
  ["Sajan Thomas", "Reconditioning Supervisor", "ang", "e-07", "2019-03-25", "S3"],
  ["Manoj Pappachan", "Mechanic", "ang", "e-06", "2017-08-14", "W3"],
  ["Salim Ahammed", "Mechanic", "ang", "e-06", "2022-05-09", "W2"],
  ["Jisha Antony", "Sales Executive", "b2", "e-14", "2023-06-19", "S1"],
  ["Arjun Menon", "Sales Executive", "b4", "e-22", "2024-01-08", "S1"],
  ["Prasanth Nair", "Branch In-charge", "b4", "e-01", "2020-07-20", "M1"],
  ["Sneha Joseph", "Telecaller", "ang", "e-11", "2023-11-13", "S1", undefined, "on_notice"],
  ["Deepak Raj", "Sales Executive", "b5", "e-25", "2024-03-04", "S1"],
  ["Anjali Krishnan", "Branch In-charge", "b5", "e-01", "2021-12-01", "M1"],
  ["Rajesh Kumar", "Mechanic", "ang", "e-06", "2019-01-14", "W2", undefined, "exited"],
];

function seedEmployees(): Employee[] {
  return SEED_ROWS.map(([name, role, branchId, reportingTo, joinedAt, band, rbacRole, status], i) => {
    const id = `e-${String(i + 1).padStart(2, "0")}`;
    const phone = `9${String(Math.floor(rand(`${id}:phone`) * 1e9)).padStart(9, "0")}`;
    return {
      id,
      name,
      role,
      rbacRole,
      branchId,
      phone,
      whatsapp: i % 5 === 3 ? `9${String(Math.floor(rand(`${id}:wa`) * 1e9)).padStart(9, "0")}` : phone,
      email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ").slice(-1)[0].toLowerCase()}@trustwheels.in`,
      joinedAt,
      reportingTo,
      status: status ?? "active",
      salaryBand: band,
    };
  });
}

function seedLeaves(): LeaveRequest[] {
  const today = todayIst();
  const at = (d: string, t = "10:15") => new Date(`${d}T${t}:00+05:30`).toISOString();
  const monthStart = `${today.slice(0, 8)}01`;
  const hr = "Reshma George";
  return [
    {
      id: "lv-01",
      employeeId: "e-20",
      from: addDays(today, 3),
      to: addDays(today, 4),
      type: "casual",
      reason: "Sister's wedding at Thodupuzha",
      status: "pending",
      requestedAt: at(addDays(today, -1)),
    },
    {
      id: "lv-02",
      employeeId: "e-18",
      from: addDays(today, 7),
      to: addDays(today, 11),
      type: "earned",
      reason: "Family trip to Velankanni",
      status: "pending",
      requestedAt: at(addDays(today, -2), "16:40"),
    },
    {
      id: "lv-03",
      employeeId: "e-13",
      from: addDays(today, 2),
      to: addDays(today, 2),
      type: "casual",
      reason: "Bank visit for house loan documents",
      status: "pending",
      requestedAt: at(today, "09:05"),
    },
    {
      id: "lv-04",
      employeeId: "e-19",
      from: addDays(today, -1),
      to: today,
      type: "sick",
      reason: "Viral fever, doctor's certificate attached",
      status: "approved",
      requestedAt: at(addDays(today, -1), "08:20"),
      decided: { at: at(addDays(today, -1), "09:10"), by: hr, note: "Get well soon" },
    },
    {
      id: "lv-05",
      employeeId: "e-04",
      from: addDays(monthStart, 3),
      to: addDays(monthStart, 5),
      type: "earned",
      reason: "Housewarming at Muvattupuzha",
      status: "approved",
      requestedAt: at(addDays(monthStart, -6)),
      decided: { at: at(addDays(monthStart, -5)), by: hr, note: "Approved, Jithin to cover purchases" },
    },
    {
      id: "lv-06",
      employeeId: "e-21",
      from: addDays(today, 1),
      to: addDays(today, 1),
      type: "casual",
      reason: "Personal work",
      status: "rejected",
      requestedAt: at(addDays(today, -3)),
      decided: { at: at(addDays(today, -2), "11:30"), by: hr, note: "Month-end sales push, please pick another day" },
    },
  ];
}

function seedAttendance(): Attendance[] {
  const today = todayIst();
  const employees = seedEmployees();
  const leaves = seedLeaves().filter((l) => l.status === "approved");
  const rows: Attendance[] = [];
  for (const date of datesBetween(`${today.slice(0, 8)}01`, today)) {
    for (const e of employees) {
      if (!onRollOn(e, date)) continue;
      const r = rand(`${e.id}:${date}`);
      const base = { id: `att-${e.id}-${date}`, employeeId: e.id, date, branchId: e.branchId };
      if (isWeeklyOff(date)) {
        rows.push({ ...base, status: "week_off" });
        continue;
      }
      if (leaves.some((l) => l.employeeId === e.id && l.from <= date && date <= l.to)) {
        rows.push({ ...base, status: "leave" });
        continue;
      }
      // Today: a few people haven't been marked yet, nobody has checked out.
      if (date === today && r > 0.93) continue;
      if (r < 0.04) {
        rows.push({ ...base, status: "absent" });
        continue;
      }
      const late = rand(`${e.id}:${date}:late`) > 0.86;
      const inMin = late ? 9 * 60 + 31 + Math.floor(rand(`${e.id}:${date}:in`) * 40) : 8 * 60 + 45 + Math.floor(rand(`${e.id}:${date}:in`) * 44);
      const half = r < 0.07;
      const outMin = half ? 13 * 60 + 30 + Math.floor(rand(`${e.id}:${date}:out`) * 30) : 18 * 60 + Math.floor(rand(`${e.id}:${date}:out`) * 50);
      rows.push({ ...base, status: half ? "half_day" : "present", checkIn: hhmm(inMin), checkOut: date === today ? undefined : hhmm(outMin) });
    }
  }
  return rows;
}

function defaultShift(employeeId: string, weekStart: string, day: number): Shift {
  if (day === 6) return "off";
  const r = rand(`${employeeId}:${weekStart}:${day}`);
  return r < 0.2 ? "morning" : r < 0.8 ? "general" : "evening";
}

function seedRosters(): Roster[] {
  const weekStart = mondayOf(todayIst());
  const employees = seedEmployees().filter((e) => onRollOn(e, weekStart));
  const branches = [...new Set(employees.map((e) => e.branchId))];
  return branches.map((branchId) => ({
    id: `ros-${branchId}-${weekStart}`,
    branchId,
    weekStart,
    shifts: employees.filter((e) => e.branchId === branchId).flatMap((e) => WEEKDAYS.map((_, day) => ({ employeeId: e.id, day, shift: defaultShift(e.id, weekStart, day) }))),
  }));
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
  if (e.email && !EMAIL.test(e.email)) errors.email = "Enter a valid email";
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

export function addEmployee(input: EmployeeInput) {
  assertManage();
  const data = clean(input);
  return serial(async () => {
    const all = await latest(employees);
    if (data.status === "active" && activeEmployeeCount(all) >= MAX_EMPLOYEES) {
      throw new Error(`Blocked: maximum employee limit reached (${MAX_EMPLOYEES}/${MAX_EMPLOYEES}). Deactivate or delete an existing employee first.`);
    }
    const next = all.reduce((max, e) => Math.max(max, Number(e.id.replace(/\D/g, "")) || 0), 0) + 1;
    const employee: Employee = { ...data, id: `e-${String(next).padStart(2, "0")}` };
    await employees.replaceAll([employee, ...all]);
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
    if (data.status === "active" && current?.status !== "active" && activeEmployeeCount(all) >= MAX_EMPLOYEES) {
      throw new Error(`Blocked: maximum employee limit reached (${MAX_EMPLOYEES}/${MAX_EMPLOYEES}). Deactivate or delete an existing employee first.`);
    }
    return modify(employees, id, (e) => ({ ...e, ...data, id }));
  });
}

/** Permanently remove one employee record. Managing Partner only; every other role never sees the option. */
export function deleteEmployee(id: string) {
  assertCan("hr.delete");
  return serial(async () => {
    const all = await latest(employees);
    if (!all.some((e) => e.id === id)) throw new Error("Employee not found");
    await employees.remove(id);
  });
}

/** Permanently remove several employee records in one write, e.g. from a bulk selection. */
export function deleteEmployees(ids: string[]) {
  assertCan("hr.delete");
  return serial(async () => {
    await employees.removeMany(ids);
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
 * Whether `role` may sign in right now, i.e. an active employee is actually registered to hold
 * it. Managing Partner always passes - deactivating or deleting every Managing Partner record
 * must never be able to lock the whole system out. Every other role needs a matching, active
 * `rbacRole` holder in the employee master, so removing someone from Employees & Access takes
 * their login away immediately, not just their in-app permissions.
 */
export async function isRoleLoginAllowed(role: Role): Promise<boolean> {
  if (role === "managing_partner") return true;
  const all = await latest(employees);
  return all.some((e) => e.rbacRole === role && e.status === "active");
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
