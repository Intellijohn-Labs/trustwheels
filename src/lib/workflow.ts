import { SLA, TRANSFER_STEPS } from "./masters";
import type { Vehicle } from "./types";
import { addWorkingDays, istDate, workingDaysUntil } from "./working-days";

/*
 * Pure business rules derived from a vehicle. The store enforces the gates with these
 * (as the API will), and screens use the same functions to explain why something is blocked.
 */

const HOUR = 3_600_000;
const t = (iso: string) => new Date(iso).getTime();

// ---- delivery gate -------------------------------------------------------------

export function transferProgress(v: Vehicle) {
  const done = TRANSFER_STEPS.filter((s) => v.delivery?.transfer[s.id]).length;
  return { done, total: TRANSFER_STEPS.length, complete: done === TRANSFER_STEPS.length };
}

/** Why the Angamaly manager can't release this vehicle for delivery yet. Empty = releasable. */
export function releaseBlockers(v: Vehicle): string[] {
  const reasons: string[] = [];
  if (v.sale?.status !== "sold") reasons.push("Sale not completed (balance not received)");
  if (v.sale && !v.sale.docsVerified) reasons.push("Booking documents not signed off by sales");
  const missing = TRANSFER_STEPS.filter((s) => !v.delivery?.transfer[s.id]);
  if (missing.length) reasons.push(`Ownership transfer incomplete: ${missing.map((m) => m.label).join("; ")}`);
  if (v.delivery?.released) reasons.push("Already released");
  return reasons;
}

/** Why the sales executive can't record the handover yet. Empty = can deliver. */
export function handoverBlockers(v: Vehicle): string[] {
  if (v.delivery?.delivered) return ["Already delivered"];
  const reasons = releaseBlockers(v).filter((r) => r !== "Already released");
  if (!v.delivery?.released) reasons.push("Awaiting final release by the Angamaly manager");
  return reasons;
}

// ---- SLA indicators --------------------------------------------------------------

/** Days since the sale, while the vehicle is still undelivered. */
export function daysSinceSale(v: Vehicle, now: number) {
  if (!v.sale?.soldAt || v.delivery?.delivered) return 0;
  return (now - t(v.sale.soldAt)) / (24 * HOUR);
}

export function isCodeRed(v: Vehicle, now: number) {
  return daysSinceSale(v, now) > SLA.codeRedDays;
}

export function inTransit(v: Vehicle) {
  return !!v.dispatch && !v.receipt;
}

export function transitHours(v: Vehicle, now: number) {
  if (!v.dispatch) return 0;
  return ((v.receipt ? t(v.receipt.at) : now) - t(v.dispatch.handoverAt)) / HOUR;
}

export function transitBreached(v: Vehicle, now: number) {
  return inTransit(v) && transitHours(v, now) > SLA.transitHours;
}

/**
 * Where the vehicle physically is right now: its origin branch until it's booked in at the
 * destination, then the destination. `branchId` itself never changes - it stays the vehicle's
 * permanent home/source branch, which settlements, branch performance and sales reports key off.
 */
export function currentBranchId(v: Vehicle): string {
  return v.receipt ? (v.dispatch?.to ?? "ang") : v.branchId;
}

/** Reconditioning clock runs from stock entry until the manager's quality-gate sign-off. */
export function reconHours(v: Vehicle, now: number) {
  if (!v.recon) return 0;
  return ((v.gate ? t(v.gate.at) : now) - t(v.recon.startedAt)) / HOUR;
}

export type ReconFlag = "ok" | "red48" | "red72";

export function reconFlag(v: Vehicle, now: number): ReconFlag {
  const h = reconHours(v, now);
  return h > SLA.reconRedHours ? "red72" : h > SLA.reconAmberHours ? "red48" : "ok";
}

// Stage 8 specifically, not just "has a recon record": once a job card is signed off,
// completeRecon() reverts `stage` to 7 (general stock evaluation) even though the recon record
// itself (items, photos, cost) is kept, so these two stay scoped to a vehicle still actually
// sitting at the gate.
export function inRecon(v: Vehicle) {
  return !!v.recon && !v.gate && v.stage === 8;
}

export function awaitingGate(v: Vehicle) {
  return !!v.recon?.completed && !v.gate && v.stage === 8;
}

// ---- seller payment (7 working days from cross-verification) -----------------------

export function paymentDue(v: Vehicle, now: number) {
  if (!v.verified) return undefined;
  const due = addWorkingDays(v.verified.at, SLA.sellerPaymentWorkingDays);
  const paid = v.purchase?.payout.status === "paid";
  const left = workingDaysUntil(due, now);
  return {
    due, // YYYY-MM-DD
    workingDaysLeft: left,
    paid,
    status: paid ? ("paid" as const) : istDate(now) > due ? ("overdue" as const) : left <= 2 ? ("due-soon" as const) : ("on-track" as const),
  };
}

// ---- money -----------------------------------------------------------------------

export function reconCostPaise(v: Vehicle) {
  return v.recon?.items.reduce((sum, i) => sum + i.costPaise, 0) ?? 0;
}

/** What the vehicle has cost the business so far. */
export function landedCostPaise(v: Vehicle) {
  const purchase = v.purchase?.netPayablePaise ?? v.agreedValuePaise;
  return purchase + reconCostPaise(v) + (v.delivery?.transferFeePaise ?? 0);
}

export function marginPaise(v: Vehicle) {
  return v.sale?.salePricePaise != null ? v.sale.salePricePaise - landedCostPaise(v) : undefined;
}
