import { defineCollection, newId } from "./collections";
import { seedVehicles } from "./seed";
import { reconCostPaise } from "./workflow";

/*
 * Append-only transaction ledger. Entries are never edited or deleted; a correction is a
 * new "reversal" entry pointing at the original. Amounts are signed paise:
 * positive = money in, negative = money out.
 */

export type LedgerType =
  | "seller_payment"
  | "recon_cost"
  | "transport"
  | "booking"
  | "sale_receipt"
  | "transfer_fee"
  | "settlement"
  | "capital"
  | "reversal";

export interface LedgerEntry {
  id: string;
  at: string;
  branchId: string; // branch the money belongs to ("ang" for the hub)
  vehicleId?: string;
  type: LedgerType;
  amountPaise: number;
  memo: string;
  by: string;
  reversesId?: string;
}

export const LEDGER_TYPE_LABEL: Record<LedgerType, string> = {
  seller_payment: "Seller payment",
  recon_cost: "Reconditioning",
  transport: "Transport",
  booking: "Booking advance",
  sale_receipt: "Sale receipt",
  transfer_fee: "RTO / transfer fee",
  settlement: "Branch settlement",
  capital: "Partner capital",
  reversal: "Reversal",
};

function seedLedger(): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const push = (e: Omit<LedgerEntry, "id">) => entries.push({ id: `le-${entries.length + 1}`, ...e });
  for (const v of seedVehicles()) {
    const label = `${v.make} ${v.model} (${v.registrationNo})`;
    const paid = v.purchase?.payout.paid;
    if (paid) push({ at: paid.at, branchId: v.branchId, vehicleId: v.id, type: "seller_payment", amountPaise: -v.purchase!.netPayablePaise, memo: `Seller payout · ${label}`, by: paid.by });
    if (v.dispatch) push({ at: v.dispatch.handoverAt, branchId: v.branchId, vehicleId: v.id, type: "transport", amountPaise: -60000, memo: `Rider to Angamaly · ${label}`, by: v.dispatch.by });
    if (v.gate) push({ at: v.gate.at, branchId: "ang", vehicleId: v.id, type: "recon_cost", amountPaise: -reconCostPaise(v), memo: `Job card · ${label}`, by: v.gate.by });
    if (v.sale?.bookedAt) push({ at: v.sale.bookedAt, branchId: "ang", vehicleId: v.id, type: "booking", amountPaise: v.sale.bookingAmountPaise ?? 0, memo: `Booking · ${v.sale.customer.name} · ${label}`, by: v.sale.by });
    if (v.sale?.soldAt && v.sale.salePricePaise)
      push({ at: v.sale.soldAt, branchId: "ang", vehicleId: v.id, type: "sale_receipt", amountPaise: v.sale.salePricePaise - (v.sale.bookingAmountPaise ?? 0), memo: `Balance received · ${label}`, by: v.sale.by });
    const fee = v.delivery?.feePayment;
    if (fee?.paid) push({ at: fee.paid.at, branchId: "ang", vehicleId: v.id, type: "transfer_fee", amountPaise: -(v.delivery!.transferFeePaise ?? 0), memo: `RTO transfer fee · ${label}`, by: fee.paid.by });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export const ledger = defineCollection<LedgerEntry>("ledger", seedLedger, 5);

export function postLedger(entry: Omit<LedgerEntry, "id" | "at"> & { at?: string }) {
  return ledger.add({ id: newId("le"), at: entry.at ?? new Date().toISOString(), ...entry });
}
