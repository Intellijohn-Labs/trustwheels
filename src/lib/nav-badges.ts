"use client";

import { useVehicles } from "./stock-store";
import { useNow } from "./use-now";
import { useRole } from "./role-context";
import { useOverdueFollowUpCount } from "./leads";
import { useEscalations } from "./use-escalations";
import { verifyState } from "./verification";
import { awaitingGate, inRecon, isCodeRed, paymentDue, reconFlag, transitBreached } from "./workflow";

export interface NavBadge {
  count: number;
  tone: "danger" | "warn";
  title: string;
}

/** Counts shown next to sidebar items: things that need attention, within the role's scope. */
export function useNavBadges(): Record<string, NavBadge | undefined> {
  const { vehicles } = useVehicles();
  const { inScope } = useRole();
  const now = useNow(30_000);
  const missedCalls = useOverdueFollowUpCount();
  const critical = useEscalations().items.filter((e) => e.severity === "critical").length;
  const mine = vehicles.filter((v) => inScope(v.branchId));

  const badge = (count: number, tone: NavBadge["tone"], title: string) => (count ? { count, tone, title } : undefined);

  return {
    "/escalations": badge(critical, "danger", "Critical escalations"),
    "/enquiries": badge(missedCalls, "danger", "Follow-up calls missed (Code Red)"),
    "/overdue": badge(mine.filter((v) => verifyState(v, now) === "overdue").length, "danger", "Not verified within the time limit"),
    "/transit": badge(mine.filter((v) => transitBreached(v, now)).length, "danger", "Transit time limit breached"),
    "/receiving": badge(mine.filter((v) => v.dispatch && !v.receipt).length, "warn", "Vehicles on the way to Angamaly"),
    "/recon": badge(mine.filter((v) => inRecon(v) && reconFlag(v, now) !== "ok").length, "danger", "RED flags"),
    "/quality-gate": badge(mine.filter(awaitingGate).length, "warn", "Waiting for quality check"),
    "/deliveries": badge(mine.filter((v) => isCodeRed(v, now)).length, "danger", "Code Red: sold more than 4 days ago, not delivered"),
    "/payments": badge(mine.filter((v) => ["overdue", "due-soon"].includes(paymentDue(v, now)?.status ?? "")).length, "warn", "Seller payments due within 2 working days or overdue"),
    "/fees": badge(mine.filter((v) => v.delivery?.feePayment && v.delivery.feePayment.status !== "paid").length, "warn", "Fee requests waiting"),
  };
}
