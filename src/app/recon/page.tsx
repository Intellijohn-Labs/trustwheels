"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { SLA } from "@/lib/masters";
import { PageHeader, Segmented } from "@/components/ui";
import { ReconQueuePanel, RedCountPanel } from "@/components/panels/recon-panel";
import { TechnicianReportPanel } from "@/components/panels/technician-report";

type View = "queue" | "report";

export default function ReconPage() {
  const { can } = useRole();
  const [view, setView] = useState<View>("queue");

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
        actions={
          <div className="w-full max-w-xs">
            <Segmented
              name="Reconditioning view"
              value={view}
              onChange={setView}
              options={[
                { value: "queue", label: "Queue" },
                { value: "report", label: "Technician Report" },
              ]}
            />
          </div>
        }
      />
      {view === "queue" ? (
        <>
          <ReconQueuePanel />
          <RedCountPanel />
        </>
      ) : (
        <TechnicianReportPanel />
      )}
    </div>
  );
}
