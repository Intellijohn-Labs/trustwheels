"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { branchName } from "@/lib/masters";
import { formatDateTime, formatIsoDate } from "@/lib/format";
import { LEAVE_TYPE_LABEL, decideLeave, leaveDays, type LeaveRequest } from "@/lib/hr";
import { DataTable } from "../data-table";
import { Button, Field, textareaClass } from "../ui";
import { Dialog, useInlineAction } from "./dialog";
import { EmployeeCell, LeaveStatusPill, useEmployees, useCanManageHr } from "./hr-bits";

export function leaveRange(l: Pick<LeaveRequest, "from" | "to">) {
  return l.from === l.to ? formatIsoDate(l.from) : `${formatIsoDate(l.from)} – ${formatIsoDate(l.to)}`;
}

/** Approve / Reject buttons for a pending request. Renders nothing without hr.manage. */
export function LeaveDecisionButtons({ request }: { request: LeaveRequest }) {
  const manageHr = useCanManageHr();
  const [mode, setMode] = useState<"approve" | "reject">();
  if (!manageHr || request.status !== "pending") return null;
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="success" onClick={() => setMode("approve")}>
        <Check className="size-3.5" /> Approve
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setMode("reject")}>
        <X className="size-3.5" /> Reject
      </Button>
      {mode && <LeaveDecisionDialog request={request} approve={mode === "approve"} onClose={() => setMode(undefined)} />}
    </div>
  );
}

function LeaveDecisionDialog({ request, approve, onClose }: { request: LeaveRequest; approve: boolean; onClose: () => void }) {
  const { byId } = useEmployees();
  const employee = byId.get(request.employeeId);
  const [note, setNote] = useState("");
  const { submit, failure, busy } = useInlineAction();
  const days = leaveDays(request).length;
  const name = employee?.name ?? "Employee";

  async function save() {
    if (await submit(() => decideLeave(request.id, approve, note), approve ? `Leave approved for ${name}` : `Leave rejected for ${name}`)) onClose();
  }

  return (
    <Dialog
      title={approve ? "Approve leave" : "Reject leave"}
      subtitle={`${name} · ${LEAVE_TYPE_LABEL[request.type]} leave · ${leaveRange(request)}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant={approve ? "success" : "danger"} className="flex-[2]" disabled={busy}>
            {approve ? "Approve leave" : "Reject leave"}
          </Button>
        </>
      }
    >
      <p className="rounded-xl bg-sunken px-3.5 py-2.5 text-sm">
        “{request.reason}”
        <span className="mt-1 block text-xs text-muted">
          {days} working day{days === 1 ? "" : "s"}
          {approve && " will be marked as leave on attendance."}
        </span>
      </p>
      <div className="mt-4">
        <Field label={approve ? "Note (optional)" : "Reason for rejecting"} htmlFor="leave-note" required={!approve} error={!approve && failure?.includes("note") ? "Required" : undefined}>
          <textarea id="leave-note" autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textareaClass(!approve && !!failure?.includes("note"))} />
        </Field>
      </div>
      {failure && !failure.includes("note") && <p className="mt-4 text-sm font-medium text-danger">{failure}</p>}
    </Dialog>
  );
}

/** Leave requests table, with Approve / Reject for HR. */
export function LeaveTable({ requests, compact, empty = "No leave requests." }: { requests: LeaveRequest[]; compact?: boolean; empty?: string }) {
  const { byId } = useEmployees();
  const manageHr = useCanManageHr();
  const manage = manageHr && requests.some((r) => r.status === "pending");
  return (
    <DataTable
      rows={requests}
      rowKey={(r) => r.id}
      empty={empty}
      columns={[
        { header: "Employee", cell: (r) => <EmployeeCell employee={byId.get(r.employeeId)} /> },
        { header: "Branch", cell: (r) => <span className="whitespace-nowrap">{branchName(byId.get(r.employeeId)?.branchId ?? "")}</span> },
        {
          header: "Dates",
          cell: (r) => (
            <div className="whitespace-nowrap">
              <p className="tabular-nums">{leaveRange(r)}</p>
              <p className="text-xs text-muted">
                {LEAVE_TYPE_LABEL[r.type]} · {leaveDays(r).length} day{leaveDays(r).length === 1 ? "" : "s"}
              </p>
            </div>
          ),
        },
        { header: "Reason", cell: (r) => <p className="max-w-64 min-w-40 text-sm">{r.reason}</p> },
        ...(compact
          ? []
          : [
              {
                header: "Status",
                cell: (r: LeaveRequest) => (
                  <div>
                    <LeaveStatusPill status={r.status} />
                    {r.decided ? (
                      <p className="mt-1 max-w-56 text-xs text-muted">
                        {r.decided.by}, {formatDateTime(r.decided.at)}
                        {r.decided.note && ` · “${r.decided.note}”`}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs whitespace-nowrap text-muted">Asked {formatDateTime(r.requestedAt)}</p>
                    )}
                  </div>
                ),
              },
            ]),
        ...(manage ? [{ header: "", align: "right" as const, cell: (r: LeaveRequest) => <LeaveDecisionButtons request={r} /> }] : []),
      ]}
    />
  );
}
