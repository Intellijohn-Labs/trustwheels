"use client";

import { useMemo } from "react";
import { defineCollection, newId } from "./collections";
import { salesExecutives } from "./user-names";
import { SLA } from "./masters";
import { useRole } from "./role-context";
import { assertCan, getActor } from "./session";
import { useNow } from "./use-now";

/*
 * Sales enquiries (leads) and the Day 2 / 3 / 4 follow-up cadence.
 * The creation day is day 1; the day-N call is due during day N, i.e. in the window
 * createdAt + (N-1)*24h ... createdAt + N*24h. A call not logged by the end of its window
 * is overdue and escalated to the manager and the Managing Partner (Code Red).
 */

export type LeadSource = "walk_in" | "phone" | "website" | "whatsapp" | "facebook" | "instagram";
export type LeadStage = "new" | "contacted" | "test_ride" | "negotiation" | "booked" | "lost";
export type FollowUpDay = (typeof SLA.followUpDays)[number];
export type FollowUpOutcome = "interested" | "test_ride" | "call_back" | "no_answer" | "not_interested";

export interface FollowUp {
  day: FollowUpDay;
  at: string;
  outcome: FollowUpOutcome;
  note: string;
  by: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  branchId: string;
  vehicleId?: string;
  interest: string;
  assignedTo: string;
  createdAt: string;
  stage: LeadStage;
  lossReason?: string;
  followUps: FollowUp[];
}

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "test_ride", label: "Test ride" },
  { value: "negotiation", label: "Negotiation" },
  { value: "booked", label: "Booked" },
  { value: "lost", label: "Lost" },
];

export const FOLLOW_UP_OUTCOMES: { value: FollowUpOutcome; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "test_ride", label: "Test ride fixed" },
  { value: "call_back", label: "Asked to call back" },
  { value: "no_answer", label: "No answer" },
  { value: "not_interested", label: "Not interested" },
];

/** Configurable list; becomes an admin-editable master later. */
export const LOSS_REASONS = [
  "Bought elsewhere",
  "Price too high",
  "Finance not approved",
  "Wanted a different model",
  "Postponed purchase",
  "Not reachable",
];

export const sourceLabel = (s: LeadSource) => LEAD_SOURCES.find((o) => o.value === s)?.label ?? s;
export const stageLabel = (s: LeadStage) => LEAD_STAGES.find((o) => o.value === s)?.label ?? s;
export const outcomeLabel = (o: FollowUpOutcome) => FOLLOW_UP_OUTCOMES.find((x) => x.value === o)?.label ?? o;

// ---- follow-up rules (pure) -------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type FollowUpState = "done" | "due" | "upcoming" | "overdue" | "closed";

export interface FollowUpSlot {
  day: FollowUpDay;
  state: FollowUpState;
  opensAt: number;
  closesAt: number;
  log?: FollowUp;
}

export const isOpenLead = (lead: Lead) => lead.stage !== "booked" && lead.stage !== "lost";

/** The call window for day N: during day N counted from the enquiry (day 1). */
export function followUpWindow(lead: Lead, day: FollowUpDay) {
  const created = new Date(lead.createdAt).getTime();
  return { opensAt: created + (day - 1) * DAY, closesAt: created + day * DAY };
}

/**
 * State of each follow-up call: done (logged), due (window open now), upcoming,
 * overdue (window closed without a call), or closed (lead booked/lost before the call).
 */
export function followUpStatus(lead: Lead, now: number): FollowUpSlot[] {
  return SLA.followUpDays.map((day) => {
    const { opensAt, closesAt } = followUpWindow(lead, day);
    const log = lead.followUps.find((f) => f.day === day);
    const state: FollowUpState = log
      ? "done"
      : !isOpenLead(lead)
        ? "closed"
        : now > closesAt
          ? "overdue"
          : now >= opensAt
            ? "due"
            : "upcoming";
    return { day, state, opensAt, closesAt, log };
  });
}

/** The next call to make (overdue first), or undefined when the cadence is finished. */
export function nextFollowUp(lead: Lead, now: number) {
  return followUpStatus(lead, now).find((s) => s.state === "overdue" || s.state === "due" || s.state === "upcoming");
}

/** Every missed follow-up call on open leads: these are escalated to manager and Managing Partner. */
export function overdueFollowUps(leads: Lead[], now: number) {
  return leads.flatMap((lead) =>
    followUpStatus(lead, now)
      .filter((s) => s.state === "overdue")
      .map((s) => ({ lead, day: s.day, closesAt: s.closesAt })),
  );
}

/** Follow-up calls whose window is open right now. */
export function dueFollowUps(leads: Lead[], now: number) {
  return leads.flatMap((lead) =>
    followUpStatus(lead, now)
      .filter((s) => s.state === "due")
      .map((s) => ({ lead, day: s.day, closesAt: s.closesAt })),
  );
}

export interface ConversionRow {
  key: string;
  label: string;
  leads: number;
  booked: number;
  rate: number; // 0..1
}

export function conversionBy(leads: Lead[], keyOf: (l: Lead) => string, labelOf: (key: string) => string = (k) => k): ConversionRow[] {
  const groups = new Map<string, Lead[]>();
  leads.forEach((l) => groups.set(keyOf(l), [...(groups.get(keyOf(l)) ?? []), l]));
  return [...groups.entries()]
    .map(([key, ls]) => {
      const booked = ls.filter((l) => l.stage === "booked").length;
      return { key, label: labelOf(key), leads: ls.length, booked, rate: ls.length ? booked / ls.length : 0 };
    })
    .sort((a, b) => b.leads - a.leads);
}

/** No demo enquiries: this app runs on real leads only. */
function seedLeads(): Lead[] {
  return [];
}

export const leads = defineCollection<Lead>("leads", seedLeads, 1, { supabaseTable: "leads" });

// ---- mutations --------------------------------------------------------------------

export interface NewLead {
  name: string;
  phone: string;
  source: LeadSource;
  branchId: string;
  vehicleId?: string;
  interest: string;
  assignedTo?: string;
}

export async function addLead(input: NewLead) {
  assertCan("leads.manage");
  return createLead(input);
}

/** Telecaller hands an interested caller to the sales pipeline. Refuses a duplicate open enquiry. */
export async function addLeadFromCall(input: NewLead) {
  assertCan("calls.manage");
  await assertNoOpenLead(input.phone);
  return createLead(input);
}

/** Throws if this number already has an open sales enquiry (checked before anything is saved). */
export async function assertNoOpenLead(phone: string) {
  const open = (await leads.all()).find((l) => l.phone === phone && l.stage !== "booked" && l.stage !== "lost");
  if (open) throw new Error(`Blocked: ${open.name} is already in the sales pipeline (assigned to ${open.assignedTo})`);
}

async function createLead(input: NewLead) {
  if (!input.name.trim()) throw new Error("Enter the customer's name");
  if (!/^[6-9]\d{9}$/.test(input.phone)) throw new Error("Enter a 10-digit mobile number");
  if (!input.vehicleId && !input.interest.trim()) throw new Error("Pick a vehicle or describe what they are looking for");
  const actor = getActor();
  return leads.add({
    id: newId("lead"),
    name: input.name.trim(),
    phone: input.phone,
    source: input.source,
    branchId: input.branchId,
    vehicleId: input.vehicleId || undefined,
    interest: input.interest.trim(),
    assignedTo: input.assignedTo ?? (salesExecutives().includes(actor.name) ? actor.name : salesExecutives()[0]),
    createdAt: new Date().toISOString(),
    stage: "new",
    followUps: [],
  });
}

const STAGE_AFTER: Partial<Record<FollowUpOutcome, LeadStage>> = { interested: "contacted", call_back: "contacted", test_ride: "test_ride" };
const STAGE_ORDER: LeadStage[] = ["new", "contacted", "test_ride", "negotiation", "booked"];

export function logFollowUp(id: string, day: FollowUpDay, outcome: FollowUpOutcome, note: string) {
  assertCan("leads.manage");
  return leads.update(id, (lead) => {
    if (!isOpenLead(lead)) throw new Error(`Blocked: this enquiry is ${lead.stage}`);
    if (lead.followUps.some((f) => f.day === day)) throw new Error(`Day ${day} call is already logged`);
    const slot = followUpStatus(lead, Date.now()).find((s) => s.day === day)!;
    if (slot.state === "upcoming") throw new Error(`Blocked: the day ${day} call window has not opened yet`);
    const next = STAGE_AFTER[outcome];
    const stage = next && STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(lead.stage) ? next : lead.stage;
    return {
      ...lead,
      stage,
      followUps: [...lead.followUps, { day, at: new Date().toISOString(), outcome, note: note.trim(), by: getActor().name }].sort((a, b) => a.day - b.day),
    };
  });
}

export function setStage(id: string, stage: LeadStage, lossReason?: string) {
  assertCan("leads.manage");
  if (stage === "lost" && !lossReason?.trim()) throw new Error("Pick a reason the enquiry was lost");
  return leads.update(id, (lead) => ({ ...lead, stage, lossReason: stage === "lost" ? lossReason!.trim() : undefined }));
}

/** Permanently remove one enquiry. Managing Partner only; every other role never sees the option. */
export function deleteLead(id: string) {
  assertCan("leads.delete");
  return leads.remove(id);
}

/** Permanently remove several enquiries in one write, e.g. from a bulk selection. */
export function deleteLeads(ids: string[]) {
  assertCan("leads.delete");
  return leads.removeMany(ids);
}

/**
 * Called by stock-store's deleteVehicle(s) after a vehicle is gone, so no enquiry keeps pointing
 * at a vehicle that no longer exists. Clears the dangling reference only - the enquiry itself
 * (customer, follow-up history) is a separate record and stays untouched. Internal: the caller's
 * own `stock.delete` check already authorizes the cascade, so this doesn't re-check `leads.manage`.
 */
export async function clearVehicleReferences(vehicleIds: string[]) {
  if (!vehicleIds.length) return;
  const ids = new Set(vehicleIds);
  const affected = (await leads.all()).filter((l) => l.vehicleId && ids.has(l.vehicleId));
  await Promise.all(affected.map((l) => leads.update(l.id, (lead) => ({ ...lead, vehicleId: undefined }))));
}

// ---- hooks -----------------------------------------------------------------------

/** Leads within the signed-in role's branch scope. */
export function useScopedLeads() {
  const { items, ready } = leads.useItems();
  const { inScope } = useRole();
  const scoped = useMemo(() => items.filter((l) => inScope(l.branchId)), [items, inScope]);
  return { leads: scoped, ready };
}

/** For a sidebar badge on /enquiries (and /escalations). */
export function useOverdueFollowUpCount() {
  const { leads: mine } = useScopedLeads();
  const now = useNow(30_000);
  return overdueFollowUps(mine, now).length;
}
