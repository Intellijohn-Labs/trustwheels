"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "./dialog";
import { Button, Field, cn, inputClass, textareaClass } from "../ui";
import { useAction } from "../toast";
import { BRANCHES } from "@/lib/masters";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import {
  FOLLOW_UP_OUTCOMES,
  LEAD_SOURCES,
  LEAD_STAGES,
  LOSS_REASONS,
  addLead,
  logFollowUp,
  outcomeLabel,
  setStage,
  sourceLabel,
  type FollowUpDay,
  type FollowUpOutcome,
  type Lead,
  type LeadSource,
  type LeadStage,
} from "@/lib/leads";

const PHONE = /^[6-9]\d{9}$/;

/** New enquiry: walk-in, phone, website or social. */
export function EnquiryDialog({ onClose }: { onClose: () => void }) {
  const { inScope, user } = useRole();
  const branches = BRANCHES.filter((b) => inScope(b.id));

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("walk_in");
  const [branchId, setBranchId] = useState<string>(branches.find((b) => b.id === user.base)?.id ?? branches[0]?.id ?? "ang");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();

  const errors = {
    name: name.trim() ? undefined : "Required",
    phone: PHONE.test(phone) ? undefined : phone ? "Enter a 10-digit mobile number" : "Required",
    interest: interest.trim() ? undefined : "Required",
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  async function submit() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const ok = await run(() => addLead({ name, phone, source, branchId, interest }), `Enquiry added · day 2 call due tomorrow`);
    if (ok) onClose();
  }

  return (
    <Dialog
      title="New enquiry"
      subtitle="Day 2, 3 and 4 follow-up calls are scheduled automatically."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Save enquiry
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Customer name" htmlFor="lead-name" required error={show("name")}>
          <input id="lead-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass(!!show("name"))} />
        </Field>
        <Field label="Mobile number" htmlFor="lead-phone" required error={show("phone")}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">+91</span>
            <input
              id="lead-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={cn(inputClass(!!show("phone")), "pl-12 tabular-nums")}
            />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" htmlFor="lead-source">
            <select id="lead-source" value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={inputClass()}>
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" htmlFor="lead-branch">
            <select id="lead-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass()}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Vehicle interested" htmlFor="lead-interest" required error={show("interest")}>
          <input
            id="lead-interest"
            type="text"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            autoComplete="off"
            placeholder="e.g. Pulsar 150, Activa..."
            className={inputClass(!!show("interest"))}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** Log the day-N follow-up call for an enquiry. */
export function LogCallDialog({ lead, day, onClose }: { lead: Lead; day: FollowUpDay; onClose: () => void }) {
  const [outcome, setOutcome] = useState<FollowUpOutcome>();
  const [note, setNote] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();

  const errors = {
    outcome: outcome ? undefined : "Pick what happened on the call",
    loss: outcome === "not_interested" && !lossReason ? "Pick a reason" : undefined,
  };

  async function submit() {
    setSubmitted(true);
    if (!outcome || errors.loss) return;
    const ok = await run(async () => {
      await logFollowUp(lead.id, day, outcome, note);
      if (outcome === "not_interested") await setStage(lead.id, "lost", lossReason);
    }, `Day ${day} call logged for ${lead.name}`);
    if (ok) onClose();
  }

  return (
    <Dialog
      title={`Log day ${day} call`}
      subtitle={
        <>
          {lead.name} ·{" "}
          <a href={`tel:+91${lead.phone}`} className="font-medium text-brand tabular-nums">
            +91 {lead.phone}
          </a>
        </>
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Save call
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="rounded-xl bg-sunken px-3.5 py-2.5 text-sm">
          <span className="text-muted">Interested in:</span> {lead.interest || "—"} · <span className="text-muted">{sourceLabel(lead.source)}</span>
        </p>
        {lead.followUps.length > 0 && (
          <ul className="space-y-1 text-sm">
            {lead.followUps.map((f) => (
              <li key={f.day} className="text-muted">
                <span className="font-medium text-ink">Day {f.day}</span> · {outcomeLabel(f.outcome)} · {formatDateTime(f.at)}
                {f.note && <> · “{f.note}”</>}
              </li>
            ))}
          </ul>
        )}
        <Field label="Outcome" required error={submitted ? errors.outcome : undefined}>
          <OptionGrid name="Outcome" value={outcome} onChange={setOutcome} options={FOLLOW_UP_OUTCOMES} />
        </Field>
        {outcome === "not_interested" && (
          <Field label="Why was it lost?" htmlFor="loss-reason" required error={submitted ? errors.loss : undefined} hint="The enquiry is closed as lost.">
            <select id="loss-reason" value={lossReason} onChange={(e) => setLossReason(e.target.value)} className={inputClass(submitted && !!errors.loss)}>
              <option value="">Select a reason</option>
              {LOSS_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Note" htmlFor="call-note">
          <textarea id="call-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did the customer say?" className={textareaClass()} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Move an enquiry along the pipeline (or close it as lost). */
export function StageDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [stage, setStageValue] = useState<LeadStage>(lead.stage);
  const [lossReason, setLossReason] = useState(lead.lossReason ?? "");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();
  const lossError = stage === "lost" && !lossReason ? "Pick a reason" : undefined;

  async function submit() {
    setSubmitted(true);
    if (lossError) return;
    const ok = await run(() => setStage(lead.id, stage, lossReason), `${lead.name}: stage updated`);
    if (ok) onClose();
  }

  return (
    <Dialog
      title="Update stage"
      subtitle={lead.name}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Stage">
          <OptionGrid name="Stage" value={stage} onChange={setStageValue} options={LEAD_STAGES} />
        </Field>
        {stage === "lost" && (
          <Field label="Loss reason" htmlFor="stage-loss" required error={submitted ? lossError : undefined}>
            <select id="stage-loss" value={lossReason} onChange={(e) => setLossReason(e.target.value)} className={inputClass(submitted && !!lossError)}>
              <option value="">Select a reason</option>
              {LOSS_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/** Radio buttons laid out as a wrapping grid (for more options than a Segmented fits). */
export function OptionGrid<T extends string>({ name, value, onChange, options }: { name: string; value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
            value === o.value ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink hover:bg-sunken",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
