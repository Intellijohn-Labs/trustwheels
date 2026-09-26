"use client";

import Link from "next/link";
import { Clock, Hourglass, Plane, UserCheck, Users } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader, Panel } from "@/components/ui";
import { AttendanceDayTable } from "@/components/panels/attendance-panel";
import { LeaveTable } from "@/components/panels/leave-panel";
import { useHrStats } from "@/components/panels/hr-overview";
import { longDate } from "@/components/panels/hr-bits";
import { useRole } from "@/lib/role-context";

export default function HrDashboard() {
  const { user, roleDef } = useRole();
  const s = useHrStats();
  const missing = s.lines.filter((l) => l.employee.status !== "exited" && (l.record?.status === "absent" || (!l.record && s.ready)));
  const dash = (n: number | string) => (s.ready ? n : "–");

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />

      <KpiGrid>
        <KpiCard label="Headcount" value={dash(s.headcount)} hint={s.onNotice ? `${s.onNotice} on notice` : "Active employees"} icon={<Users />} href="/hr/employees" />
        <KpiCard label="Present today" value={dash(s.present)} hint={`${s.presentPct}% of ${s.working} on duty`} icon={<UserCheck />} href="/hr/attendance" />
        <KpiCard label="On leave today" value={dash(s.onLeave)} hint="Approved leave" icon={<Plane />} href="/hr/leave" />
        <KpiCard
          label="Pending leave requests"
          value={dash(s.pending.length)}
          hint={s.pending.length ? "Awaiting your decision" : "Nothing waiting"}
          icon={<Hourglass />}
          tone={s.pending.length ? "warn" : "neutral"}
          href="/hr/leave"
        />
        <KpiCard label="Late today" value={dash(s.late)} hint="Checked in after 09:30" icon={<Clock />} href="/hr/attendance" />
      </KpiGrid>

      <Panel
        flush
        title="Pending leave requests"
        description="Approving marks the days as leave on attendance."
        actions={
          <Link href="/hr/leave" className="text-sm font-medium text-brand hover:underline">
            All requests
          </Link>
        }
      >
        <LeaveTable requests={[...s.pending].sort((a, b) => a.from.localeCompare(b.from))} compact empty="No leave requests are waiting." />
      </Panel>

      <Panel
        flush
        title="Today's absentees"
        description={`${longDate(s.today)} · absent or not yet marked`}
        actions={
          <Link href="/hr/attendance" className="text-sm font-medium text-brand hover:underline">
            Attendance
          </Link>
        }
      >
        <AttendanceDayTable lines={missing} date={s.today} showBranch empty="Everyone on duty today is marked in." />
      </Panel>
    </div>
  );
}
