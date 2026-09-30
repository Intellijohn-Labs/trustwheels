"use client";

import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AccountsPanel } from "@/components/panels/accounts-panel";

export default function AccountsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Landmark className="size-6 text-brand" />}
        title="Accounts"
        description="Cash position on sold vehicles: revenue, what's been collected, and what customers still owe."
      />
      <AccountsPanel />
    </div>
  );
}
