"use client";

import { Wrench } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { SLA } from "@/lib/masters";
import { PageHeader } from "@/components/ui";
import { ReconQueuePanel, RedCountPanel } from "@/components/panels/recon-panel";

export default function ReconPage() {
  const { can } = useRole();
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Wrench className="size-6 text-brand" />}
        title="Reconditioning"
        description={
          <>
            RED at {SLA.reconAmberHours}h and {SLA.reconRedHours}h from stock entry, until the manager passes the quality gate.
            {!can("recon.manage") && " View only."}
          </>
        }
      />
      <ReconQueuePanel />
      <RedCountPanel />
    </div>
  );
}
