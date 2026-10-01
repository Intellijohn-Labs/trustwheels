"use client";

import type { Role } from "./rbac";
import { defineCollection, newId } from "./collections";
import { getActor } from "./session";

/*
 * Audit trail for the Managing Partner's Activity Log (`/audit-logs`). Same { id, data } table
 * shape as every other collection - `activity_logs` holds one row per entry, the full record as a
 * jsonb blob. Logging is called from inside the store functions that already enforce the real
 * permission checks (stock-store.ts, employees), never from the UI layer, so an entry can't be
 * skipped by going around a particular screen.
 *
 * Deliberately a bare side-effect, not a gate: logActivity() never throws and the action that
 * triggered it has already happened by the time it's called - a failed or slow log write must
 * never block, delay, or roll back real work.
 */

export const ACTION_TYPES = ["CREATE", "EDIT", "STATUS_CHANGE", "RECONDITIONING", "READY_FOR_SALE", "REJECTED_STOCK", "PAYMENT", "DELETE_REPORT", "DELETE", "EMPLOYEE"] as const;

export type ActivityActionType = (typeof ACTION_TYPES)[number];

export interface ActivityLog {
  id: string;
  /** ISO timestamp. */
  at: string;
  actorName: string;
  actorRole: Role;
  actionType: ActivityActionType;
  /** What this happened to, e.g. a reg. no., a technician's name, an employee's name. */
  targetEntity: string;
  /** Human-readable summary, e.g. "Moved KL-10-XX-1234 to Reconditioning (Stage 8)". */
  details: string;
}

export const activityLogs = defineCollection<ActivityLog>("activity_logs", () => [], 1, { supabaseTable: "activity_logs" });

export function logActivity(actionType: ActivityActionType, targetEntity: string, details: string) {
  try {
    const actor = getActor();
    const entry: ActivityLog = {
      id: newId("log"),
      at: new Date().toISOString(),
      actorName: actor.name,
      actorRole: actor.role,
      actionType,
      targetEntity,
      details,
    };
    // add() itself only ever rejects on a local IndexedDB failure - a rejected Supabase write is
    // caught inside the collection and logged there (and queued for retry), not surfaced here.
    void activityLogs.add(entry).catch((error) => console.error("Failed to insert activity log:", error));
  } catch (error) {
    console.error("Failed to insert activity log:", error);
  }
}
