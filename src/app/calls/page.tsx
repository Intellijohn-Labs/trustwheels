"use client";

import { useState } from "react";
import { AlarmClock, PhoneCall, PhoneIncoming, ThumbsUp } from "lucide-react";
import { KpiCard, KpiGrid, PageHeader, cn } from "@/components/ui";
import { CallPerformance, CallTaskTable, TodaysCallList } from "@/components/panels/call-list";
import { InboundCallTable, NewCallButton } from "@/components/panels/inbound-call";
import { useNow } from "@/lib/use-now";
import { CALL_LISTS, CALL_STATUSES, callStatsToday, callStatus, callTasks, isActive, isOverdueCallback, todaysCalls, turnaround, type CallList, type CallStatus } from "@/lib/calls";

type Tab = "today" | CallList | "closed";

// Colour dot beside each status chip (the label always carries the meaning).
const STATUS_DOT: Record<CallStatus | "all", string> = {
  all: "bg-faint",
  pending: "bg-warn",
  followup: "bg-brand",
  no_answer: "bg-line-strong",
  interested: "bg-ok",
  closed: "bg-danger",
};

export default function CallsPage() {
  const { items } = callTasks.useItems();
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>("today");
  const [status, setStatus] = useState<CallStatus | "all">("all");
  const byStatus = (t: (typeof items)[number]) => status === "all" || callStatus(t) === status;

  const today = todaysCalls(items, now);
  const { total } = callStatsToday(items, now);
  const overdue = items.filter((t) => isOverdueCallback(t, now) || turnaround(t, now)?.state === "late").length;

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "today", label: "Today", count: today.length },
    ...CALL_LISTS.map((l) => ({ value: l.value as Tab, label: l.label, count: items.filter((t) => t.list === l.value && isActive(t)).length })),
    { value: "closed", label: "Closed", count: items.filter((t) => !isActive(t)).length },
  ];
  const current = tabs.find((t) => t.value === tab)!;
  const rows = (
    tab === "closed"
      ? items.filter((t) => !isActive(t))
      : items.filter((t) => t.list === tab && isActive(t)).sort((a, b) => (a.callbackAt ?? a.dueAt).localeCompare(b.callbackAt ?? b.dueAt))
  ).filter(byStatus);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<PhoneCall className="size-6 text-brand" />}
        title="Call lists"
        description="Open the customer card before you call: it shows the full history. Log every call, including no-answers."
        actions={<NewCallButton size="lg" />}
      />

      <KpiGrid>
        <KpiCard label="Calls due today" value={today.length} icon={<PhoneIncoming />} hint="Including carried over" />
        <KpiCard label="Late / overdue calls" value={overdue} tone={overdue ? "danger" : "neutral"} icon={<AlarmClock />} hint={overdue ? "Customer is waiting for our call" : "All callbacks on time"} />
        <KpiCard label="Calls made today" value={total.made} hint={`${total.connected} connected`} />
        <KpiCard label="Interested today" value={total.interested} icon={<ThumbsUp />} hint="Handed to sales" />
      </KpiGrid>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted">Status</span>
        <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {([{ value: "all", label: "All" }, ...CALL_STATUSES] as { value: CallStatus | "all"; label: string }[]).map((o) => {
            const count = o.value === "all" ? items.length : items.filter((t) => callStatus(t) === o.value).length;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={status === o.value}
                onClick={() => setStatus(o.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                  status === o.value ? "nav-active border-transparent" : "border-line-strong bg-surface text-muted hover:text-ink",
                )}
              >
                <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[o.value])} />
                {o.label} <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <InboundCallTable status={status} />

      <div role="tablist" aria-label="Call lists" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition",
              tab === t.value ? "border-ink bg-ink text-page" : "border-line-strong bg-surface text-muted hover:text-ink",
            )}
          >
            {t.label} <span className="tabular-nums opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "today" ? (
        <TodaysCallList status={status} />
      ) : (
        <CallTaskTable tasks={rows} now={now} title={`${current.label} · ${rows.length}`} empty={tab === "closed" ? "No closed calls yet." : "No open calls in this list."} />
      )}

      <CallPerformance />
    </div>
  );
}
