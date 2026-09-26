import { HOLIDAYS } from "./masters";

const IST = "Asia/Kolkata";
const DAY = 86_400_000;

/** YYYY-MM-DD for a timestamp, in Asia/Kolkata. */
export function istDate(ms: number | string | Date) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: IST });
}

function isWorkingDay(ymd: string) {
  const weekday = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && !HOLIDAYS.includes(ymd);
}

function nextDay(ymd: string) {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);
}

/** The date `n` working days after `from` (Sundays and HOLIDAYS skipped). */
export function addWorkingDays(from: number | string | Date, n: number) {
  let d = istDate(from);
  for (let added = 0; added < n; ) {
    d = nextDay(d);
    if (isWorkingDay(d)) added++;
  }
  return d;
}

/** Working days from today until `due` (negative once overdue). */
export function workingDaysUntil(due: string, now: number) {
  const today = istDate(now);
  if (today === due) return 0;
  const forward = today < due;
  let count = 0;
  for (let d = today; d !== due; ) {
    d = forward ? nextDay(d) : new Date(new Date(`${d}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10);
    if (isWorkingDay(d)) count++;
  }
  return forward ? count : -count;
}
