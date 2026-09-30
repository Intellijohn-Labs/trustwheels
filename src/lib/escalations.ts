import { SLA, branchName } from "./masters";
import { displayReg } from "./format";
import { formatDuration, verifyDeadline, verifyState } from "./verification";
import type { Vehicle } from "./types";
import type { Lead } from "./leads";
import { daysSinceSale, inRecon, isCodeRed, paymentDue, reconFlag, reconHours, transitBreached, transitHours } from "./workflow";

/*
 * Every open SLA breach in one list: what the Managing Partner and the Angamaly manager monitor.
 * Each source (vehicles, enquiries…) contributes items; severity drives the Code Red styling.
 */

export type EscalationKind = "code_red" | "transit" | "recon" | "verification" | "payment" | "follow_up";

export interface Escalation {
  id: string;
  kind: EscalationKind;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  href: string;
  /** How long it has been overdue, in ms (for sorting). */
  overdueMs: number;
  owner: string;
  branchId: string;
}

export const ESCALATION_KIND_LABEL: Record<EscalationKind, string> = {
  code_red: "Code Red delivery",
  transit: "Transit breach",
  recon: "Reconditioning RED",
  verification: "Verification overdue",
  payment: "Seller payment",
  follow_up: "Missed follow-up",
};

const HOUR = 3_600_000;
const name = (v: Vehicle) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;

export function vehicleEscalations(vehicles: Vehicle[], now: number): Escalation[] {
  const out: Escalation[] = [];
  for (const v of vehicles) {
    if (isCodeRed(v, now)) {
      const days = daysSinceSale(v, now);
      out.push({
        id: `cr-${v.id}`,
        kind: "code_red",
        severity: "critical",
        title: `Code Red · ${name(v)}`,
        detail: `Sold ${Math.floor(days)} days ago to ${v.sale!.customer.name}, not delivered (limit ${SLA.codeRedDays} days)${v.delivery?.released ? ". Released, awaiting handover" : ""}`,
        href: "/deliveries",
        overdueMs: (days - SLA.codeRedDays) * 24 * HOUR,
        owner: "Angamaly manager · Sales",
        branchId: v.branchId,
      });
    }
    if (transitBreached(v, now)) {
      const h = transitHours(v, now);
      out.push({
        id: `tr-${v.id}`,
        kind: "transit",
        severity: "critical",
        title: `Not received · ${name(v)}`,
        detail: `Dispatched from ${branchName(v.branchId)} ${formatDuration(h * HOUR)} ago with ${v.dispatch!.rider} (limit ${SLA.transitHours}h)`,
        href: "/transit",
        overdueMs: (h - SLA.transitHours) * HOUR,
        owner: "Branch manager · Angamaly administration",
        branchId: v.branchId,
      });
    }
    if (inRecon(v)) {
      const flag = reconFlag(v, now);
      if (flag !== "ok") {
        const h = reconHours(v, now);
        out.push({
          id: `rc-${v.id}`,
          kind: "recon",
          severity: flag === "red72" ? "critical" : "warning",
          title: `RED ${flag === "red72" ? SLA.reconRedHours : SLA.reconAmberHours}h · ${name(v)}`,
          detail: `${Math.floor(h)}h in reconditioning under ${v.recon!.supervisor}${v.recon!.completed ? ", waiting at the quality gate" : ""}`,
          href: "/recon",
          overdueMs: (h - SLA.reconAmberHours) * HOUR,
          owner: v.recon!.supervisor,
          branchId: v.branchId,
        });
      }
    }
    if (verifyState(v, now) === "overdue") {
      const late = now - verifyDeadline(v);
      out.push({
        id: `vf-${v.id}`,
        kind: "verification",
        severity: "warning",
        title: `Not verified · ${name(v)}`,
        detail: `Entered at ${branchName(v.branchId)}; overdue by ${formatDuration(late)} (limit ${SLA.verifyHours}h)`,
        href: "/overdue",
        overdueMs: late,
        owner: "Branch manager",
        branchId: v.branchId,
      });
    }
    const pay = paymentDue(v, now);
    if (pay && (pay.status === "overdue" || pay.status === "due-soon")) {
      out.push({
        id: `py-${v.id}`,
        kind: "payment",
        severity: pay.status === "overdue" ? "critical" : "warning",
        title: `Seller payment ${pay.status === "overdue" ? "overdue" : "due soon"} · ${name(v)}`,
        detail: `${v.seller.name}; due ${pay.due.split("-").reverse().join("/")} (${SLA.sellerPaymentWorkingDays} working days from verification)${pay.status === "due-soon" ? `, ${pay.workingDaysLeft} working day(s) left` : ""}`,
        href: "/payments",
        overdueMs: -pay.workingDaysLeft * 24 * HOUR,
        owner: "Branch accountant · Central accountant",
        branchId: v.branchId,
      });
    }
  }
  return out;
}

/** Missed Day 2 / 3 / 4 enquiry calls (from overdueFollowUps in leads.ts). */
export function followUpEscalations(overdue: { lead: Lead; day: number; closesAt: number }[], now: number): Escalation[] {
  return overdue.map(({ lead, day, closesAt }) => ({
    id: `fu-${lead.id}-${day}`,
    kind: "follow_up" as const,
    severity: "critical" as const,
    title: `Day ${day} call missed · ${lead.name}`,
    detail: `${lead.interest || "Enquiry"} · assigned to ${lead.assignedTo}; window closed ${formatDuration(now - closesAt)} ago`,
    href: "/enquiries",
    overdueMs: now - closesAt,
    owner: lead.assignedTo,
    branchId: lead.branchId,
  }));
}

export function sortEscalations(list: Escalation[]) {
  return [...list].sort((a, b) => (a.severity === b.severity ? b.overdueMs - a.overdueMs : a.severity === "critical" ? -1 : 1));
}
