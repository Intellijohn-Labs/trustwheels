"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, MinusCircle, PhoneCall, Siren } from "lucide-react";
import { DataTable, type Column } from "../data-table";
import { Button, Panel, Pill, cn } from "../ui";
import { LogCallDialog } from "./lead-dialogs";
import { formatHours } from "./vehicle-cell";
import { branchName } from "@/lib/masters";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { dueFollowUps, followUpStatus, overdueFollowUps, sourceLabel, useScopedLeads, type FollowUpDay, type FollowUpState, type Lead } from "@/lib/leads";

/** Customer name, tap-to-call number and source: first column of enquiry tables. */
export function LeadCell({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-40">
      <p className="font-semibold">{lead.name}</p>
      <p className="text-xs text-muted">
        <a href={`tel:+91${lead.phone}`} className="text-brand tabular-nums hover:underline">
          {lead.phone}
        </a>{" "}
        · {sourceLabel(lead.source)} · {branchName(lead.branchId)}
      </p>
    </div>
  );
}

export function CodeRedFollowUpPill({ day }: { day: FollowUpDay }) {
  return (
    <Pill tone="danger" icon={<Siren className="size-3.5" />} className="whitespace-normal!">
      Code Red · Day {day} call missed · escalated to manager &amp; Managing Partner
    </Pill>
  );
}

const chip: Record<FollowUpState, { icon: typeof Circle; cls: string; label: string }> = {
  done: { icon: CheckCircle2, cls: "bg-ok-soft text-ok", label: "done" },
  due: { icon: Clock, cls: "bg-warn-soft text-warn", label: "due now" },
  upcoming: { icon: Circle, cls: "bg-sunken text-muted", label: "upcoming" },
  overdue: { icon: Siren, cls: "bg-danger text-surface", label: "missed" },
  closed: { icon: MinusCircle, cls: "bg-sunken text-faint", label: "not needed" },
};

/** Day 2 / 3 / 4 cadence at a glance: one chip per call, icon + text. */
export function FollowUpChips({ lead, now }: { lead: Lead; now: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {followUpStatus(lead, now).map((s) => {
        const c = chip[s.state];
        const Icon = c.icon;
        return (
          <span key={s.day} title={`Day ${s.day} call ${c.label}`} aria-label={`Day ${s.day} call ${c.label}`} className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold", c.cls)}>
            <Icon className="size-3" aria-hidden />D{s.day}
          </span>
        );
      })}
    </div>
  );
}

type Row = { lead: Lead; day: FollowUpDay; closesAt: number };

/**
 * Follow-up calls due now ("due") or missed ("overdue", escalated). Used on /enquiries and
 * the sales executive dashboard.
 */
export function FollowUpsTable({ kind, limit, title }: { kind: "due" | "overdue"; limit?: number; title?: string }) {
  const { leads, ready } = useScopedLeads();
  const now = useNow(30_000);
  const { can } = useRole();
  const [logging, setLogging] = useState<Row>();

  const all = (kind === "due" ? dueFollowUps(leads, now) : overdueFollowUps(leads, now)).sort((a, b) => a.closesAt - b.closesAt);
  const rows = limit ? all.slice(0, limit) : all;
  const overdue = kind === "overdue";

  const columns: Column<Row>[] = [
    {
      // Status sits under the name so it is visible without scrolling the table on phones.
      header: "Customer",
      cell: (r) => (
        <div className="min-w-56 space-y-1.5">
          <LeadCell lead={r.lead} />
          {overdue ? (
            <CodeRedFollowUpPill day={r.day} />
          ) : (
            <Pill tone="warn" icon={<Clock className="size-3.5" />}>
              Day {r.day} call due
            </Pill>
          )}
        </div>
      ),
    },
    { header: "Interested in", cell: (r) => <span className="line-clamp-2 min-w-40">{r.lead.interest || "—"}</span> },
    {
      header: "Window",
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {overdue ? `Closed ${formatHours((now - r.closesAt) / 3_600_000)} ago` : `Closes in ${formatHours((r.closesAt - now) / 3_600_000)}`}
        </span>
      ),
    },
    { header: "Assigned to", cell: (r) => <span className="whitespace-nowrap">{r.lead.assignedTo}</span> },
  ];
  if (can("leads.manage"))
    columns.push({
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant={overdue ? "danger" : "primary"} onClick={() => setLogging(r)}>
          <PhoneCall className="size-3.5" /> Log call
        </Button>
      ),
    });

  return (
    <Panel
      flush
      tone={overdue && all.length ? "danger" : undefined}
      title={title ?? (overdue ? `Overdue follow-ups (escalated) · ${all.length}` : `Follow-ups due today · ${all.length}`)}
      description={overdue ? "Calls not made within their day. The manager and Managing Partner have been alerted." : "Day 2, 3 and 4 calls whose window is open now."}
      actions={
        limit && all.length > limit ? (
          <Link href="/enquiries" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        ) : undefined
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.lead.id}-${r.day}`}
        rowTone={() => (overdue ? "danger" : undefined)}
        empty={!ready ? "Loading…" : overdue ? "No missed follow-ups. Every call was made on time." : "No follow-up calls due right now."}
      />
      {logging && <LogCallDialog lead={logging.lead} day={logging.day} onClose={() => setLogging(undefined)} />}
    </Panel>
  );
}

/** "Day 3 call · due by 26/09/2026, 10:30 am" for the next call on an enquiry. */
export function nextCallText(lead: Lead, now: number) {
  const next = followUpStatus(lead, now).find((s) => s.state === "overdue" || s.state === "due" || s.state === "upcoming");
  if (!next) return undefined;
  return { day: next.day, state: next.state, text: next.state === "upcoming" ? `opens ${formatDateTime(new Date(next.opensAt).toISOString())}` : `due by ${formatDateTime(new Date(next.closesAt).toISOString())}` };
}
