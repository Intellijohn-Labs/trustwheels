"use client";

import { FileWarning, PhoneCall, Siren, UserPlus } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader } from "@/components/ui";
import { FollowUpsTable } from "@/components/panels/follow-ups";
import { DeliveriesNeedingAction } from "@/components/panels/deliveries-table";
import { useRole } from "@/lib/role-context";
import { useScopedLeads, dueFollowUps, overdueFollowUps } from "@/lib/leads";
import { useScopedVehicles } from "@/lib/scoped";
import { useNow } from "@/lib/use-now";
import { istDate } from "@/lib/working-days";
import { isCodeRed } from "@/lib/workflow";

export default function SalesExecutiveDashboard() {
  const { user, roleDef } = useRole();
  const { leads } = useScopedLeads();
  const { vehicles } = useScopedVehicles();
  const now = useNow(30_000);

  const today = istDate(now);
  const newToday = leads.filter((l) => istDate(l.createdAt) === today).length;
  const due = dueFollowUps(leads, now).length;
  const overdue = overdueFollowUps(leads, now).length;
  const docsPending = vehicles.filter((v) => v.sale && !v.sale.docsVerified && !v.delivery?.delivered).length;
  const codeRed = vehicles.filter((v) => isCodeRed(v, now)).length;

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={roleDef.description} />
      <KpiGrid>
        <KpiCard label="New enquiries today" value={newToday} icon={<UserPlus />} href="/enquiries" hint="Walk-in, phone and online" />
        <KpiCard label="Follow-ups due today" value={due} icon={<PhoneCall />} href="/enquiries" hint="Day 2, 3 and 4 calls open now" />
        <KpiCard
          label="Overdue follow-ups"
          value={overdue}
          tone={overdue ? "danger" : "neutral"}
          icon={<Siren />}
          href="/enquiries"
          hint={overdue ? "Escalated to manager & Managing Partner" : "Every call made on time"}
        />
        <KpiCard
          label="Bookings awaiting doc sign-off"
          value={docsPending}
          tone={docsPending ? "warn" : "neutral"}
          icon={<FileWarning />}
          href="/deliveries"
          hint={docsPending ? "Blocks final release" : "All signed off"}
        />
        <KpiCard
          label="Code Red deliveries"
          value={codeRed}
          tone={codeRed ? "danger" : "neutral"}
          icon={<Siren />}
          href="/deliveries"
          hint={codeRed ? "Over 4 days since sale" : "All within 4 days"}
        />
      </KpiGrid>
      <FollowUpsTable kind="overdue" limit={5} />
      <FollowUpsTable kind="due" limit={8} title="Today's follow-ups" />
      <DeliveriesNeedingAction limit={6} />
    </div>
  );
}
