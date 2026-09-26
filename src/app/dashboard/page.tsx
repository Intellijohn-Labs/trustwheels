"use client";

import type { ComponentType } from "react";
import type { Role } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import ProprietorDashboard from "@/components/dashboards/proprietor";
import PartnerDashboard from "@/components/dashboards/partner";
import BranchManagerDashboard from "@/components/dashboards/branch-manager";
import BranchAccountantDashboard from "@/components/dashboards/branch-accountant";
import HubAdminDashboard from "@/components/dashboards/hub-admin";
import SupervisorDashboard from "@/components/dashboards/supervisor";
import GateManagerDashboard from "@/components/dashboards/gate-manager";
import SalesExecutiveDashboard from "@/components/dashboards/sales-executive";
import TelecallerDashboard from "@/components/dashboards/telecaller";
import CentralAccountantDashboard from "@/components/dashboards/central-accountant";
import HrDashboard from "@/components/dashboards/hr";

/** Each role lands on its own dashboard: KPIs and work queues for that role only. */
const DASHBOARDS: Record<Role, ComponentType> = {
  proprietor: ProprietorDashboard,
  partner: PartnerDashboard,
  branch_manager: BranchManagerDashboard,
  branch_accountant: BranchAccountantDashboard,
  hub_admin: HubAdminDashboard,
  supervisor: SupervisorDashboard,
  gate_manager: GateManagerDashboard,
  sales_executive: SalesExecutiveDashboard,
  telecaller: TelecallerDashboard,
  central_accountant: CentralAccountantDashboard,
  hr: HrDashboard,
};

export default function DashboardPage() {
  const { role } = useRole();
  const Dashboard = DASHBOARDS[role];
  return <Dashboard />;
}
