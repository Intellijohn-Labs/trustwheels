"use client";

import { useEffect } from "react";
import { defineCollection, newId } from "./collections";
import { ledger, postLedger, type LedgerEntry } from "./ledger";
import { BRANCHES, branchName } from "./masters";
import { seedVehicles } from "./seed";
import { assertCan, getActor } from "./session";
import type { Vehicle } from "./types";

/*
 * Branch <-> Angamaly settlements. The source branch pays the seller; once the vehicle is
 * received at Angamaly, the hub owes the branch that purchase value. A settlement records
 * the hub paying some of it back, and posts both sides to the ledger
 * (hub out, branch in).
 */

export interface Settlement {
  id: string;
  branchId: string;
  amountPaise: number;
  at: string;
  by: string;
  reference: string;
  note: string;
  /** The two ledger legs (hub out, branch in) this settlement posted. */
  ledgerIds?: string[];
}

const HOUR = 3_600_000;

/** Seed: the hub has settled every vehicle it received more than ~10 days ago. */
function seedSettlements(): Settlement[] {
  const now = Date.now();
  const cutoff = now - 250 * HOUR;
  const byBranch = new Map<string, number>();
  for (const v of seedVehicles(now)) {
    if (v.receipt && v.purchase && new Date(v.receipt.at).getTime() < cutoff) byBranch.set(v.branchId, (byBranch.get(v.branchId) ?? 0) + v.purchase.netPayablePaise);
  }
  return [...byBranch.entries()].map(([branchId, amountPaise], i) => ({
    id: `st-seed-${branchId}`,
    branchId,
    amountPaise,
    at: new Date(now - (200 - i * 20) * HOUR).toISOString(),
    by: "Lakshmi Iyer",
    reference: `NEFT${880200 + i}`,
    note: `Settlement for vehicles received at Angamaly · ${branchName(branchId)}`,
    ledgerIds: [`le-st-seed-${branchId}-ang`, `le-st-seed-${branchId}-br`],
  }));
}

export const settlements = defineCollection<Settlement>("settlements", seedSettlements, 3);

function ledgerPair(s: Settlement): Omit<LedgerEntry, "id">[] {
  const memo = `Settlement ${s.reference} · Angamaly → ${branchName(s.branchId)}`;
  return [
    { at: s.at, branchId: "ang", type: "settlement", amountPaise: -s.amountPaise, memo, by: s.by },
    { at: s.at, branchId: s.branchId, type: "settlement", amountPaise: s.amountPaise, memo, by: s.by },
  ];
}

let backfilled: Promise<void> | null = null;

/**
 * The ledger's own seed predates settlements, so the seeded settlements are appended
 * to it once (idempotent: keyed by settlement id). Appends only; nothing is edited.
 */
function backfillSeedLedger() {
  backfilled ??= (async () => {
    const [items, entries] = await Promise.all([settlements.all(), ledger.all()]);
    const missing = items
      .filter((s) => s.id.startsWith("st-seed-"))
      .flatMap((s) => ledgerPair(s).map((e, i) => ({ ...e, id: `le-${s.id}-${i ? "br" : "ang"}` })))
      .filter((e) => !entries.some((x) => x.id === e.id));
    if (missing.length) await ledger.replaceAll([...entries, ...missing].sort((a, b) => b.at.localeCompare(a.at)));
  })();
  return backfilled;
}

export function useSettlements() {
  const result = settlements.useItems();
  useEffect(() => {
    backfillSeedLedger();
  }, []);
  return result;
}

export async function recordSettlement(branchId: string, amountPaise: number, reference: string, note: string) {
  assertCan("settlement.record");
  if (!BRANCHES.some((b) => b.id === branchId) || branchId === "ang") throw new Error("Choose the branch being settled");
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) throw new Error("Enter the settlement amount");
  if (!reference.trim()) throw new Error("Enter the payment reference (UTR / cheque no.)");
  const s: Settlement = { id: newId("st"), branchId, amountPaise: Math.round(amountPaise), at: new Date().toISOString(), by: getActor().name, reference: reference.trim(), note: note.trim() };
  const ledgerIds: string[] = [];
  for (const e of ledgerPair(s)) ledgerIds.push((await postLedger(e)).id);
  return settlements.add({ ...s, ledgerIds });
}

// ---- positions ------------------------------------------------------------------------

export interface BranchPosition {
  branchId: string;
  name: string;
  /** Vehicles received at Angamaly from this branch. */
  vehicles: number;
  duePaise: number;
  settledPaise: number;
  outstandingPaise: number;
  lastSettlement?: Settlement;
}

/** A settlement whose ledger legs were reversed no longer counts. */
export function isSettlementReversed(s: Settlement, reversed: Set<string>) {
  return !!s.ledgerIds?.some((id) => reversed.has(id));
}

/** Amount Angamaly owes each branch: purchase value of vehicles it has received, less (unreversed) settlements. */
export function branchPositions(vehicles: Vehicle[], all: Settlement[], branchIds: string[], reversed = new Set<string>()): BranchPosition[] {
  const items = all.filter((s) => !isSettlementReversed(s, reversed));
  return branchIds.map((branchId) => {
    const received = vehicles.filter((v) => v.branchId === branchId && v.receipt && v.purchase);
    const duePaise = received.reduce((sum, v) => sum + v.purchase!.netPayablePaise, 0);
    const mine = items.filter((s) => s.branchId === branchId).sort((a, b) => b.at.localeCompare(a.at));
    const settledPaise = mine.reduce((sum, s) => sum + s.amountPaise, 0);
    return { branchId, name: branchName(branchId), vehicles: received.length, duePaise, settledPaise, outstandingPaise: duePaise - settledPaise, lastSettlement: mine[0] };
  });
}
