import { VERIFY_LIMIT_HOURS } from "./masters";
import type { Vehicle } from "./types";

const HOUR = 3_600_000;

export type VerifyState = "verified" | "pending" | "overdue";

export function verifyDeadline(v: Vehicle) {
  return new Date(v.createdAt).getTime() + VERIFY_LIMIT_HOURS * HOUR;
}

export function verifyState(v: Vehicle, now: number): VerifyState {
  if (v.verified) return "verified";
  return now > verifyDeadline(v) ? "overdue" : "pending";
}

/** 1d 04h 09m 05s style; days are dropped when zero. */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d ? `${d}d ` : ""}${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}
