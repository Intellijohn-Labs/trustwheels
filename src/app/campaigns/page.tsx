"use client";

import { useMemo, useState } from "react";
import { Loader2, Megaphone, Plus, UserPlus } from "lucide-react";
import { Button, EmptyState, Field, PageHeader, Panel, Pill, cn, inputClass, textareaClass } from "@/components/ui";
import { Dialog } from "@/components/panels/dialog";
import { CallTaskTable } from "@/components/panels/call-list";
import { useAction } from "@/components/toast";
import { formatDate } from "@/lib/format";
import { MAKES } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { telecallers } from "@/lib/user-names";
import { useScopedVehicles } from "@/lib/scoped";
import { useScopedLeads } from "@/lib/leads";
import { useNow } from "@/lib/use-now";
import { addCampaign, assignToCampaign, callTasks, campaignProgress, campaigns, isActive, listLabel, type Campaign } from "@/lib/calls";

const MODELS = Object.values(MAKES).flat();

function campaignStatus(c: Campaign, now: number) {
  if (now < new Date(c.startsAt).getTime()) return { label: "Upcoming", tone: "neutral" as const };
  if (now > new Date(c.endsAt).getTime()) return { label: "Ended", tone: "neutral" as const };
  return { label: "Live", tone: "ok" as const };
}

export default function CampaignsPage() {
  const { can } = useRole();
  const { items: list, ready } = campaigns.useItems();
  const { items: tasks } = callTasks.useItems();
  const { leads } = useScopedLeads();
  const { vehicles } = useScopedVehicles();
  const now = useNow(60_000);
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const manage = can("calls.manage");

  // Customers who went on to book or buy: enquiries marked booked, and vehicle buyers.
  const converted = useMemo(
    () => new Set([...leads.filter((l) => l.stage === "booked").map((l) => l.phone), ...vehicles.flatMap((v) => (v.sale ? [v.sale.customer.phone] : []))]),
    [leads, vehicles],
  );

  const sorted = [...list].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const active = sorted.find((c) => c.id === selected) ?? sorted[0];
  const campaignTasks = active ? tasks.filter((t) => t.campaignId === active.id) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Megaphone className="size-6 text-brand" />}
        title="Campaigns"
        description="Offer-driven call drives. Progress counts customers called against the target."
        actions={
          manage && (
            <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New campaign
            </Button>
          )
        }
      />

      {ready && sorted.length === 0 ? (
        <Panel>
          <EmptyState>No campaigns yet.</EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => {
            const p = campaignProgress(c, tasks, converted);
            const status = campaignStatus(c, now);
            const isActiveCard = active?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={isActiveCard}
                onClick={() => setSelected(c.id)}
                className={cn("rounded-2xl border bg-surface p-4 text-left transition hover:shadow-sm", isActiveCard ? "border-brand ring-2 ring-brand/20" : "border-line")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.offer}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatDate(c.startsAt)} – {formatDate(c.endsAt)} · {c.assignedTo}
                  {c.model && <> · {c.model}</>}
                </p>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span>
                    Called <span className="font-semibold tabular-nums">{p.called}</span>
                    <span className="text-muted"> / {c.target}</span>
                  </span>
                  <span className="text-xs text-muted tabular-nums">{Math.round(p.pct * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={`${c.name} progress`} aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={p.called}>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${p.pct * 100}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-sunken/70 py-1.5">
                    <dt className="text-muted">In list</dt>
                    <dd className="text-base font-semibold tabular-nums">{p.tasks}</dd>
                  </div>
                  <div className="rounded-lg bg-sunken/70 py-1.5">
                    <dt className="text-muted">Interested</dt>
                    <dd className="text-base font-semibold tabular-nums">{p.interested}</dd>
                  </div>
                  <div className="rounded-lg bg-sunken/70 py-1.5">
                    <dt className="text-muted">Converted</dt>
                    <dd className="text-base font-semibold tabular-nums">{p.conversions}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <CallTaskTable
          tasks={campaignTasks}
          now={now}
          title={`${active.name} · call list · ${campaignTasks.length}`}
          description={active.offer}
          actions={
            manage && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <UserPlus className="size-3.5" /> Add customers
              </Button>
            )
          }
          empty="No customers in this campaign yet."
        />
      )}

      {creating && <CampaignDialog onClose={() => setCreating(false)} onCreated={(id) => setSelected(id)} />}
      {adding && active && <AddToCampaignDialog campaign={active} onClose={() => setAdding(false)} />}
    </div>
  );
}

function toDateInput(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function CampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useRole();
  const [name, setName] = useState("");
  const [offer, setOffer] = useState("");
  const [model, setModel] = useState("");
  const [startsAt, setStartsAt] = useState(() => toDateInput(Date.now()));
  const [endsAt, setEndsAt] = useState(() => toDateInput(Date.now() + 14 * 86_400_000));
  const [assignedTo, setAssignedTo] = useState(telecallers().includes(user.name) ? user.name : telecallers()[0]);
  const [target, setTarget] = useState("30");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();

  const errors = {
    name: name.trim() ? undefined : "Required",
    offer: offer.trim() ? undefined : "Describe the offer",
    dates: endsAt >= startsAt ? undefined : "End date must be on or after the start date",
    target: Number(target) > 0 ? undefined : "Set a target",
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  async function submit() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    let id = "";
    const ok = await run(async () => {
      const c = await addCampaign({
        name,
        offer,
        model: model || undefined,
        startsAt: new Date(`${startsAt}T00:00:00+05:30`).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59+05:30`).toISOString(),
        assignedTo,
        target: Number(target),
      });
      id = c.id;
    }, "Campaign created");
    if (ok) {
      onCreated(id);
      onClose();
    }
  }

  return (
    <Dialog
      title="New campaign"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Create campaign
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" htmlFor="camp-name" required error={show("name")}>
          <input id="camp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali finance mela" className={inputClass(!!show("name"))} />
        </Field>
        <Field label="Offer" htmlFor="camp-offer" required error={show("offer")}>
          <textarea id="camp-offer" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="What the customer gets" className={textareaClass(!!show("offer"))} />
        </Field>
        <Field label="Model (optional)" htmlFor="camp-model">
          <select id="camp-model" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass()}>
            <option value="">Any model</option>
            {MODELS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="camp-start">
            <input id="camp-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass()} />
          </Field>
          <Field label="Ends" htmlFor="camp-end" error={show("dates")}>
            <input id="camp-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass(!!show("dates"))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned to" htmlFor="camp-owner">
            <select id="camp-owner" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass()}>
              {telecallers().map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Call target" htmlFor="camp-target" required error={show("target")}>
            <input id="camp-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass(!!show("target"))} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function AddToCampaignDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { items } = callTasks.useItems();
  const candidates = items.filter((t) => isActive(t) && !t.campaignId);
  const [picked, setPicked] = useState<string[]>([]);
  const { run, busy } = useAction();

  async function submit() {
    const ok = await run(() => assignToCampaign(picked, campaign.id), `${picked.length} added to ${campaign.name}`);
    if (ok) onClose();
  }

  return (
    <Dialog
      title="Add customers"
      subtitle={campaign.name}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={busy || picked.length === 0}>
            Add {picked.length || ""} to campaign
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <EmptyState>Every open call task is already in a campaign.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {candidates.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--brand)]"
                  checked={picked.includes(t.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{t.customer}</span>
                  <span className="block text-xs text-muted">
                    {listLabel(t.list)} · {t.phone}
                    {t.vehicleInterest && <> · {t.vehicleInterest}</>}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
