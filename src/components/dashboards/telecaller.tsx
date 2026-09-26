"use client";

import { AlarmClock, PhoneCall, PhoneIncoming, ThumbsUp } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { CallPerformance, TodaysCallList } from "@/components/panels/call-list";
import { useRole } from "@/lib/role-context";
import { callStatsToday, callTasks, isOverdueCallback, todaysCalls, turnaround } from "@/lib/calls";
import { InboundCallTable, NewCallButton } from "@/components/panels/inbound-call";
import { useNow } from "@/lib/use-now";

export default function TelecallerDashboard() {
  const { user, roleDef } = useRole();
  const { items } = callTasks.useItems();
  const now = useNow(30_000);
  const due = todaysCalls(items, now).length;
  const overdue = items.filter((t) => isOverdueCallback(t, now) || turnaround(t, now)?.state === "late").length;
  const mine = callStatsToday(items, now).rows.find((r) => r.person === user.name) ?? { made: 0, connected: 0, interested: 0 };

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} actions={<NewCallButton size="lg" />} />
      <KpiGrid>
        <KpiCard label="Calls due today" value={due} icon={<PhoneIncoming />} href="/calls" hint="Due, carried over and callbacks" />
        <KpiCard
          label="Late / overdue calls"
          value={overdue}
          tone={overdue ? "danger" : "neutral"}
          icon={<AlarmClock />}
          href="/calls"
          hint={overdue ? "Customers waiting for our call" : "Everything on time"}
        />
        <KpiCard label="Calls made today" value={mine.made} icon={<PhoneCall />} hint={`${mine.connected} connected`} />
        <KpiCard label="Interested today" value={mine.interested} icon={<ThumbsUp />} hint="Handed to sales" />
      </KpiGrid>
      <InboundCallTable limit={6} />
      <TodaysCallList limit={10} />
      <CallPerformance />
    </div>
  );
}
