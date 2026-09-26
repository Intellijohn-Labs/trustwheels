"use client";

import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ArrivingPanel, ReceivedPanel } from "@/components/panels/receiving-panel";

export default function ReceivingPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<PackageCheck className="size-6 text-brand" />}
        title="Receiving"
        description="Check the plate against the dispatch record, then book the vehicle into Angamaly stock. A Stock ID is issued on receipt."
      />
      <ArrivingPanel />
      <ReceivedPanel limit={15} />
    </div>
  );
}
