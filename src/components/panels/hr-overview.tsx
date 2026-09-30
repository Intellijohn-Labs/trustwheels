"use client";

import { useMemo } from "react";
import { Hourglass, LogOut, Plane, UserCheck, Users } from "lucide-react";
import { isLate, leaveRequests } from "@/lib/hr";
import { KpiCard, KpiGrid, Panel } from "../ui";
import { useAttendanceLines } from "./attendance-panel";
import { useToday } from "./hr-bits";

/** Today's headline HR numbers, shared by the HR dashboard and the compact overview. */
export function useHrStats() {
  const today = useToday();
  const { lines, ready } = useAttendanceLines(today);
  const { items: leaves, ready: leavesReady } = leaveRequests.useItems();
  return useMemo(() => {
    const expected = lines.filter((l) => l.employee.status !== "exited");
    const present = expected.filter((l) => l.record?.status === "present" || l.record?.status === "half_day");
    const working = expected.filter((l) => l.record?.status !== "week_off");
    return {
      today,
      ready: ready && leavesReady,
      lines,
      headcount: expected.length,
      onNotice: expected.filter((l) => l.employee.status === "on_notice").length,
      present: present.length,
      working: working.length,
      presentPct: working.length ? Math.round((present.length / working.length) * 100) : 0,
      onLeave: expected.filter((l) => l.record?.status === "leave").length,
      absent: expected.filter((l) => l.record?.status === "absent").length,
      notMarked: working.filter((l) => !l.record).length,
      late: present.filter((l) => isLate(l.record!)).length,
      pending: leaves.filter((l) => l.status === "pending"),
    };
  }, [today, lines, ready, leaves, leavesReady]);
}

/**
 * Compact, read-only HR summary (headcount, present today %, pending leave, on notice)
 * for embedding in other dashboards, e.g. the Managing Partner's.
 */
export function HrOverview({ title = "People", href = "/hr/attendance" }: { title?: string; href?: string }) {
  const s = useHrStats();
  return (
    <Panel title={title} description="Attendance counts people on the roll today, excluding week offs.">
      <KpiGrid>
        <KpiCard label="Headcount" value={s.ready ? s.headcount : "–"} hint="Active and on notice" icon={<Users />} href="/hr/employees" />
        <KpiCard label="Present today" value={s.ready ? `${s.presentPct}%` : "–"} hint={`${s.present} of ${s.working} in`} icon={<UserCheck />} href={href} />
        <KpiCard
          label="Pending leave"
          value={s.ready ? s.pending.length : "–"}
          hint={s.pending.length ? "Awaiting HR decision" : "Nothing waiting"}
          icon={s.pending.length ? <Hourglass /> : <Plane />}
          tone={s.pending.length ? "warn" : "neutral"}
          href="/hr/leave"
        />
        <KpiCard label="On notice" value={s.ready ? s.onNotice : "–"} hint="Serving notice period" icon={<LogOut />} href="/hr/employees" />
      </KpiGrid>
    </Panel>
  );
}

export default HrOverview;
