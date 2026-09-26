"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import { LEAVE_STATUS_LABEL, leaveRequests, type LeaveStatus } from "@/lib/hr";
import { PageHeader, Panel, Segmented } from "@/components/ui";
import { LeaveTable } from "@/components/panels/leave-panel";
import { ViewOnlyNote, useCanManageHr } from "@/components/panels/hr-bits";

type Filter = LeaveStatus | "all";

export default function LeavePage() {
  const manageHr = useCanManageHr();
  const { items, ready } = leaveRequests.useItems();
  const [filter, setFilter] = useState<Filter>("pending");
  const rows = items.filter((l) => filter === "all" || l.status === filter).sort((a, b) => (filter === "pending" ? a.from.localeCompare(b.from) : b.requestedAt.localeCompare(a.requestedAt)));
  const count = (f: Filter) => items.filter((l) => f === "all" || l.status === f).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Leave requests" icon={<Plane className="size-6 text-brand" />} description="Approving a request marks those working days as leave on attendance. Rejections need a note." />
      {!manageHr && <ViewOnlyNote />}
      <div className="sm:max-w-xl">
        <Segmented<Filter>
          name="Leave status"
          value={filter}
          onChange={setFilter}
          options={(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => ({ value: f, label: `${f === "all" ? "All" : LEAVE_STATUS_LABEL[f]} ${count(f)}` }))}
        />
      </div>
      <Panel flush>{ready && <LeaveTable requests={rows} empty={filter === "pending" ? "No leave requests are waiting." : "No requests here."} />}</Panel>
    </div>
  );
}
