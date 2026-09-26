"use client";

import { useState } from "react";
import { Ban, Loader2, Phone, Trash2 } from "lucide-react";
import { Dialog } from "./dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { OptionGrid } from "./lead-dialogs";
import { Button, Field, Pill, inputClass, textareaClass } from "../ui";
import { useAction } from "../toast";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { localInput, tomorrowAt10 } from "@/lib/datetime-input";
import { SLA } from "@/lib/masters";
import { SalesHandoffFields, defaultHandoff, type Handoff } from "./inbound-call";
import { assertNoOpenLead } from "@/lib/leads";
import {
  DISPOSITIONS,
  attempts,
  pushToSales,
  sourceLabel,
  campaigns,
  deleteCallLog,
  dispositionLabel,
  isActive,
  isConnected,
  listLabel,
  logDisposition,
  setDoNotCall,
  taskState,
  type CallLog,
  type CallTask,
  type Disposition,
} from "@/lib/calls";

const STATE_LABEL = { open: "To call", callback: "Callback scheduled", interested: "Interested · handed to sales", closed: "Closed", dnc: "Do not call" } as const;
const STATE_TONE = { open: "brand", callback: "warn", interested: "ok", closed: "neutral", dnc: "danger" } as const;

/**
 * One-screen customer card: who they are, why we're calling, the full call history,
 * then the disposition form. The system records calls; the number is a tel: link.
 */
export function CustomerCardDialog({ task, onClose, preset }: { task: CallTask; onClose: () => void; preset?: Disposition }) {
  const { can } = useRole();
  const { items: allCampaigns } = campaigns.useItems();
  const campaign = allCampaigns.find((c) => c.id === task.campaignId);
  const state = taskState(task);
  const manage = can("calls.manage") && isActive(task);
  const canDeleteLog = can("calls.delete");
  // A frozen snapshot taken when the trash icon is clicked, so the dialog keeps showing the
  // right entry even after the delete succeeds and `task.history` (a live prop) gets shorter.
  const [deletingLog, setDeletingLog] = useState<{ index: number; entry: CallLog }>();

  const [disposition, setDisposition] = useState<Disposition | undefined>(preset);
  const [handoff, setHandoff] = useState<Handoff>(defaultHandoff);
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();
  const now = useNow(30_000);

  const errors = {
    disposition: disposition ? undefined : "Pick the call outcome",
    callback: disposition === "callback" && !callbackAt ? "Pick a date and time" : disposition === "callback" && new Date(callbackAt).getTime() < now - 60_000 ? "Pick a time in the future" : undefined,
  };

  async function submit() {
    setSubmitted(true);
    if (!disposition || errors.callback) return;
    const handToSales = disposition === "interested" && handoff.send && !task.handoff;
    const ok = await run(
      async () => {
        if (handToSales) await assertNoOpenLead(task.phone);
        await logDisposition(task.id, disposition, note, disposition === "callback" ? callbackAt : undefined);
        if (handToSales) await pushToSales(task.id, handoff.branchId, handoff.exec);
      },
      handToSales
        ? `Interested · sent to ${handoff.exec}`
        : disposition === "callback"
          ? `Callback scheduled for ${formatDateTime(new Date(callbackAt).toISOString())}`
          : `Call logged: ${dispositionLabel(disposition)}`,
    );
    if (ok) onClose();
  }

  const dialog = (
    <Dialog
      wide
      title={task.customer}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {listLabel(task.list)}
          {campaign && <> · {campaign.name}</>} · assigned to {task.assignedTo}
        </span>
      }
      onClose={onClose}
      onSubmit={manage ? submit : undefined}
      footer={
        manage ? (
          <>
            <Button size="lg" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save call
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sunken/70 p-3.5">
          <div className="min-w-0">
            <a href={`tel:+91${task.phone}`} className="inline-flex items-center gap-2 text-lg font-semibold text-brand tabular-nums">
              <Phone className="size-4" /> +91 {task.phone}
            </a>
            {task.vehicleInterest && <p className="text-sm text-muted">{task.vehicleInterest}</p>}
            {task.source && (
              <p className="text-xs text-muted">
                {sourceLabel(task.source)} · received {formatDateTime(task.receivedAt ?? task.dueAt)}
                {attempts(task) > 0 && <> · {attempts(task)} unanswered {attempts(task) === 1 ? "attempt" : "attempts"}</>}
              </p>
            )}
            {task.notes && <p className="mt-1 text-sm">“{task.notes}”</p>}
            {task.handoff && <p className="mt-1 text-sm font-medium text-ok">In the sales pipeline with {task.handoff.to}</p>}
            {campaign && <p className="mt-1 text-sm">Offer: {campaign.offer}</p>}
          </div>
          <Pill tone={STATE_TONE[state]} icon={state === "dnc" ? <Ban className="size-3.5" /> : undefined}>
            {STATE_LABEL[state]}
            {state === "callback" && task.callbackAt && <> · {formatDateTime(task.callbackAt)}</>}
          </Pill>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Call history · {task.history.length}</h3>
          {task.history.length === 0 ? (
            <p className="text-sm text-muted">Not called yet.</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-line pl-3">
              {[...task.history].reverse().map((h, i) => {
                const index = task.history.length - 1 - i;
                return (
                  <li key={index} className="group flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{dispositionLabel(h.disposition)}</span>
                        <span className="text-xs text-muted">
                          {isConnected(h.disposition) ? "connected" : "not connected"} · {formatDateTime(h.at)} · {h.by}
                        </span>
                      </p>
                      {h.note && <p className="text-muted">“{h.note}”</p>}
                    </div>
                    {canDeleteLog && (
                      <Button size="sm" variant="ghost" onClick={() => setDeletingLog({ index, entry: h })} aria-label={`Delete log: ${dispositionLabel(h.disposition)} · ${formatDateTime(h.at)}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {manage && (
          <>
            <Field label="Call outcome" required error={submitted ? errors.disposition : undefined}>
              <OptionGrid name="Call outcome" value={disposition} onChange={setDisposition} options={DISPOSITIONS} />
            </Field>
            {disposition === "interested" && !task.handoff && <SalesHandoffFields value={handoff} onChange={setHandoff} />}
            {disposition && disposition !== "interested" && DISPOSITIONS.find((d) => d.value === disposition)?.closes && <p className="text-xs text-muted">This closes the call task.</p>}
            {disposition === "no_answer" && task.source && <p className="text-xs text-muted">Counts as an attempt. Redial within {SLA.noAnswerRetryMinutes / 60} hours or the entry turns red.</p>}
            {disposition === "callback" && (
              <Field label="Call back at" htmlFor="callback-at" required error={submitted ? errors.callback : undefined}>
                <input id="callback-at" type="datetime-local" value={callbackAt} min={localInput(now)} onChange={(e) => setCallbackAt(e.target.value)} className={inputClass(submitted && !!errors.callback)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setCallbackAt(localInput(Date.now() + 3_600_000))}>
                    In 1 hour
                  </Button>
                  <Button size="sm" onClick={() => setCallbackAt(localInput(tomorrowAt10()))}>
                    Tomorrow 10 am
                  </Button>
                </div>
              </Field>
            )}
            <Field label="Note" htmlFor="disp-note">
              <textarea id="disp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did the customer say?" className={textareaClass()} />
            </Field>
          </>
        )}

        {can("calls.manage") && (
          <DoNotCallToggle task={task} />
        )}
      </div>
    </Dialog>
  );

  return (
    <>
      {dialog}
      {deletingLog && (
        <ConfirmDeleteDialog
          count={1}
          items={[`${dispositionLabel(deletingLog.entry.disposition)} · ${formatDateTime(deletingLog.entry.at)}`]}
          noun="log entry"
          onConfirm={() => deleteCallLog(task.id, deletingLog.index)}
          onClose={() => setDeletingLog(undefined)}
        />
      )}
    </>
  );
}

function DoNotCallToggle({ task }: { task: CallTask }) {
  const { run, busy } = useAction();
  return (
    <div className="border-t border-line pt-3">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => run(() => setDoNotCall(task.id, !task.doNotCall), task.doNotCall ? "Removed from do-not-call" : "Added to do-not-call list")}
      >
        <Ban className="size-3.5" /> {task.doNotCall ? "Remove from do-not-call list" : "Customer asked not to be called"}
      </Button>
    </div>
  );
}
