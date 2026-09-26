"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlarmClock, Ban, CheckCircle2, Clock, PhoneCall, PhoneForwarded, Trash2 } from "lucide-react";
import { DataTable, type Column } from "../data-table";
import { Button, Panel, Pill } from "../ui";
import { CustomerCardDialog } from "./call-dialogs";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { CallStatusBadge, StatusSelector } from "./inbound-call";
import { formatHours } from "./vehicle-cell";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "@/components/selection";
import {
  callStatsToday,
  callTasks,
  campaigns,
  deleteCallTask,
  deleteCallTasks,
  dispositionLabel,
  isActive,
  isOverdueCallback,
  lastCall,
  listLabel,
  nextCallAt,
  startOfIstDay,
  taskState,
  todaysCalls,
  turnaround,
  callStatus,
  type CallStatus,
  type CallTask,
  type Disposition,
} from "@/lib/calls";

/** Due / callback / closed status for a call task: icon + text. */
export function CallDuePill({ task, now }: { task: CallTask; now: number }) {
  const state = taskState(task);
  const tr = turnaround(task, now);
  if (tr?.state === "late") return <Pill tone="danger" icon={<AlarmClock className="size-3.5" />}>Incoming call · late {formatHours((now - tr.dueAt) / 3_600_000)}</Pill>;
  if (tr?.state === "soon") return <Pill tone="warn" icon={<Clock className="size-3.5" />}>Incoming call · call now</Pill>;
  if (state === "dnc") return <Pill tone="neutral" icon={<Ban className="size-3.5" />}>Do not call</Pill>;
  if (state === "interested") return <Pill tone="ok" icon={<CheckCircle2 className="size-3.5" />}>{task.handoff ? `Interested · with ${task.handoff.to}` : "Interested"}</Pill>;
  if (state === "closed") return <Pill tone="neutral">Closed · {dispositionLabel(lastCall(task).disposition)}</Pill>;
  const at = nextCallAt(task);
  if (state === "callback")
    return isOverdueCallback(task, now) ? (
      <Pill tone="danger" icon={<AlarmClock className="size-3.5" />}>
        Callback overdue {formatHours((now - at) / 3_600_000)}
      </Pill>
    ) : (
      <Pill tone="warn" icon={<PhoneForwarded className="size-3.5" />}>
        Callback {formatDateTime(new Date(at).toISOString())}
      </Pill>
    );
  if (at < startOfIstDay(now)) return <Pill tone="warn" icon={<Clock className="size-3.5" />}>Carried over</Pill>;
  return (
    <Pill tone={at <= now ? "brand" : "neutral"} icon={<Clock className="size-3.5" />}>
      {at <= now ? "Due now" : `Due ${formatDateTime(new Date(at).toISOString())}`}
    </Pill>
  );
}

/** Table of call tasks; tapping a row's button opens the customer card (history + disposition). */
export function CallTaskTable({ tasks, now, title, description, actions, empty = "No calls here." }: { tasks: CallTask[]; now: number; title: ReactNode; description?: ReactNode; actions?: ReactNode; empty?: ReactNode }) {
  const { can } = useRole();
  const canDelete = can("calls.delete");
  const { items: allCampaigns } = campaigns.useItems();
  const [open, setOpen] = useState<string>();
  const [preset, setPreset] = useState<Disposition>();
  const { items } = callTasks.useItems();
  const openTask = items.find((t) => t.id === open);
  const openCard = (id: string, d?: Disposition) => {
    setPreset(d);
    setOpen(id);
  };

  const label = (t: CallTask) => `${t.customer} · ${t.phone}`;
  const selection = useSelection(tasks, (t) => t.id);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; labels: string[] } | null>(null);

  const rowTone = (t: CallTask) => {
    const tr = turnaround(t, now);
    return isOverdueCallback(t, now) || tr?.state === "late" ? ("danger" as const) : tr?.state === "soon" ? ("warn" as const) : undefined;
  };

  const columns: Column<CallTask>[] = [
    ...(canDelete
      ? [
          {
            header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown calls" />,
            cell: (t: CallTask) => <RowCheckbox checked={selection.isSelected(t.id)} onChange={() => selection.toggle(t.id)} label={`Select ${label(t)}`} />,
          } satisfies Column<CallTask>,
        ]
      : []),
    {
      header: "Customer",
      cell: (t) => (
        <div className="min-w-40">
          <p className="font-semibold">{t.customer}</p>
          <p className="text-xs text-muted">
            <a href={`tel:+91${t.phone}`} className="text-brand tabular-nums hover:underline">
              {t.phone}
            </a>{" "}
            · {listLabel(t.list)}
          </p>
        </div>
      ),
    },
    {
      header: "About",
      cell: (t) => (
        <div className="min-w-40 text-sm">
          {t.vehicleInterest ?? "—"}
          {t.campaignId && <p className="text-xs text-muted">{allCampaigns.find((c) => c.id === t.campaignId)?.name}</p>}
        </div>
      ),
    },
    {
      header: "Last call",
      cell: (t) => {
        const last = lastCall(t);
        return last ? (
          <div className="min-w-32 text-xs">
            <p className="font-medium text-ink">{dispositionLabel(last.disposition)}</p>
            <p className="text-muted">{formatDateTime(last.at)}</p>
          </div>
        ) : (
          <span className="text-xs text-muted">Not called</span>
        );
      },
    },
    {
      header: "Current status",
      cell: (t) => (
        <div className="flex min-w-44 flex-col items-start gap-1.5">
          <CallStatusBadge task={t} />
          {isActive(t) && <CallDuePill task={t} now={now} />}
          {can("calls.manage") && isActive(t) && <StatusSelector task={t} onPick={(d) => openCard(t.id, d)} />}
        </div>
      ),
    },
    { header: "Assigned", cell: (t) => <span className="whitespace-nowrap">{t.assignedTo}</span> },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {can("calls.manage") && isActive(t) ? (
            <Button size="sm" variant={rowTone(t) === "danger" ? "danger" : "primary"} onClick={() => openCard(t.id)}>
              <PhoneCall className="size-3.5" /> Log call
            </Button>
          ) : (
            <Button size="sm" onClick={() => openCard(t.id)}>
              View
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ ids: [t.id], labels: [label(t)] })} aria-label={`Delete ${label(t)}`}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {canDelete && selection.count > 0 && (
        <SelectionToolbar
          count={selection.count}
          noun="call"
          onClear={selection.clear}
          onDelete={() =>
            setConfirmDelete({
              ids: [...selection.selected],
              labels: tasks.filter((t) => selection.selected.has(t.id)).map(label),
            })
          }
        />
      )}
      <Panel flush title={title} description={description} actions={actions} tone={tasks.some((t) => isOverdueCallback(t, now)) ? "danger" : undefined}>
        <DataTable columns={columns} rows={tasks} rowKey={(t) => t.id} rowTone={rowTone} empty={empty} />
        {openTask && <CustomerCardDialog key={`${openTask.id}:${preset ?? ""}`} task={openTask} preset={preset} onClose={() => setOpen(undefined)} />}
      </Panel>
      {confirmDelete && (
        <ConfirmDeleteDialog
          count={confirmDelete.ids.length}
          items={confirmDelete.labels}
          noun="call"
          onConfirm={async () => {
            if (confirmDelete.ids.length === 1) await deleteCallTask(confirmDelete.ids[0]);
            else await deleteCallTasks(confirmDelete.ids);
            selection.clear();
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/** Today's calls: due tasks, carried-over tasks and callbacks (overdue callbacks highlighted). */
export function TodaysCallList({ limit, status = "all" }: { limit?: number; status?: CallStatus | "all" }) {
  const { items, ready } = callTasks.useItems();
  const now = useNow(30_000);
  const all = todaysCalls(items, now).filter((t) => status === "all" || callStatus(t) === status);
  const rows = limit ? all.slice(0, limit) : all;
  return (
    <CallTaskTable
      tasks={rows}
      now={now}
      title={`Today's calls · ${all.length}`}
      description="Due today, carried over and callbacks. Overdue callbacks are highlighted."
      actions={
        limit && all.length > limit ? (
          <Link href="/calls" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        ) : undefined
      }
      empty={ready ? "All of today's calls are done." : "Loading…"}
    />
  );
}

/** Calls made / connected / interested today, per person. */
export function CallPerformance() {
  const { items } = callTasks.useItems();
  const now = useNow(60_000);
  const { rows, total } = callStatsToday(items, now);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <Panel flush title="Today's performance" description="Connected = the customer picked up (not no-answer / wrong number).">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium">Telecaller</th>
            <th className="px-4 py-2 text-right font-medium">Calls</th>
            <th className="px-4 py-2 text-right font-medium">Connected</th>
            <th className="px-4 py-2 text-right font-medium">Interested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted">
                No calls logged today yet.
              </td>
            </tr>
          )}
          {[...rows, ...(rows.length > 1 ? [total] : [])].map((r) => (
            <tr key={r.person} className={r === total ? "font-semibold" : undefined}>
              <td className="px-4 py-2">{r.person}</td>
              <td className="px-4 py-2 text-right">{r.made}</td>
              <td className="px-4 py-2 text-right">
                {r.connected} <span className="text-xs text-muted">({pct(r.connected, r.made)})</span>
              </td>
              <td className="px-4 py-2 text-right">{r.interested}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
