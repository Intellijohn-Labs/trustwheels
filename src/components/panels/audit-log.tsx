"use client";

import { useMemo, useState } from "react";
import { History, Search, Trash2 } from "lucide-react";
import { activityLogs, deleteActivityLog, deleteActivityLogs, ACTION_TYPES, type ActivityActionType, type ActivityLog } from "@/lib/activity-log";
import { ROLE_ORDER, ROLES } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { formatDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { DataTable, type Column } from "../data-table";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "../selection";
import { Button, Panel, Pill, cn, inputClass } from "../ui";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { Dialog } from "./dialog";

const ACTION_LABEL: Record<ActivityActionType, string> = {
  CREATE: "Create",
  EDIT: "Edit",
  STATUS_CHANGE: "Status change",
  RECONDITIONING: "Reconditioning",
  READY_FOR_SALE: "Ready for sale",
  REJECTED_STOCK: "Rejected stock",
  PAYMENT: "Payment",
  DELETE_REPORT: "Delete report",
  DELETE: "Delete",
  EMPLOYEE: "Employee",
};

const ACTION_TONE: Record<ActivityActionType, "neutral" | "brand" | "ok" | "warn" | "danger"> = {
  CREATE: "ok",
  EDIT: "neutral",
  STATUS_CHANGE: "brand",
  RECONDITIONING: "brand",
  READY_FOR_SALE: "ok",
  REJECTED_STOCK: "warn",
  PAYMENT: "brand",
  DELETE_REPORT: "warn",
  DELETE: "danger",
  EMPLOYEE: "neutral",
};

/** Compact "3h ago" / "2d ago" style, falling back to the date once it's more than a week old. */
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

/**
 * Read-only audit trail, Managing Partner only (gated one level up by rbac.ts's "audit.view"
 * permission, which only that role holds). Entries are written by logActivity() from inside the
 * store functions as the real actions happen - this panel only ever reads `activity_logs` back.
 */
export function AuditLogPanel() {
  const { items, ready } = activityLogs.useItems();
  const { can } = useRole();
  const canDelete = can("audit.delete");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [role, setRole] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ActivityLog | null>(null);
  const [confirming, setConfirming] = useState<ActivityLog[] | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((l) => (from ? l.at.slice(0, 10) >= from : true))
      .filter((l) => (to ? l.at.slice(0, 10) <= to : true))
      .filter((l) => (role === "all" ? true : l.actorRole === role))
      .filter((l) => (actionType === "all" ? true : l.actionType === actionType))
      .filter((l) => (q ? `${l.actorName} ${l.targetEntity} ${l.details}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [items, from, to, role, actionType, query]);

  const selection = useSelection(rows, (l) => l.id);

  async function doDelete(targets: ActivityLog[]) {
    const ids = targets.map((l) => l.id);
    if (ids.length === 1) await deleteActivityLog(ids[0]);
    else await deleteActivityLogs(ids);
    selection.clear();
  }

  const columns: Column<ActivityLog>[] = [
    ...(canDelete
      ? [
          {
            header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all activity log entries" />,
            cell: (l: ActivityLog) => <RowCheckbox checked={selection.isSelected(l.id)} onChange={() => selection.toggle(l.id)} label={`Select log entry for ${l.targetEntity}`} />,
          } satisfies Column<ActivityLog>,
        ]
      : []),
    {
      header: "Timestamp",
      cell: (l) => (
        <div className="flex flex-col">
          <span className="font-medium whitespace-nowrap">{timeAgo(l.at)}</span>
          <span className="text-xs whitespace-nowrap text-muted">{formatDateTime(l.at)}</span>
        </div>
      ),
    },
    {
      header: "Actor",
      cell: (l) => (
        <div className="flex flex-col">
          <span className="font-medium whitespace-nowrap">{l.actorName}</span>
          <span className="text-xs whitespace-nowrap text-muted">{ROLES[l.actorRole]?.label ?? l.actorRole}</span>
        </div>
      ),
    },
    { header: "Action", cell: (l) => <Pill tone={ACTION_TONE[l.actionType]}>{ACTION_LABEL[l.actionType]}</Pill> },
    { header: "Target", cell: (l) => <span className="font-medium whitespace-nowrap">{l.targetEntity}</span> },
    { header: "Details", cell: (l) => <span className="line-clamp-2 max-w-sm text-muted">{l.details}</span> },
    {
      header: "",
      align: "right",
      cell: (l) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
            View
          </Button>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={() => setConfirming([l])} aria-label="Delete this activity log entry">
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Panel
      flush
      title="Activity log"
      description={`${rows.length} event${rows.length === 1 ? "" : "s"}`}
      actions={
        <Button
          size="sm"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv("activity-log", rows, [
              { header: "Timestamp", value: (l) => formatDateTime(l.at) },
              { header: "Actor", value: (l) => l.actorName },
              { header: "Role", value: (l) => ROLES[l.actorRole]?.label ?? l.actorRole },
              { header: "Action", value: (l) => ACTION_LABEL[l.actionType] },
              { header: "Target", value: (l) => l.targetEntity },
              { header: "Details", value: (l) => l.details },
            ])
          }
        >
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reg. no. or description…"
            aria-label="Search activity log"
            className={cn(inputClass(), "h-8 w-56 pl-8 text-xs")}
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className={cn(inputClass(), "h-8 w-auto text-xs")}>
          <option value="all">All roles</option>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLES[r].label}
            </option>
          ))}
        </select>
        <select value={actionType} onChange={(e) => setActionType(e.target.value)} aria-label="Filter by action type" className={cn(inputClass(), "h-8 w-auto text-xs")}>
          <option value="all">All actions</option>
          {ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className={cn(inputClass(), "h-8 w-auto text-xs")} />
        <span className="text-xs text-faint">to</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className={cn(inputClass(), "h-8 w-auto text-xs")} />
        {(from || to || role !== "all" || actionType !== "all" || query) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              setRole("all");
              setActionType("all");
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {canDelete && selection.count > 0 && (
        <div className="px-4 pt-3">
          <SelectionToolbar count={selection.count} noun="log entry" nounPlural="log entries" onClear={selection.clear} onDelete={() => setConfirming(rows.filter((l) => selection.isSelected(l.id)))} />
        </div>
      )}
      <DataTable rows={ready ? rows : []} rowKey={(l) => l.id} empty={ready ? "No matching activity." : "Loading…"} columns={columns} />
      {confirming && (
        <ConfirmDeleteDialog
          count={confirming.length}
          items={confirming.map((l) => `${l.targetEntity} · ${ACTION_LABEL[l.actionType]} · ${formatDateTime(l.at)}`)}
          noun="log entry"
          nounPlural="log entries"
          onConfirm={() => doDelete(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
      {detail && (
        <Dialog title="Activity detail" onClose={() => setDetail(null)}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-faint">
              <History className="size-4" /> {formatDateTime(detail.at)} · {timeAgo(detail.at)}
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Actor</dt>
              <dd className="font-medium">
                {detail.actorName} · {ROLES[detail.actorRole]?.label ?? detail.actorRole}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Action</dt>
              <dd>
                <Pill tone={ACTION_TONE[detail.actionType]}>{ACTION_LABEL[detail.actionType]}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Target</dt>
              <dd className="font-medium">{detail.targetEntity}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Details</dt>
              <dd className="rounded-xl bg-sunken p-3">{detail.details}</dd>
            </div>
          </dl>
        </Dialog>
      )}
    </Panel>
  );
}
