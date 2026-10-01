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

/** No demo capital contributions: this app runs on real entries only. */
function seedFunds(): Contribution[] {
  return [];
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
