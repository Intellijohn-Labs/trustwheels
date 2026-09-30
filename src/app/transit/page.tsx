"use client";

import { Truck } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { SLA } from "@/lib/masters";
import { PageHeader } from "@/components/ui";
import { AddToTransitButton, InTransitPanel, ReadyToDispatchPanel, TransitPerformancePanel } from "@/components/panels/transit-panel";

export default function TransitPage() {
  const { can } = useRole();
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Truck className="size-6 text-brand" />}
        title="Transit"
        description={`Branch to Angamaly. Every vehicle must be received within ${SLA.transitHours} hours of handover to the rider.`}
        actions={<AddToTransitButton />}
      />
      {can("transit.dispatch") && <ReadyToDispatchPanel />}
      <InTransitPanel />
      <TransitPerformancePanel />
    </div>
  );
}
