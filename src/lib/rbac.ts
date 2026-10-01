/*
 * Role-based access control. One table of roles -> permissions, one table of routes -> permissions.
 * The sidebar, the route guard, action buttons and the store's own checks all read from here,
 * so a role's rights are defined in exactly one place.
 */

export type Role =
  | "managing_partner"
  | "partner"
  | "branch_manager"
  | "branch_accountant"
  | "hub_admin"
  | "supervisor"
  | "gate_manager"
  | "sales_executive"
  | "telecaller"
  | "central_accountant"
  | "hr";

export const PERMISSIONS = [
  "stock.view",
  "stock.create",
  "stock.verify",
  "stock.delete",
  "transit.view",
  "transit.dispatch",
  "hub.receive",
  "recon.view",
  "recon.manage",
  "gate.view",
  "gate.approve",
  "sales.view",
  "sale.book",
  "sale.docs",
  "delivery.view",
  "delivery.transfer",
  "delivery.release",
  "delivery.handover",
  "leads.view",
  "leads.manage",
  "leads.delete",
  "calls.view",
  "calls.manage",
  "calls.delete",
  "payments.view",
  "purchase.enter",
  "payout.approve",
  "fees.view",
  "fees.manage",
  "funds.view",
  "funds.delete",
  "accounts.view",
  "accounts.manage",
  "reports.view",
  "escalations.view",
  "attendance.view",
  "staff.manage",
  "audit.view",
  "audit.delete",
  "hr.view",
  "hr.manage",
  "hr.delete",
  "documents.delete",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface RoleDef {
  label: string;
  description: string;
  permissions: readonly Permission[];
  /** Branch ids whose data this role may see; "all" for group-wide roles. */
  scope: "all" | string[];
}

export const ROLES: Record<Role, RoleDef> = {
  managing_partner: {
    label: "Managing Partner",
    description: "Master admin. Every branch, every module; HR is view-only.",
    // Full access everywhere except editing HR records (the Managing Partner gets the HR overview).
    permissions: PERMISSIONS.filter((p) => p !== "hr.manage"),
    scope: "all",
  },
  partner: {
    label: "Partner",
    description: "Branch admin / investor for the assigned branches.",
    permissions: ["stock.view", "stock.create", "sales.view", "funds.view", "reports.view"],
    scope: ["b1", "b2"],
  },
  branch_manager: {
    label: "Branch Manager",
    description: "Acquisition, documents, dispatch to Angamaly, transit tracking.",
    permissions: ["stock.view", "stock.create", "stock.verify", "transit.view", "transit.dispatch"],
    scope: ["b1", "b3"],
  },
  branch_accountant: {
    label: "Branch Accountant",
    description: "Purchase values, seller payments, amounts due from Angamaly.",
    permissions: ["stock.view", "stock.create", "payments.view", "purchase.enter"],
    scope: ["b1"],
  },
  hub_admin: {
    label: "Administration (Angamaly)",
    description: "Receives vehicles, checks identity against dispatch, books into stock.",
    permissions: ["stock.view", "stock.create", "stock.verify", "transit.view", "hub.receive"],
    scope: "all",
  },
  supervisor: {
    label: "Supervisor (Reconditioning)",
    description: "Job cards, costing, repair photos, completion sign-off, RED count.",
    permissions: ["recon.view", "recon.manage"],
    scope: "all",
  },
  gate_manager: {
    label: "Manager (Angamaly Gatekeeper)",
    description: "Quality gate, final delivery release, SLA and Code Red monitoring.",
    permissions: [
      "stock.view",
      "stock.create",
      "stock.verify",
      "transit.view",
      "recon.view",
      "gate.view",
      "gate.approve",
      "sales.view",
      "delivery.view",
      "delivery.transfer",
      "delivery.release",
      "escalations.view",
    ],
    scope: "all",
  },
  sales_executive: {
    label: "Sales Executive",
    description: "Enquiries, Day 2/3/4 follow-ups, bookings and booking documents.",
    permissions: ["stock.view", "stock.create", "sales.view", "sale.book", "sale.docs", "delivery.view", "delivery.transfer", "delivery.handover", "leads.view", "leads.manage"],
    scope: "all",
  },
  telecaller: {
    label: "Telecaller",
    description: "Outbound call lists, dispositions, callbacks, campaigns.",
    permissions: ["calls.view", "calls.manage"],
    scope: "all",
  },
  central_accountant: {
    label: "Central Accountant",
    description: "Seller payouts, RTO fees, and the customer-facing sales accounts ledger.",
    permissions: ["stock.view", "stock.create", "payments.view", "payout.approve", "fees.view", "fees.manage", "accounts.view", "accounts.manage"],
    scope: "all",
  },
  hr: {
    label: "HR / Admin",
    description: "Employees, attendance, leave, shift roster, payroll input.",
    permissions: ["hr.view", "hr.manage", "settings.manage"],
    scope: "all",
  },
};

export const ROLE_ORDER = Object.keys(ROLES) as Role[];

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  base: string; // branch id where the person sits
}

/**
 * Per-role structural defaults (a stable id for non-name references, a default home branch) -
 * NOT display names. `.name` is always "Unassigned": the real display name for whoever holds a
 * role comes from the active `hr_employees` record via roleName()/nameOf() (lib/user-names.ts),
 * never from here. Still used for id/base by session.ts's getActor(), attendance-sheet.tsx's GPS
 * user id, and the dev-only role switcher's login role list.
 */
export const DEMO_USERS: Record<Role, DemoUser> = {
  managing_partner: { id: "u-prop", name: "Unassigned", role: "managing_partner", base: "ang" },
  partner: { id: "u-partner", name: "Unassigned", role: "partner", base: "b1" },
  branch_manager: { id: "u-bm", name: "Unassigned", role: "branch_manager", base: "b1" },
  branch_accountant: { id: "u-bacc", name: "Unassigned", role: "branch_accountant", base: "b1" },
  hub_admin: { id: "u-hub", name: "Unassigned", role: "hub_admin", base: "ang" },
  supervisor: { id: "u-sup", name: "Unassigned", role: "supervisor", base: "ang" },
  gate_manager: { id: "u-gate", name: "Unassigned", role: "gate_manager", base: "ang" },
  sales_executive: { id: "u-sales", name: "Unassigned", role: "sales_executive", base: "ang" },
  telecaller: { id: "u-tele", name: "Unassigned", role: "telecaller", base: "ang" },
  central_accountant: { id: "u-cacc", name: "Unassigned", role: "central_accountant", base: "ang" },
  hr: { id: "u-hr", name: "Unassigned", role: "hr", base: "ang" },
};

export function can(role: Role, permission: Permission) {
  return ROLES[role].permissions.includes(permission);
}

export function inScope(role: Role, branchId: string) {
  const scope = ROLES[role].scope;
  return scope === "all" || scope.includes(branchId);
}

/*
 * Per-employee panel overrides (Employee & Access page). Each module maps to the one permission
 * that gates its whole section - blocking that permission is enough to hide the section from the
 * sidebar and refuse the route, without having to enumerate every finer-grained action permission
 * the role also holds for that area (e.g. stock.create, recon.manage stay with the role).
 */
export const PANEL_MODULES = [
  { key: "stock", label: "Stock", permission: "stock.view" },
  { key: "recon", label: "Reconditioning", permission: "recon.view" },
  { key: "sales", label: "Sales", permission: "sales.view" },
  { key: "accounts", label: "Accounts", permission: "accounts.view" },
  { key: "attendance", label: "Attendance", permission: "attendance.view" },
] as const satisfies { key: string; label: string; permission: Permission }[];

export type PanelModule = (typeof PANEL_MODULES)[number]["key"];

/** Which of the 5 panel modules a role gets by default, i.e. before any per-employee override. */
export function roleDefaultPanels(role?: Role): PanelModule[] {
  if (!role) return [];
  return PANEL_MODULES.filter((m) => can(role, m.permission)).map((m) => m.key);
}

/**
 * A role's permissions, overridden by an employee's explicit panel picks when they have any:
 * a module they toggled ON is granted even if their base role never had it, and a module they
 * toggled OFF is withheld even if the role normally includes it. `undefined` (never customized)
 * falls back to the role's own permission set untouched.
 */
export function effectivePermissions(role: Role, allowedPanels?: PanelModule[]): readonly Permission[] {
  const base = ROLES[role].permissions;
  if (!allowedPanels) return base;
  const blocked = new Set<Permission>(PANEL_MODULES.filter((m) => !allowedPanels.includes(m.key)).map((m) => m.permission));
  const granted = PANEL_MODULES.filter((m) => allowedPanels.includes(m.key)).map((m) => m.permission);
  return [...new Set([...base.filter((p) => !blocked.has(p)), ...granted])];
}

// ---- routes ------------------------------------------------------------------

export type NavGroup = "Overview" | "Stock & hub" | "Sales" | "Calls" | "Finance" | "People" | "Settings";

export interface RouteDef {
  path: string;
  label: string;
  group: NavGroup;
  /** Lucide icon name, resolved in the sidebar. */
  icon: string;
  /** The role needs at least one of these to open the route. Empty = everyone signed in. */
  anyOf: Permission[];
  /** Hidden routes are guarded but not listed in the sidebar (e.g. detail pages). */
  hidden?: boolean;
  pattern?: RegExp;
}

export const ROUTES: RouteDef[] = [
  { path: "/dashboard", label: "Dashboard", group: "Overview", icon: "LayoutDashboard", anyOf: [] },
  { path: "/escalations", label: "Escalations", group: "Overview", icon: "Siren", anyOf: ["escalations.view"] },
  { path: "/reports", label: "Reports", group: "Overview", icon: "ChartColumn", anyOf: ["reports.view"] },
  { path: "/attendance-log", label: "Attendance Log", group: "Overview", icon: "MapPin", anyOf: ["attendance.view"] },
  { path: "/employees", label: "Employees & Access", group: "Overview", icon: "Users", anyOf: ["staff.manage"] },
  { path: "/audit-logs", label: "Activity Log", group: "Overview", icon: "BookOpen", anyOf: ["audit.view"] },

  { path: "/stock", label: "All stock", group: "Stock & hub", icon: "LayoutList", anyOf: ["stock.view"] },
  { path: "/stock/new", label: "Add stock", group: "Stock & hub", icon: "Plus", anyOf: ["stock.create"] },
  { path: "/stock/[id]", label: "Vehicle", group: "Stock & hub", icon: "Bike", anyOf: ["stock.view", "recon.view"], hidden: true, pattern: /^\/stock\/(?!new$)[^/]+$/ },
  { path: "/overdue", label: "Verification", group: "Stock & hub", icon: "TriangleAlert", anyOf: ["stock.verify"] },
  { path: "/transit", label: "Transit", group: "Stock & hub", icon: "Truck", anyOf: ["transit.view"] },
  { path: "/receiving", label: "Receiving", group: "Stock & hub", icon: "PackageCheck", anyOf: ["hub.receive"] },
  { path: "/recon", label: "Reconditioning", group: "Stock & hub", icon: "Wrench", anyOf: ["recon.view"] },
  { path: "/quality-gate", label: "Quality gate", group: "Stock & hub", icon: "ShieldCheck", anyOf: ["gate.view"] },

  { path: "/verified", label: "Book & sell", group: "Sales", icon: "BadgeCheck", anyOf: ["sales.view"] },
  { path: "/enquiries", label: "Enquiries", group: "Sales", icon: "UserPlus", anyOf: ["leads.view"] },
  { path: "/deliveries", label: "Deliveries", group: "Sales", icon: "KeyRound", anyOf: ["delivery.view"] },
  { path: "/accounts", label: "Accounts", group: "Sales", icon: "Landmark", anyOf: ["accounts.view"] },

  { path: "/calls", label: "Call lists", group: "Calls", icon: "PhoneCall", anyOf: ["calls.view"] },
  { path: "/campaigns", label: "Campaigns", group: "Calls", icon: "Megaphone", anyOf: ["calls.view"] },

  { path: "/payments", label: "Seller payments", group: "Finance", icon: "Wallet", anyOf: ["payments.view"] },
  { path: "/fees", label: "RTO & transfer fees", group: "Finance", icon: "Landmark", anyOf: ["fees.view"] },
  { path: "/funds", label: "Funds & cash flow", group: "Finance", icon: "PiggyBank", anyOf: ["funds.view"] },

  { path: "/hr/employees", label: "Employees", group: "People", icon: "Users", anyOf: ["hr.view"] },
  { path: "/hr/attendance", label: "Attendance", group: "People", icon: "CalendarCheck", anyOf: ["hr.view"] },
  { path: "/hr/leave", label: "Leave requests", group: "People", icon: "Plane", anyOf: ["hr.view"] },
  { path: "/hr/roster", label: "Shift roster", group: "People", icon: "CalendarRange", anyOf: ["hr.view"] },
  { path: "/hr/payroll", label: "Payroll input", group: "People", icon: "FileSpreadsheet", anyOf: ["hr.view"] },
  // Settings live behind the gear button, not in the sidebar.
  { path: "/settings", label: "Settings", group: "Settings", icon: "Settings", anyOf: [], hidden: true },
  { path: "/team", label: "Team & roles", group: "Settings", icon: "UserCog", anyOf: ["settings.manage"], hidden: true },
  { path: "/branches", label: "Branches", group: "Settings", icon: "Building2", anyOf: ["settings.manage"], hidden: true },
];

// "Finance" and "People" are intentionally left out here: their routes still carry
// group: "Finance" / group: "People" for their own bookkeeping, but with no group in this
// list the sidebar never renders those section headers - the pages stay reachable (and
// permission-gated) via their own links/URLs. (HR's employee data also backs role-holder
// name resolution app-wide via role-context.tsx's NameSync, so lib/hr.ts stays untouched.)
export const NAV_GROUPS: NavGroup[] = ["Overview", "Stock & hub", "Sales", "Calls", "Settings"];

export function findRoute(pathname: string) {
  return ROUTES.find((r) => (r.pattern ? r.pattern.test(pathname) : r.path === pathname));
}

export function canOpen(role: Role, route: RouteDef) {
  return route.anyOf.length === 0 || route.anyOf.some((p) => can(role, p));
}

/** Roles that may open a route, for the 403 page. */
export function rolesFor(route: RouteDef) {
  return ROLE_ORDER.filter((r) => canOpen(r, route));
}
