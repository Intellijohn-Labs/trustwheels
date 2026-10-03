"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { findRoute } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { PageHeader, Segmented } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";
import { AttendanceLogPanel } from "@/components/panels/attendance-log";
import { AttendanceSheetPanel } from "@/components/panels/attendance-sheet";

type View = "daily" | "sheet";

export default function AttendanceLogPage() {
  const [view, setView] = useState<View>("daily");
  const { role } = useRole();

  // Checked against the literal role, not the route's `attendance.view` permission: that
  // permission can be granted to another role via an employee's per-employee panel override
  // (Employees & Access -> Panel access), but this page must stay reachable by the Managing
  // Partner only, override or not.
  if (role !== "managing_partner") return <Forbidden route={findRoute("/attendance-log")!} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance log"
        icon={<MapPin className="size-6 text-brand" />}
        description="GPS-verified staff check-ins, with a live link to where each punch happened."
        actions={
          <div className="w-full max-w-xs">
            <Segmented
              name="Attendance view"
              value={view}
              onChange={setView}
              options={[
                { value: "daily", label: "Daily Log" },
                { value: "sheet", label: "Attendance Sheet" },
              ]}
            />
          </div>
        }
      />
      {view === "daily" ? <AttendanceLogPanel showFilters /> : <AttendanceSheetPanel />}
    </div>
  );
}
