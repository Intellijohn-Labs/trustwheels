"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { employees } from "@/lib/hr";
import { geoCheckins, type GpsCheckin } from "@/lib/attendance-gps";
import { DEMO_USERS } from "@/lib/rbac";
import { isWorkingDay, istDate } from "@/lib/working-days";
import { formatIsoDate } from "@/lib/format";
import { Dialog } from "./dialog";
import { Panel, Pill, cn, inputClass } from "../ui";

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const pad2 = (n: number) => String(n).padStart(2, "0");

type ActiveCell = { name: string; date: string; checkin: GpsCheckin };

/**
 * Monthly attendance register: one row per staff member who holds a system login (the only
 * people who can ever produce a GPS check-in - see attendance-gps.ts), one column per day of the
 * selected month, plus Present/Late/Absent totals. A filled cell opens a detail dialog with the
 * punch time, place and map link; empty cells on Sundays/company holidays are styled as off-days
 * rather than absences, and future days are left blank rather than marked absent.
 */
export function AttendanceSheetPanel() {
  const { items: allEmployees, ready: employeesReady } = employees.useItems();
  const { items: checkins, ready: checkinsReady } = geoCheckins.useItems();
  const ready = employeesReady && checkinsReady;

  const todayYmd = istDate(new Date());
  const [month, setMonth] = useState(todayYmd.slice(0, 7)); // "YYYY-MM"
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const [active, setActive] = useState<ActiveCell | null>(null);

  const roster = useMemo(
    () =>
      allEmployees
        .filter((e) => e.rbacRole && e.status !== "exited")
        .map((e) => ({ ...e, gpsUserId: e.rbacRole ? DEMO_USERS[e.rbacRole].id : undefined }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allEmployees],
  );

  const checkinsByUser = useMemo(() => {
    const map = new Map<string, Map<string, GpsCheckin>>();
    for (const c of checkins) {
      if (!c.date.startsWith(month)) continue;
      if (!map.has(c.userId)) map.set(c.userId, new Map());
      map.get(c.userId)!.set(c.date, c);
    }
    return map;
  }, [checkins, month]);

  return (
    <Panel
      flush
      title="Attendance sheet"
      description={`Monthly register · ${roster.length} staff with system access`}
      actions={
        <input
          type="month"
          value={month}
          max={todayYmd.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          aria-label="Pick a month"
          className={cn(inputClass(), "h-8 w-auto px-2.5 text-xs")}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">Staff</th>
              {days.map((d) => {
                const ymd = `${month}-${pad2(d)}`;
                return (
                  <th key={d} className={cn("px-1 py-2 text-center font-medium", !isWorkingDay(ymd) && "bg-sunken/60 text-faint")}>
                    {d}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center font-medium text-ok">P</th>
              <th className="px-2 py-2 text-center font-medium text-warn">L</th>
              <th className="px-2 py-2 text-center font-medium text-danger">A</th>
            </tr>
          </thead>
          <tbody>
            {!ready ? (
              <tr>
                <td colSpan={days.length + 4} className="px-3 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : roster.length === 0 ? (
              <tr>
                <td colSpan={days.length + 4} className="px-3 py-6 text-center text-muted">
                  No staff with system access yet.
                </td>
              </tr>
            ) : (
              roster.map((e) => {
                let present = 0;
                let late = 0;
                let absent = 0;
                const cells = days.map((d) => {
                  const ymd = `${month}-${pad2(d)}`;
                  const checkin = e.gpsUserId ? checkinsByUser.get(e.gpsUserId)?.get(ymd) : undefined;
                  const off = !isWorkingDay(ymd);
                  const future = ymd > todayYmd;
                  if (checkin) {
                    if (checkin.status === "late") late++;
                    else present++;
                  } else if (!off && !future) absent++;
                  return { ymd, checkin, off, future };
                });

                return (
                  <tr key={e.id} className="border-b border-line/60 hover:bg-sunken/40">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 font-medium">{e.name}</td>
                    {cells.map(({ ymd, checkin, off, future }) => (
                      <td key={ymd} className={cn("px-1 py-1.5 text-center", off && "bg-sunken/60")}>
                        {checkin ? (
                          <button
                            type="button"
                            onClick={() => setActive({ name: e.name, date: ymd, checkin })}
                            title={`${formatTime(checkin.checkInTime)} · ${checkin.placeName ?? "Unknown location"}`}
                            className={cn(
                              "btn-tap mx-auto grid size-6 place-items-center rounded-md text-[11px] font-bold",
                              checkin.status === "late" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok",
                            )}
                          >
                            {checkin.status === "late" ? "L" : "P"}
                          </button>
                        ) : off ? (
                          <span className="text-faint">·</span>
                        ) : future ? (
                          <span className="text-faint">–</span>
                        ) : (
                          <span className="font-bold text-danger/70">A</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-semibold text-ok">{present}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-warn">{late}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-danger">{absent}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {active && (
        <Dialog title={active.name} subtitle={formatIsoDate(active.date)} onClose={() => setActive(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Check-in</span>
              <span className="font-medium">{formatTime(active.checkin.checkInTime)}</span>
            </div>
            {active.checkin.checkOutTime && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Check-out</span>
                <span className="font-medium">{formatTime(active.checkin.checkOutTime)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted">Status</span>
              <Pill tone={active.checkin.status === "late" ? "warn" : "ok"}>{active.checkin.status === "late" ? "Late" : "Present"}</Pill>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Place</span>
              <span className="text-right font-medium">{active.checkin.placeName ?? "Unknown location"}</span>
            </div>
            <a
              href={active.checkin.googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tap inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong px-3 py-2.5 text-sm font-medium hover:bg-sunken"
            >
              <MapPin className="size-4" /> View on map <ExternalLink className="size-3.5" />
            </a>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}
