"use client";

import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AuditLogPanel } from "@/components/panels/audit-log";

export default function AuditLogsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Activity log" icon={<History className="size-6 text-brand" />} description="Every status change, reconditioning move, deletion, and payment, logged as it happens." />
      <AuditLogPanel />
    </div>
  );
}
