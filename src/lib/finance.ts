"use client";

import { useMemo } from "react";
import { ledger, type LedgerEntry } from "./ledger";
import { useRole } from "./role-context";
import type { Vehicle } from "./types";
import { landedCostPaise, marginPaise } from "./workflow";
import { istDate } from "./working-days";
import { formatPaise } from "./format";

/*
 * Finance selectors shared by the finance pages, dashboards and reports. Pure functions
 * over vehicles / ledger entries, plus the scoped ledger hook.
 */

const DAY = 86_400_000;

/** Money with an explicit minus for losses: "−₹2,500" (formatPaise alone gives "₹-2,500"). */
export function formatSignedPaise(paise: number) {
  return paise < 0 ? `−${formatPaise(-paise)}` : formatPaise(paise);
}

/** Ledger entries the signed-in role may see. Hub ("ang") entries need group-wide scope. */
export function useScopedLedger() {
  const { items, ready } = ledger.useItems();
  const { inScope } = useRole();
  const entries = useMemo(() => items.filter((e) => inScope(e.branchId)).sort((a, b) => b.at.localeCompare(a.at)), [items, inScope]);
  return { entries, ready };
}

/** Ids of entries that have been reversed. */
export function reversedIds(entries: LedgerEntry[]) {
  return new Set(entries.filter((e) => e.reversesId).map((e) => e.reversesId!));
}

export function totals(entries: LedgerEntry[]) {
  let inPaise = 0;
  let outPaise = 0;
  for (const e of entries) {
    if (e.amountPaise >= 0) inPaise += e.amountPaise;
    else outPaise -= e.amountPaise;
  }
  return { inPaise, outPaise, netPaise: inPaise - outPaise };
}

// ---- payouts -------------------------------------------------------------------------

export type PayoutStage = "awaiting-entry" | "requested" | "approved" | "paid";

export function payoutStage(v: Vehicle): PayoutStage | undefined {
  if (!v.verified) return undefined;
  return v.purchase?.payout.status ?? "awaiting-entry";
}

export const PAYOUT_STAGE_LABEL: Record<PayoutStage, string> = {
  "awaiting-entry": "Awaiting purchase entry",
  requested: "Awaiting approval",
  approved: "Approved · unpaid",
  paid: "Paid",
};

// ---- stock & sales -------------------------------------------------------------------

export const isSold = (v: Vehicle) => v.sale?.status === "sold";

export function daysSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

export const AGEING_BUCKETS = [
  { id: "0-15", label: "0–15 days", min: 0, max: 15 },
  { id: "16-30", label: "16–30 days", min: 16, max: 30 },
  { id: "31-60", label: "31–60 days", min: 31, max: 60 },
  { id: "60+", label: "Over 60 days", min: 61, max: Infinity },
] as const;

export function ageingBucket(days: number) {
  return AGEING_BUCKETS.find((b) => days >= b.min && days <= b.max)!;
}

export function stockAgeing(vehicles: Vehicle[], now: number) {
  const unsold = vehicles.filter((v) => !isSold(v));
  return AGEING_BUCKETS.map((b) => {
    const rows = unsold.filter((v) => ageingBucket(daysSince(v.createdAt, now)).id === b.id);
    return { ...b, count: rows.length, valuePaise: rows.reduce((s, v) => s + landedCostPaise(v), 0) };
  });
}

export interface BranchPerformance {
  branchId: string;
  acquired: number;
  sold: number;
  inStock: number;
  revenuePaise: number;
  marginPaise: number;
  avgDaysToSell?: number;
}

export function branchPerformance(vehicles: Vehicle[], branchIds: string[]): BranchPerformance[] {
  return branchIds.map((branchId) => {
    const mine = vehicles.filter((v) => v.branchId === branchId);
    const sold = mine.filter(isSold);
    const days = sold.filter((v) => v.sale?.soldAt).map((v) => (new Date(v.sale!.soldAt!).getTime() - new Date(v.createdAt).getTime()) / DAY);
    return {
      branchId,
      acquired: mine.length,
      sold: sold.length,
      inStock: mine.length - sold.length,
      revenuePaise: sold.reduce((s, v) => s + (v.sale?.salePricePaise ?? 0), 0),
      marginPaise: sold.reduce((s, v) => s + (marginPaise(v) ?? 0), 0),
      avgDaysToSell: days.length ? days.reduce((a, b) => a + b, 0) / days.length : undefined,
    };
  });
}

/** "2026-09" for a timestamp, in IST. */
export const monthKey = (iso: string) => istDate(iso).slice(0, 7);

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function salesByMonth(vehicles: Vehicle[]) {
  const map = new Map<string, { month: string; units: number; revenuePaise: number; costPaise: number; marginPaise: number }>();
  for (const v of vehicles.filter((v) => isSold(v) && v.sale?.soldAt)) {
    const k = monthKey(v.sale!.soldAt!);
    const row = map.get(k) ?? { month: k, units: 0, revenuePaise: 0, costPaise: 0, marginPaise: 0 };
    row.units++;
    row.revenuePaise += v.sale!.salePricePaise ?? 0;
    row.costPaise += landedCostPaise(v);
    row.marginPaise += marginPaise(v) ?? 0;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

// ---- cash flow -----------------------------------------------------------------------

/** Monday (YYYY-MM-DD, IST) of the week containing `ms`. */
export function weekStart(ms: number | string) {
  const ymd = istDate(ms);
  const d = new Date(`${ymd}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

export interface WeekFlow {
  week: string; // Monday, YYYY-MM-DD
  inPaise: number;
  outPaise: number;
  netPaise: number;
}

/** Money in vs out per week for the last `weeks` weeks (oldest first), including the current week. */
export function weeklyCashFlow(entries: LedgerEntry[], weeks: number, now: number): WeekFlow[] {
  const current = weekStart(now);
  const starts = Array.from({ length: weeks }, (_, i) => new Date(new Date(`${current}T00:00:00Z`).getTime() - (weeks - 1 - i) * 7 * DAY).toISOString().slice(0, 10));
  const rows = new Map(starts.map((w) => [w, { week: w, inPaise: 0, outPaise: 0, netPaise: 0 }]));
  for (const e of entries) {
    const row = rows.get(weekStart(e.at));
    if (!row) continue;
    if (e.amountPaise >= 0) row.inPaise += e.amountPaise;
    else row.outPaise -= e.amountPaise;
    row.netPaise += e.amountPaise;
  }
  return [...rows.values()];
}
