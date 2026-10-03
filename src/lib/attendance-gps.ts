"use client";

import { defineCollection, newId } from "./collections";
import { currentRole, getActor } from "./session";
import { istDate } from "./working-days";

/*
 * GPS-based self check-in, captured once per person per day from the login screen - a distinct,
 * separate concept from the HR-administered attendance register in lib/hr.ts (which an HR admin
 * marks present/absent/leave for payroll, and is deliberately local-only). This one is
 * self-service, tied to whichever demo role is signing in, and syncs to Supabase.
 */

export type CheckinStatus = "present" | "late";

export interface GpsCheckin {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD, IST
  checkInTime: string; // ISO timestamp
  checkOutTime?: string; // ISO timestamp
  latitude: number;
  longitude: number;
  googleMapsLink: string;
  /** Reverse-geocoded "locality, district" (e.g. "Tirur, Malappuram"), when lookup succeeds. */
  placeName?: string;
  status: CheckinStatus;
}

export const geoCheckins = defineCollection<GpsCheckin>("gps-attendance", () => [], 1, { supabaseTable: "gps_attendance" });

/**
 * Checked against the literal signed-in role, not the permission system - `attendance.view` can
 * be granted to another role via an employee's per-employee panel override (Employees & Access ->
 * Panel access), but deleting GPS attendance history must never be reachable by anyone other than
 * the actual Managing Partner, override or not.
 */
function assertManagingPartner() {
  if (currentRole() !== "managing_partner") throw new Error("Not allowed: only the Managing Partner can delete attendance records.");
}

/** Permanently remove one GPS check-in record. Managing Partner only. */
export function deleteGpsCheckin(id: string) {
  assertManagingPartner();
  return geoCheckins.remove(id);
}

/** Permanently remove several GPS check-in records in one write, e.g. a bulk selection. */
export function deleteGpsCheckins(ids: string[]) {
  if (!ids.length) return Promise.resolve();
  assertManagingPartner();
  return geoCheckins.removeMany(ids);
}

/** Shift is considered started by 9:30am IST; a check-in after that is flagged "late". */
const LATE_AFTER_MINUTES = 9 * 60 + 30;
/** Attendance can only be marked Monday-Saturday, 9:00am-6:00pm IST (inclusive) - sign-in itself is never restricted. */
const ATTENDANCE_WINDOW = { openMinutes: 9 * 60, closeMinutes: 18 * 60 };

function istMinutesSinceMidnight(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function istWeekday(d: Date) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export type IneligibleReason = "sunday" | "hours";

/** Whether *right now* (IST) is within the attendance-marking window - never gates sign-in itself, only whether a punch-in is attempted. */
function attendanceEligibility(d: Date): { eligible: true } | { eligible: false; reason: IneligibleReason } {
  if (istWeekday(d) === 0) return { eligible: false, reason: "sunday" };
  const minutes = istMinutesSinceMidnight(d);
  if (minutes < ATTENDANCE_WINDOW.openMinutes || minutes > ATTENDANCE_WINDOW.closeMinutes) return { eligible: false, reason: "hours" };
  return { eligible: true };
}

/**
 * Best-effort lookup of a human-readable place for a coordinate pair, via our own
 * `/api/geocode/reverse` route (Nominatim requires a real User-Agent, which browser `fetch` can't
 * set directly - the server route sets it). Never throws or hangs - times out and falls back to
 * undefined so it can never block a check-in. Also used by the Attendance log panel to backfill
 * older rows that were saved before this route existed.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return undefined;
    const body = await res.json();
    return body?.place_name ?? undefined;
  } catch {
    return undefined;
  }
}

/** Records today's check-in for whoever is currently signed in. A second call the same day is a no-op (returns null). */
async function recordGpsCheckIn(latitude: number, longitude: number): Promise<GpsCheckin | null> {
  const { id: userId, name: userName } = getActor();
  const now = new Date();
  const date = istDate(now);
  const all = await geoCheckins.all();
  if (all.some((c) => c.userId === userId && c.date === date)) return null;

  const placeName = await reverseGeocode(latitude, longitude);

  const record: GpsCheckin = {
    id: newId("gps"),
    userId,
    userName,
    date,
    checkInTime: now.toISOString(),
    latitude,
    longitude,
    googleMapsLink: `https://maps.google.com/?q=${latitude},${longitude}`,
    placeName,
    status: istMinutesSinceMidnight(now) > LATE_AFTER_MINUTES ? "late" : "present",
  };
  await geoCheckins.add(record);
  return record;
}

/** Stamps a check-out time on today's check-in, if one exists. */
export async function recordGpsCheckOut() {
  const { id: userId } = getActor();
  const date = istDate(new Date());
  const all = await geoCheckins.all();
  const mine = all.find((c) => c.userId === userId && c.date === date);
  if (!mine) throw new Error("No check-in recorded for today yet.");
  await geoCheckins.update(mine.id, (c) => ({ ...c, checkOutTime: new Date().toISOString() }));
}

export type GpsCheckInResult =
  | { status: "recorded"; record: GpsCheckin }
  | { status: "already-done" }
  | { status: "ineligible"; reason: IneligibleReason }
  | { status: "error"; message: string };

/**
 * Asks the browser for the current position and, if granted, records today's check-in.
 * Never throws - every outcome (including a denied/unavailable permission) resolves to a
 * result the caller can show as a clear message, per the "prompt the user" requirement.
 *
 * Sign-in itself is never blocked by this: outside Mon-Sat 9am-6pm IST, this resolves to
 * "ineligible" immediately, without ever prompting for location or touching gps_attendance -
 * the caller still lets the person into the dashboard, just without a punch-in.
 */
export function requestGpsCheckIn(): Promise<GpsCheckInResult> {
  const eligibility = attendanceEligibility(new Date());
  if (!eligibility.eligible) return Promise.resolve({ status: "ineligible", reason: eligibility.reason });

  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ status: "error", message: "This device/browser doesn't support location. Enable device location to mark attendance." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        recordGpsCheckIn(pos.coords.latitude, pos.coords.longitude)
          .then((record) => resolve(record ? { status: "recorded", record } : { status: "already-done" }))
          .catch((e) => resolve({ status: "error", message: e instanceof Error ? e.message : "Couldn't save your check-in." }));
      },
      (err) => {
        resolve({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Enable device location to mark attendance."
              : "Couldn't get your location. Check that device location is turned on and try again.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
