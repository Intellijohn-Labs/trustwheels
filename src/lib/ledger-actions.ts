import { ledger, postLedger, LEDGER_TYPE_LABEL } from "./ledger";
import { assertCan, getActor } from "./session";
import { settlements } from "./settlements";

/*
 * Corrections to the append-only ledger. Nothing is edited or deleted: a reversal is a
 * new entry with the negated amount pointing back at the original via `reversesId`.
 */

export async function reverseLedgerEntry(id: string, reason: string) {
  assertCan("ledger.reverse");
  const entries = await ledger.all();
  const original = entries.find((e) => e.id === id);
  if (!original) throw new Error("Entry not found");
  if (original.type === "reversal") throw new Error("Blocked: a reversal can't itself be reversed; post a fresh entry instead");
  if (entries.some((e) => e.reversesId === id)) throw new Error("Blocked: this entry has already been reversed");
  if (!reason.trim()) throw new Error("Enter the reason for the reversal");

  // A settlement is one transaction with two legs (hub out, branch in): reverse both together.
  const settlement = original.type === "settlement" ? (await settlements.all()).find((s) => s.ledgerIds?.includes(id)) : undefined;
  const legs = settlement ? entries.filter((e) => settlement.ledgerIds!.includes(e.id) && !entries.some((x) => x.reversesId === e.id)) : [original];

  const posted = [];
  for (const leg of legs)
    posted.push(
      await postLedger({
        branchId: leg.branchId,
        vehicleId: leg.vehicleId,
        type: "reversal",
        amountPaise: -leg.amountPaise,
        memo: `Reversal of ${LEDGER_TYPE_LABEL[leg.type]} (${leg.memo}) · ${reason.trim()}`,
        by: getActor().name,
        reversesId: leg.id,
      }),
    );
  return posted;
}
