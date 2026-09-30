import { defineCollection } from "./collections";
import { assertCan } from "./session";

/*
 * Capital put into each branch: the partner's contributions for the branches they fund,
 * the Managing Partner's own capital elsewhere. Read-only in this build (seeded).
 */

export interface Contribution {
  id: string;
  partner: string;
  branchId: string;
  amountPaise: number;
  at: string;
  note: string;
}

const DAY = 86_400_000;

function seedFunds(): Contribution[] {
  const now = Date.now();
  const at = (days: number) => new Date(now - days * DAY).toISOString();
  const L = 100_000_00; // ₹1 lakh in paise
  return [
    { id: "fund-1", partner: "Mathew Joseph", branchId: "b1", amountPaise: 6 * L, at: at(180), note: "Opening capital · Kothamangalam" },
    { id: "fund-2", partner: "Mathew Joseph", branchId: "b1", amountPaise: 2 * L, at: at(40), note: "Top-up for festival stock" },
    { id: "fund-3", partner: "Mathew Joseph", branchId: "b2", amountPaise: 5 * L, at: at(150), note: "Opening capital · Perumbavoor" },
    { id: "fund-4", partner: "Anoop", branchId: "b3", amountPaise: 4 * L, at: at(200), note: "Managing Partner capital" },
    { id: "fund-5", partner: "Anoop", branchId: "b4", amountPaise: 3 * L, at: at(120), note: "Managing Partner capital" },
    { id: "fund-6", partner: "Anoop", branchId: "b5", amountPaise: 3 * L, at: at(90), note: "Managing Partner capital" },
    { id: "fund-7", partner: "Anoop", branchId: "ang", amountPaise: 10 * L, at: at(220), note: "Hub working capital" },
  ];
}

export const funds = defineCollection<Contribution>("funds", seedFunds, 2, { supabaseTable: "funds" });

/** Permanently remove one capital contribution. Managing Partner only; every other role never sees the option. */
export function deleteFund(id: string) {
  assertCan("funds.delete");
  return funds.remove(id);
}

/** Permanently remove several capital contributions in one write, e.g. from a bulk selection. */
export function deleteFunds(ids: string[]) {
  assertCan("funds.delete");
  return funds.removeMany(ids);
}
