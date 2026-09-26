"use client";

import Link from "next/link";
import { ChevronRight, Siren, TriangleAlert } from "lucide-react";
import { branchName } from "@/lib/masters";
import { ESCALATION_KIND_LABEL, type Escalation } from "@/lib/escalations";
import { EmptyState, Pill, cn } from "@/components/ui";

/** Escalations as a list of cards; critical ones carry the Code Red treatment. */
export function EscalationList({ items, limit, empty = "No open escalations." }: { items: Escalation[]; limit?: number; empty?: string }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="cascade divide-y divide-line">
      {shown.map((e) => (
        <li key={e.id}>
          <Link
            href={e.href}
            className={cn(
              "flex items-start gap-3 px-4 py-3 transition hover:bg-sunken/60 sm:px-5",
              e.severity === "critical" && "bg-danger-soft/50 shadow-[inset_4px_0_0_var(--danger)]",
            )}
          >
            <span className={cn("mt-0.5", e.severity === "critical" ? "text-danger" : "text-warn")}>
              {e.severity === "critical" ? <Siren className="wiggle size-4" /> : <TriangleAlert className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{e.title}</span>
                <Pill tone={e.severity === "critical" ? "danger" : "warn"}>{e.severity === "critical" ? "Critical" : "Warning"}</Pill>
              </span>
              <span className="mt-0.5 block text-sm text-muted">{e.detail}</span>
              <span className="mt-1 block text-xs text-faint">
                {ESCALATION_KIND_LABEL[e.kind]} · {branchName(e.branchId)} · Owner: {e.owner}
              </span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
