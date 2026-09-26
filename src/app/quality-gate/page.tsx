"use client";

import { ShieldCheck } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { PageHeader } from "@/components/ui";
import { QualityGatePanel, RecentlyApprovedPanel } from "@/components/panels/quality-gate-panel";

export default function QualityGatePage() {
  const { can } = useRole();
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<ShieldCheck className="size-6 text-brand" />}
        title="Quality gate"
        description={`Inspect the work and photos before the vehicle goes on display.${can("gate.approve") ? "" : " View only."}`}
      />
      <QualityGatePanel />
      <RecentlyApprovedPanel />
    </div>
  );
}
