"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlarmClock, Ban, CheckCircle2, Clock, Globe, Loader2, MessageCircle, Pencil, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, Plus, Send, Store, Timer } from "lucide-react";
import { Dialog } from "./dialog";
import { OptionGrid } from "./lead-dialogs";
import { ResponsiveTable } from "./responsive-table";
import { CustomerCardDialog } from "./call-dialogs";
import type { Column } from "../data-table";
import { Button, Field, Panel, Pill, Segmented, cn, inputClass, textareaClass } from "../ui";
import { useAction } from "../toast";
import { BRANCHES, MAKES, SLA } from "@/lib/masters";
import { formatDateTime } from "@/lib/format";
import { formatDuration } from "@/lib/verification";
import { localInput, tomorrowAt10 } from "@/lib/datetime-input";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { salesExecutives } from "@/lib/user-names";
import { assertNoOpenLead } from "@/lib/leads";
import {
  CALL_SOURCES,
  DISPOSITIONS,
  addInboundCall,
  attempts,
  callStatus,
  callTasks,
  isActive,
  isOverdueCallback,
  lastCall,
  pushToSales,
  sourceLabel,
  taskState,
  turnaround,
  updateInboundCall,
  type CallSource,
  type CallStatus,
  type CallTask,
  type Disposition,
  type InboundInput,
} from "@/lib/calls";

/*
 * Incoming calls / new enquiries for the telecaller: log a call the moment it comes in,
 * work it from the live list, and push interested callers into the sales pipeline.
 */

const SOURCE_ICON: Record<CallSource, typeof PhoneIncoming> = { inbound_call: PhoneIncoming, whatsapp: MessageCircle, walk_in: Store, website: Globe };

const VEHICLE_SUGGESTIONS = Object.entries(MAKES).flatMap(([make, models]) => models.map((m) => `${make} ${m}`));

/** Outcomes offered when the call was already connected. */
const CONNECTED_OUTCOMES = DISPOSITIONS.filter((d) => ["interested", "callback", "not_interested", "purchased_elsewhere"].includes(d.value)).map((d) =>
  d.value === "callback" ? { ...d, label: "Follow-up (call back later)" } : d,
);

const mins = (ms: number) => formatDuration(Math.abs(ms)).replace(/^00h /, "").replace(/ \d\ds$/, "");

// ---- status ------------------------------------------------------------------------

/** The five call statuses, with icon + text (never colour alone). */
export function CallStatusBadge({ task }: { task: CallTask }) {
  const state = taskState(task);
  const last = lastCall(task);
  if (state === "dnc") return <Pill icon={<Ban className="size-3.5" />}>Do not call</Pill>;
  if (state === "interested")
    return (
      <Pill tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
        {task.handoff ? `Interested · with ${task.handoff.to}` : "Connected · interested"}
      </Pill>
    );
  if (state === "closed")
    return (
      <Pill className="bg-danger-soft text-danger" icon={<PhoneOff className="size-3.5" />}>
        {last?.disposition === "not_interested" ? "Not interested" : "Closed"} · {last && DISPOSITIONS.find((d) => d.value === last.disposition)?.label}
      </Pill>
    );
  if (state === "callback")
    return (
      <Pill tone="brand" icon={<PhoneCall className="size-3.5" />}>
        Follow-up {task.callbackAt && formatDateTime(task.callbackAt)}
      </Pill>
    );
  if (last?.disposition === "no_answer")
    return (
      <Pill icon={<PhoneMissed className="size-3.5" />}>
        No answer / Busy · {attempts(task)} {attempts(task) === 1 ? "attempt" : "attempts"}
      </Pill>
    );
  return (
    <Pill tone="warn" icon={<Clock className="size-3.5" />}>
      Not called yet
    </Pill>
  );
}

/** Amber when the callback target is close, red once it has passed. */
export function TurnaroundPill({ task, now }: { task: CallTask; now: number }) {
  const t = turnaround(task, now);
  if (t?.state === "late") return <Pill tone="danger" icon={<AlarmClock className="size-3.5" />}>Late by {mins(now - t.dueAt)}</Pill>;
  if (t?.state === "soon") return <Pill tone="warn" icon={<Timer className="size-3.5" />}>Call within {mins(t.dueAt - now)}</Pill>;
  if (t) return <span className="text-xs text-muted">Call by {formatDateTime(new Date(t.dueAt).toISOString())}</span>;
  if (isOverdueCallback(task, now)) return <Pill tone="danger" icon={<AlarmClock className="size-3.5" />}>Follow-up overdue</Pill>;
  return null;
}

function rowTone(task: CallTask, now: number) {
  const t = turnaround(task, now);
  if (t?.state === "late" || isOverdueCallback(task, now)) return "danger" as const;
  if (t?.state === "soon") return "warn" as const;
  if (taskState(task) === "interested" && !task.handoff) return "ok" as const;
  return undefined;
}

// ---- sales hand-off ------------------------------------------------------------------

export interface Handoff {
  send: boolean;
  branchId: string;
  exec: string;
}

export const defaultHandoff = (): Handoff => ({ send: true, branchId: "ang", exec: salesExecutives()[0] });

/** "Send to the sales pipeline now" + branch and sales executive. */
export function SalesHandoffFields({ value, onChange, optional = true }: { value: Handoff; onChange: (h: Handoff) => void; optional?: boolean }) {
  return (
    <div className="rounded-2xl border border-ok/30 bg-ok-soft/60 p-3.5">
      {optional ? (
        <label className="flex items-center gap-2 text-sm font-semibold text-ok">
          <input type="checkbox" checked={value.send} onChange={(e) => onChange({ ...value, send: e.target.checked })} className="size-4 accent-[var(--ok)]" />
          Send to the sales pipeline now
        </label>
      ) : (
        <p className="text-sm font-semibold text-ok">Send to the sales pipeline</p>
      )}
      {value.send && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Branch" htmlFor="handoff-branch">
            <select id="handoff-branch" value={value.branchId} onChange={(e) => onChange({ ...value, branchId: e.target.value })} className={inputClass()}>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sales executive" htmlFor="handoff-exec">
            <select id="handoff-exec" value={value.exec} onChange={(e) => onChange({ ...value, exec: e.target.value })} className={inputClass()}>
              {salesExecutives().map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted sm:col-span-2">Creates an enquiry for them with Day 2 / 3 / 4 follow-ups.</p>
        </div>
      )}
    </div>
  );
}

export function SendToSalesDialog({ task, onClose }: { task: CallTask; onClose: () => void }) {
  const [handoff, setHandoff] = useState<Handoff>(defaultHandoff);
  const { run, busy } = useAction();
  async function submit() {
    const ok = await run(() => pushToSales(task.id, handoff.branchId, handoff.exec), `${task.customer} sent to ${handoff.exec}`);
    if (ok) onClose();
  }
  return (
    <Dialog
      title="Send to sales"
      subtitle={`${task.customer} · +91 ${task.phone}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="success" className="flex-[2]" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to {handoff.exec.split(" ")[0]}
          </Button>
        </>
      }
    >
      <SalesHandoffFields value={handoff} onChange={setHandoff} optional={false} />
    </Dialog>
  );
}

// ---- new / edit entry ------------------------------------------------------------------

type InitialStatus = "pending" | "connected";

export function NewCallButton({ size = "md" }: { size?: "md" | "lg" }) {
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  if (!can("calls.manage")) return null;
  return (
    <>
      <Button variant="primary" size={size} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New Incoming Call
      </Button>
      {open && <InboundCallDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** New incoming call (no `task`) or quick edit of an existing entry. */
export function InboundCallDialog({ task, onClose }: { task?: CallTask; onClose: () => void }) {
  const editing = !!task;
  const { items } = callTasks.useItems();
  const now = useNow(30_000);
  const [form, setForm] = useState<InboundInput>({
    customer: task?.customer ?? "",
    phone: task?.phone ?? "",
    vehicleInterest: task?.vehicleInterest ?? "",
    source: task?.source ?? "inbound_call",
    notes: task?.notes ?? "",
  });
  const [status, setStatus] = useState<InitialStatus>("pending");
  const [outcome, setOutcome] = useState<Disposition>();
  const [outcomeNote, setOutcomeNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [handoff, setHandoff] = useState<Handoff>(defaultHandoff);
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();
  const set = <K extends keyof InboundInput>(k: K, v: InboundInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const connected = !editing && status === "connected";
  const errors = {
    customer: form.customer.trim().length >= 2 ? undefined : "Enter the customer's name",
    phone: /^[6-9]\d{9}$/.test(form.phone) ? undefined : form.phone ? "Enter a 10-digit mobile number" : "Required",
    outcome: connected && !outcome ? "Pick what happened on the call" : undefined,
    callback:
      connected && outcome === "callback" && (!callbackAt || new Date(callbackAt).getTime() < now - 60_000) ? "Pick a follow-up time in the future" : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  // Warn (don't block) when this number is already being worked.
  const duplicate = useMemo(
    () => (/^\d{10}$/.test(form.phone) ? items.find((t) => t.phone === form.phone && t.id !== task?.id && isActive(t)) : undefined),
    [items, form.phone, task?.id],
  );

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const handToSales = connected && outcome === "interested" && handoff.send;
    const ok = await run(
      async () => {
        if (editing) return updateInboundCall(task.id, form);
        // Check the sales pipeline first so a refused hand-off doesn't leave a half-saved entry.
        if (handToSales) await assertNoOpenLead(form.phone);
        const created = await addInboundCall(form, connected ? { disposition: outcome!, note: outcomeNote, callbackAt: outcome === "callback" ? callbackAt : undefined } : undefined);
        if (handToSales) await pushToSales(created.id, handoff.branchId, handoff.exec);
      },
      editing
        ? "Lead updated"
        : handToSales
          ? `${form.customer.trim()} logged and sent to ${handoff.exec}`
          : connected
            ? `Call logged for ${form.customer.trim()}`
            : `${form.customer.trim()} added to the call list`,
    );
    if (ok) onClose();
  }

  return (
    <Dialog
      wide
      title={editing ? "Edit lead" : "New incoming call"}
      subtitle={editing ? `${task.customer} · received ${formatDateTime(task.receivedAt ?? task.dueAt)}` : "Log it while the customer is on the line."}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : connected ? "Save call" : "Add to call list"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="in-name" required error={show("customer")}>
            <input id="in-name" autoFocus value={form.customer} onChange={(e) => set("customer", e.target.value)} autoComplete="off" className={inputClass(!!show("customer"))} />
          </Field>
          <Field label="Phone number" htmlFor="in-phone" required error={show("phone")}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">+91</span>
              <input
                id="in-phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98470 12345"
                className={cn(inputClass(!!show("phone")), "pl-12 tabular-nums")}
              />
            </div>
          </Field>
        </div>
        {duplicate && (
          <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            This number is already in the call list: <strong>{duplicate.customer}</strong> ({sourceLabel(duplicate.source ?? "inbound_call")}). You can still save if it&apos;s a new enquiry.
          </p>
        )}

        <Field label="Enquiry vehicle / model" htmlFor="in-vehicle" hint="Pick from the list or type anything, e.g. “Any scooter under ₹50k”">
          <input id="in-vehicle" list="vehicle-suggestions" value={form.vehicleInterest} onChange={(e) => set("vehicleInterest", e.target.value)} placeholder="e.g. Honda Activa 6G" className={inputClass()} />
          <datalist id="vehicle-suggestions">
            {VEHICLE_SUGGESTIONS.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>

        <Field label="Call type / source" required>
          <OptionGrid name="Call type / source" value={form.source} onChange={(v) => set("source", v)} options={CALL_SOURCES} />
        </Field>

        <Field label="Initial notes / requirement" htmlFor="in-notes">
          <textarea id="in-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Budget, variant, colour, exchange vehicle, finance…" className={textareaClass()} />
        </Field>

        {!editing && (
          <>
            <Field label="Initial call status" required>
              <Segmented
                name="Initial call status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "pending", label: "New / Needs callback" },
                  { value: "connected", label: "Connected & discussed" },
                ]}
              />
            </Field>
            {status === "pending" ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Timer className="size-3.5" /> Goes to the top of the call list. Call back within {SLA.inboundCallbackMinutes} minutes or it turns red.
              </p>
            ) : (
              <div className="anim-pop grid gap-4 rounded-2xl border border-line bg-sunken/40 p-3.5">
                <Field label="What happened on the call?" required error={show("outcome")}>
                  <OptionGrid name="Call outcome" value={outcome} onChange={setOutcome} options={CONNECTED_OUTCOMES} />
                </Field>
                {outcome === "callback" && (
                  <Field label="Follow-up at" htmlFor="in-callback" required error={show("callback")}>
                    <input id="in-callback" type="datetime-local" value={callbackAt} min={localInput(now)} onChange={(e) => setCallbackAt(e.target.value)} className={inputClass(!!show("callback"))} />
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
                <Field label="Discussion notes" htmlFor="in-outcome-note">
                  <textarea id="in-outcome-note" value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} placeholder="What did you agree?" className={textareaClass()} />
                </Field>
                {outcome === "interested" && <SalesHandoffFields value={handoff} onChange={setHandoff} />}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

// ---- live list ------------------------------------------------------------------------

const QUICK_STATUS: { value: Disposition; label: string }[] = [
  { value: "interested", label: "🟢 Connected · interested" },
  { value: "callback", label: "🔵 Follow-up scheduled" },
  { value: "no_answer", label: "⚪ No answer / busy" },
  { value: "not_interested", label: "🔴 Not interested · close" },
];

/** "Update status…" picker: opens the call card with the chosen outcome selected. */
export function StatusSelector({ task, onPick }: { task: CallTask; onPick: (d: Disposition) => void }) {
  return (
    <select
      aria-label={`Update status for ${task.customer}`}
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value as Disposition)}
      className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-muted transition hover:border-brand hover:text-ink"
    >
      <option value="">Update status…</option>
      {QUICK_STATUS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Most urgent first: late, due soon, overdue follow-ups, then the rest. */
function urgency(t: CallTask, now: number) {
  const tr = turnaround(t, now);
  if (tr?.state === "late") return 0;
  if (tr?.state === "soon") return 1;
  if (isOverdueCallback(t, now)) return 2;
  if (taskState(t) === "interested" && !t.handoff) return 3;
  if (isActive(t)) return 4;
  return 5;
}

export function InboundCallTable({ limit, title = "Incoming calls & new enquiries", status = "all" }: { limit?: number; title?: string; status?: CallStatus | "all" }) {
  const { can } = useRole();
  const { items, ready } = callTasks.useItems();
  const now = useNow(15_000);
  const [card, setCard] = useState<{ id: string; preset?: Disposition }>();
  const [editing, setEditing] = useState<string>();
  const [sending, setSending] = useState<string>();
  const manage = can("calls.manage");

  const recent = now - 3 * 24 * 3_600_000;
  const all = items
    .filter((t) => t.list === "inbound" && (isActive(t) || taskState(t) === "interested" || new Date(t.receivedAt ?? t.dueAt).getTime() > recent))
    .filter((t) => status === "all" || callStatus(t) === status)
    .sort((a, b) => urgency(a, now) - urgency(b, now) || (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
  const rows = limit ? all.slice(0, limit) : all;
  const late = all.filter((t) => rowTone(t, now) === "danger").length;
  const byId = (id?: string) => items.find((t) => t.id === id);

  function Actions({ t }: { t: CallTask }) {
    if (!manage) return <Button size="sm" onClick={() => setCard({ id: t.id })}>View</Button>;
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {isActive(t) && (
          <Button size="sm" variant={rowTone(t, now) === "danger" ? "danger" : "primary"} onClick={() => setCard({ id: t.id })}>
            <PhoneCall className="size-3.5" /> Call / Update status
          </Button>
        )}
        {taskState(t) === "interested" && !t.handoff && (
          <Button size="sm" variant="success" onClick={() => setSending(t.id)}>
            <Send className="size-3.5" /> Send to sales
          </Button>
        )}
        {!isActive(t) && (
          <Button size="sm" onClick={() => setCard({ id: t.id })}>
            View
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing(t.id)} aria-label={`Edit lead ${t.customer}`}>
          <Pencil className="size-3.5" /> Edit lead
        </Button>
      </div>
    );
  }

  function StatusCell({ t }: { t: CallTask }) {
    return (
      <div className="flex min-w-44 flex-col items-start gap-1.5">
        <CallStatusBadge task={t} />
        <TurnaroundPill task={t} now={now} />
        {manage && isActive(t) && <StatusSelector task={t} onPick={(preset) => setCard({ id: t.id, preset })} />}
      </div>
    );
  }

  const SourceCell = ({ t }: { t: CallTask }) => {
    const Icon = SOURCE_ICON[t.source ?? "inbound_call"];
    const at = t.receivedAt ?? t.dueAt;
    return (
      <div className="min-w-32 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-ink">
          <Icon className="size-3.5 text-brand" /> {sourceLabel(t.source ?? "inbound_call")}
        </span>
        <p className="text-muted">{formatDateTime(at)}</p>
        <p className="text-faint">{mins(now - new Date(at).getTime())} ago</p>
      </div>
    );
  };

  const columns: Column<CallTask>[] = [
    {
      header: "Customer",
      cell: (t) => (
        <div className="min-w-36">
          <p className="font-semibold">{t.customer}</p>
          <a href={`tel:+91${t.phone}`} className="text-xs text-brand tabular-nums hover:underline">
            +91 {t.phone}
          </a>
        </div>
      ),
    },
    {
      header: "Vehicle of interest",
      cell: (t) => (
        <div className="max-w-56 min-w-40 text-sm">
          <p>{t.vehicleInterest ?? "—"}</p>
          {t.notes && <p className="line-clamp-2 text-xs text-muted">{t.notes}</p>}
        </div>
      ),
    },
    { header: "Source & received", cell: (t) => <SourceCell t={t} /> },
    { header: "Current status", cell: (t) => <StatusCell t={t} /> },
    { header: "", align: "right", cell: (t) => <Actions t={t} /> },
  ];

  const cardTask = byId(card?.id);
  const editTask = byId(editing);
  const sendTask = byId(sending);

  return (
    <Panel
      flush
      title={`${title} · ${all.filter(isActive).length} open`}
      description={`Call back new calls within ${SLA.inboundCallbackMinutes} min and redial no-answers within ${SLA.noAnswerRetryMinutes / 60} h. Amber = due soon, red = late.`}
      tone={late ? "danger" : undefined}
      actions={<NewCallButton />}
    >
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        rowTone={(t) => rowTone(t, now)}
        empty={ready ? "No incoming calls yet. Tap “New Incoming Call” when the phone rings." : "Loading…"}
        card={(t) => (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{t.customer}</p>
                <a href={`tel:+91${t.phone}`} className="text-xs text-brand tabular-nums">
                  +91 {t.phone}
                </a>
                <p className="mt-1 text-sm">{t.vehicleInterest ?? "—"}</p>
                {t.notes && <p className="line-clamp-2 text-xs text-muted">{t.notes}</p>}
              </div>
              <SourceCell t={t} />
            </div>
            <StatusCell t={t} />
            <Actions t={t} />
          </>
        )}
      />
      {cardTask && <CustomerCardDialog task={cardTask} preset={card?.preset} onClose={() => setCard(undefined)} />}
      {editTask && <InboundCallDialog task={editTask} onClose={() => setEditing(undefined)} />}
      {sendTask && <SendToSalesDialog task={sendTask} onClose={() => setSending(undefined)} />}
    </Panel>
  );
}
