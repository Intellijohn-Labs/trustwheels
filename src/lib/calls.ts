"use client";

import { defineCollection, newId } from "./collections";
import { assertCan, getActor } from "./session";
import { istDate } from "./working-days";
import { SLA } from "./masters";
import { addLeadFromCall, type LeadSource } from "./leads";

/*
 * Telecalling: outbound call tasks grouped into lists, dispositions, callbacks and campaigns.
 * The system records calls; it does not dial.
 */

export type CallList = "inbound" | "new_enquiry" | "cold_lead" | "past_customer" | "service_due" | "campaign";
export type CallSource = "inbound_call" | "whatsapp" | "walk_in" | "website";
export type Disposition = "interested" | "not_interested" | "callback" | "wrong_number" | "purchased_elsewhere" | "no_answer";

export interface CallLog {
  at: string;
  disposition: Disposition;
  note: string;
  by: string;
}

export interface CallTask {
  id: string;
  customer: string;
  phone: string;
  list: CallList;
  campaignId?: string;
  vehicleInterest?: string;
  dueAt: string;
  callbackAt?: string;
  assignedTo: string;
  history: CallLog[];
  doNotCall?: boolean;
  // Incoming calls / new enquiries logged by the telecaller.
  source?: CallSource;
  receivedAt?: string;
  notes?: string; // initial requirement: budget, variant, exchange…
  createdBy?: string;
  handoff?: { leadId: string; to: string; branchId: string; at: string; by: string };
}

export interface Campaign {
  id: string;
  name: string;
  offer: string;
  model?: string;
  startsAt: string;
  endsAt: string;
  assignedTo: string;
  target: number;
}

export const CALL_LISTS: { value: CallList; label: string }[] = [
  { value: "inbound", label: "Incoming calls" },
  { value: "new_enquiry", label: "New enquiries" },
  { value: "cold_lead", label: "Cold leads" },
  { value: "past_customer", label: "Past customers" },
  { value: "service_due", label: "Service due" },
  { value: "campaign", label: "Campaign" },
];

export const DISPOSITIONS: { value: Disposition; label: string; closes?: boolean; connected: boolean }[] = [
  { value: "interested", label: "Interested", closes: true, connected: true },
  { value: "callback", label: "Call back later", connected: true },
  { value: "no_answer", label: "No answer / Busy", connected: false },
  { value: "not_interested", label: "Not interested", closes: true, connected: true },
  { value: "purchased_elsewhere", label: "Purchased elsewhere", closes: true, connected: true },
  { value: "wrong_number", label: "Wrong number", closes: true, connected: false },
];

export const CALL_SOURCES: { value: CallSource; label: string; lead: LeadSource }[] = [
  { value: "inbound_call", label: "Inbound call", lead: "phone" },
  { value: "whatsapp", label: "WhatsApp", lead: "whatsapp" },
  { value: "walk_in", label: "Walk-in enquiry", lead: "walk_in" },
  { value: "website", label: "Website", lead: "website" },
];
export const sourceLabel = (s: CallSource) => CALL_SOURCES.find((o) => o.value === s)?.label ?? s;

export const listLabel = (l: CallList) => CALL_LISTS.find((o) => o.value === l)?.label ?? l;
export const dispositionLabel = (d: Disposition) => DISPOSITIONS.find((o) => o.value === d)?.label ?? d;
export const isConnected = (d: Disposition) => DISPOSITIONS.find((o) => o.value === d)?.connected ?? false;

// ---- rules (pure) -------------------------------------------------------------------

const HOUR = 3_600_000;

export const lastCall = (t: CallTask) => t.history[t.history.length - 1];

export type TaskState = "open" | "callback" | "interested" | "closed" | "dnc";

/**
 * open: waiting to be called · callback: customer asked for a call at callbackAt ·
 * interested: handed to sales (task done) · closed: not interested / wrong number / bought elsewhere · dnc: do not call.
 */
export function taskState(t: CallTask): TaskState {
  if (t.doNotCall) return "dnc";
  const last = lastCall(t);
  if (last?.disposition === "interested") return "interested";
  if (last && DISPOSITIONS.find((d) => d.value === last.disposition)?.closes) return "closed";
  if (t.callbackAt) return "callback";
  return "open";
}

export const isActive = (t: CallTask) => taskState(t) === "open" || taskState(t) === "callback";

/** When the next call is due. */
export const nextCallAt = (t: CallTask) => new Date(t.callbackAt ?? t.dueAt).getTime();

export function endOfIstDay(now: number) {
  return new Date(`${istDate(now)}T23:59:59.999+05:30`).getTime();
}

export function startOfIstDay(now: number) {
  return new Date(`${istDate(now)}T00:00:00+05:30`).getTime();
}

/** Active tasks due by the end of today (includes carried-over and overdue callbacks). */
export function todaysCalls(tasks: CallTask[], now: number) {
  const end = endOfIstDay(now);
  return tasks.filter((t) => isActive(t) && nextCallAt(t) <= end).sort((a, b) => nextCallAt(a) - nextCallAt(b));
}

/** The five statuses shown to telecallers (badge, filter chips). */
export type CallStatus = "pending" | "followup" | "no_answer" | "interested" | "closed";

export const CALL_STATUSES: { value: CallStatus; label: string }[] = [
  { value: "pending", label: "Not called yet" },
  { value: "followup", label: "Follow-up scheduled" },
  { value: "no_answer", label: "No answer / Busy" },
  { value: "interested", label: "Interested" },
  { value: "closed", label: "Not interested / Closed" },
];

export function callStatus(t: CallTask): CallStatus {
  const state = taskState(t);
  if (state === "interested") return "interested";
  if (state === "closed" || state === "dnc") return "closed";
  if (state === "callback") return "followup";
  return lastCall(t)?.disposition === "no_answer" ? "no_answer" : "pending";
}

/** Unanswered dial attempts ("No answer / Busy"). */
export const attempts = (t: CallTask) => t.history.filter((h) => h.disposition === "no_answer").length;

/**
 * Turnaround for incoming calls that still need a call (new, or after no answer):
 * "late" once the target time has passed, "soon" in the last third of the window.
 */
export function turnaround(t: CallTask, now: number): { state: "ok" | "soon" | "late"; dueAt: number } | undefined {
  if (!t.source || taskState(t) !== "open") return undefined;
  const dueAt = new Date(t.dueAt).getTime();
  const windowMs = (attempts(t) ? SLA.noAnswerRetryMinutes : SLA.inboundCallbackMinutes) * 60_000;
  return { state: now > dueAt ? "late" : dueAt - now < windowMs / 3 ? "soon" : "ok", dueAt };
}

export const isOverdueCallback = (t: CallTask, now: number) => taskState(t) === "callback" && nextCallAt(t) < now;

/** Calls logged today, grouped by the person who made them. */
export function callStatsToday(tasks: CallTask[], now: number) {
  const today = istDate(now);
  const logs = tasks.flatMap((t) => t.history).filter((h) => istDate(h.at) === today);
  const people = new Map<string, { person: string; made: number; connected: number; interested: number }>();
  logs.forEach((h) => {
    const row = people.get(h.by) ?? { person: h.by, made: 0, connected: 0, interested: 0 };
    row.made++;
    if (isConnected(h.disposition)) row.connected++;
    if (h.disposition === "interested") row.interested++;
    people.set(h.by, row);
  });
  const rows = [...people.values()].sort((a, b) => b.made - a.made);
  const total = rows.reduce((s, r) => ({ ...s, made: s.made + r.made, connected: s.connected + r.connected, interested: s.interested + r.interested }), { person: "All", made: 0, connected: 0, interested: 0 });
  return { rows, total };
}

/** Called / interested / converted for one campaign. `convertedPhones` = customers who went on to book or buy. */
export function campaignProgress(c: Campaign, tasks: CallTask[], convertedPhones: Set<string>) {
  const mine = tasks.filter((t) => t.campaignId === c.id);
  const called = mine.filter((t) => t.history.length > 0).length;
  const interested = mine.filter((t) => t.history.some((h) => h.disposition === "interested")).length;
  const conversions = mine.filter((t) => convertedPhones.has(t.phone)).length;
  return { tasks: mine.length, called, interested, conversions, pct: c.target ? Math.min(1, called / c.target) : 0 };
}

/** No demo call lists or campaigns: this app runs on real data only. */
function seed(): { campaigns: Campaign[]; tasks: CallTask[] } {
  return { campaigns: [], tasks: [] };
}

export const callTasks = defineCollection<CallTask>("call-tasks", () => seed().tasks, 2, { supabaseTable: "calls" });
export const campaigns = defineCollection<Campaign>("campaigns", () => seed().campaigns, 1, { supabaseTable: "campaigns" });

// ---- mutations --------------------------------------------------------------------

export function logDisposition(id: string, disposition: Disposition, note: string, callbackAt?: string) {
  assertCan("calls.manage");
  if (disposition === "callback") {
    if (!callbackAt || Number.isNaN(new Date(callbackAt).getTime())) throw new Error("Pick a date and time for the callback");
  }
  return callTasks.update(id, (t) => {
    if (t.doNotCall) throw new Error("Blocked: this customer is on the do-not-call list");
    if (!isActive(t)) throw new Error("Blocked: this call task is already closed");
    const now = new Date();
    return {
      ...t,
      callbackAt: disposition === "callback" ? new Date(callbackAt!).toISOString() : undefined,
      // No answer: incoming calls are redialled within the retry target; other lists try again tomorrow.
      dueAt: disposition === "no_answer" ? new Date(now.getTime() + (t.source ? SLA.noAnswerRetryMinutes * 60_000 : 24 * HOUR)).toISOString() : t.dueAt,
      history: [...t.history, { at: now.toISOString(), disposition, note: note.trim(), by: getActor().name }],
    };
  });
}

export function setDoNotCall(id: string, doNotCall: boolean) {
  assertCan("calls.manage");
  return callTasks.update(id, (t) => ({ ...t, doNotCall }));
}

/** Permanently remove one call task. Managing Partner only; every other role never sees the option. */
export async function deleteCallTask(id: string) {
  assertCan("calls.delete");
  const all = await callTasks.all();
  if (!all.some((t) => t.id === id)) throw new Error("Call not found");
  await callTasks.remove(id);
}

/** Permanently remove several call tasks at once, e.g. from a bulk selection. */
export async function deleteCallTasks(ids: string[]) {
  assertCan("calls.delete");
  if (!ids.length) return;
  await callTasks.removeMany(ids);
}

/** Permanently remove one entry from a call's history. `index` is its position in `task.history`. */
export function deleteCallLog(id: string, index: number) {
  assertCan("calls.delete");
  return callTasks.update(id, (t) => {
    if (index < 0 || index >= t.history.length) throw new Error("Log entry not found");
    return { ...t, history: t.history.filter((_, i) => i !== index) };
  });
}

export interface NewCampaign {
  name: string;
  offer: string;
  model?: string;
  startsAt: string;
  endsAt: string;
  assignedTo: string;
  target: number;
}

export function addCampaign(input: NewCampaign) {
  assertCan("calls.manage");
  if (!input.name.trim()) throw new Error("Enter a campaign name");
  if (!input.offer.trim()) throw new Error("Describe the offer");
  if (!(input.target > 0)) throw new Error("Set a call target");
  if (new Date(input.endsAt) < new Date(input.startsAt)) throw new Error("The end date must be after the start date");
  return campaigns.add({ ...input, id: newId("camp"), name: input.name.trim(), offer: input.offer.trim(), model: input.model || undefined });
}

/** Permanently remove one campaign. Managing Partner only; every other role never sees the option. */
export function deleteCampaign(id: string) {
  assertCan("calls.delete");
  return campaigns.remove(id);
}

/** Move call tasks into a campaign's call list. */
export async function assignToCampaign(taskIds: string[], campaignId: string) {
  assertCan("calls.manage");
  if (!taskIds.length) throw new Error("Pick at least one customer");
  const all = await callTasks.all();
  await callTasks.replaceAll(all.map((t) => (taskIds.includes(t.id) ? { ...t, campaignId, list: "campaign" as const } : t)));
}

// ---- incoming calls / new enquiries --------------------------------------------------

export interface InboundInput {
  customer: string;
  phone: string;
  vehicleInterest: string;
  source: CallSource;
  notes: string;
}

function checkInbound(input: InboundInput) {
  if (input.customer.trim().length < 2) throw new Error("Enter the customer's name");
  if (!/^[6-9]\d{9}$/.test(input.phone)) throw new Error("Enter a 10-digit mobile number");
}

/**
 * Log a new incoming call. It joins the active call list straight away, due for a callback
 * within SLA.inboundCallbackMinutes. Pass `outcome` when the call was already connected and discussed.
 */
export async function addInboundCall(input: InboundInput, outcome?: { disposition: Disposition; note: string; callbackAt?: string }) {
  assertCan("calls.manage");
  checkInbound(input);
  const actor = getActor().name;
  const now = Date.now();
  const task = await callTasks.add({
    id: newId("call"),
    customer: input.customer.trim(),
    phone: input.phone,
    list: "inbound",
    source: input.source,
    vehicleInterest: input.vehicleInterest.trim() || undefined,
    notes: input.notes.trim() || undefined,
    receivedAt: new Date(now).toISOString(),
    dueAt: new Date(now + SLA.inboundCallbackMinutes * 60_000).toISOString(),
    assignedTo: actor,
    createdBy: actor,
    history: [],
  });
  return outcome ? logDisposition(task.id, outcome.disposition, outcome.note, outcome.callbackAt) : task;
}

/** Fix typos in an incoming-call entry (name, phone, vehicle, source, notes). */
export function updateInboundCall(id: string, input: InboundInput) {
  assertCan("calls.manage");
  checkInbound(input);
  return callTasks.update(id, (t) => ({
    ...t,
    customer: input.customer.trim(),
    phone: input.phone,
    source: input.source,
    vehicleInterest: input.vehicleInterest.trim() || undefined,
    notes: input.notes.trim() || undefined,
  }));
}

/** Push an interested caller into the sales pipeline as a new enquiry. */
export async function pushToSales(id: string, branchId: string, salesExecutive: string) {
  assertCan("calls.manage");
  const task = (await callTasks.all()).find((t) => t.id === id);
  if (!task) throw new Error("Call not found");
  if (taskState(task) !== "interested") throw new Error("Blocked: mark the call as Interested first");
  if (task.handoff) throw new Error(`Already sent to ${task.handoff.to}`);
  const lead = await addLeadFromCall({
    name: task.customer,
    phone: task.phone,
    source: CALL_SOURCES.find((s) => s.value === task.source)?.lead ?? "phone",
    branchId,
    interest: [task.vehicleInterest, task.notes].filter(Boolean).join(" · ") || "Interested (telecalling)",
    assignedTo: salesExecutive,
  });
  return callTasks.update(id, (t) => ({ ...t, handoff: { leadId: lead.id, to: salesExecutive, branchId, at: new Date().toISOString(), by: getActor().name } }));
}
