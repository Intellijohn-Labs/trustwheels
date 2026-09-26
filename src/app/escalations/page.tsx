"use client";

import { useState } from "react";
import { Siren } from "lucide-react";
import { ESCALATION_KIND_LABEL, type EscalationKind } from "@/lib/escalations";
import { useEscalations } from "@/lib/use-escalations";
import { KpiCard, KpiGrid, PageHeader, Panel, cn } from "@/components/ui";
import { EscalationList } from "@/components/panels/escalation-list";

const KINDS = Object.keys(ESCALATION_KIND_LABEL) as EscalationKind[];

export default function EscalationsPage() {
  const { items, ready } = useEscalations();
  const [kind, setKind] = useState<EscalationKind | "all">("all");
  const count = (k: EscalationKind) => items.filter((e) => e.kind === k).length;
  const critical = items.filter((e) => e.severity === "critical").length;
  const shown = kind === "all" ? items : items.filter((e) => e.kind === kind);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Escalations"
        icon={<Siren className="size-6 text-danger" />}
        description="Every open SLA breach across the system: Code Red deliveries, transit delays, reconditioning RED flags, missed follow-ups and seller payments."
      />
      <KpiGrid>
        <KpiCard label="Critical" value={critical} tone={critical ? "danger" : "neutral"} icon={<Siren />} hint={critical ? "Needs action today" : "Nothing critical"} />
        <KpiCard label="Code Red deliveries" value={count("code_red")} tone={count("code_red") ? "danger" : "neutral"} hint="Sold > 4 days, not delivered" />
        <KpiCard label="Transit breaches" value={count("transit")} tone={count("transit") ? "danger" : "neutral"} hint="Not received within 48h" />
        <KpiCard label="Missed follow-ups" value={count("follow_up")} tone={count("follow_up") ? "warn" : "neutral"} hint="Day 2 / 3 / 4 calls" />
      </KpiGrid>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {(["all", ...KINDS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
              kind === k ? "border-brand bg-brand text-surface" : "border-line-strong bg-surface hover:bg-sunken",
            )}
          >
            {k === "all" ? "All" : ESCALATION_KIND_LABEL[k]}
            <span className={cn("text-xs tabular-nums", kind === k ? "opacity-80" : "text-muted")}>{k === "all" ? items.length : count(k)}</span>
          </button>
        ))}
      </div>

      <Panel flush title={`${shown.length} open`} description="Most urgent first. Each item links to the screen where it is resolved.">
        {ready ? <EscalationList items={shown} empty="Nothing open in this category." /> : <p className="p-5 text-sm text-muted">Loading…</p>}
      </Panel>
    </div>
  );
}
