"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, MapPin, Trash2, TriangleAlert } from "lucide-react";
import { deleteGpsCheckin, deleteGpsCheckins, geoCheckins, reverseGeocode, type GpsCheckin } from "@/lib/attendance-gps";
import { useRole } from "@/lib/role-context";
import { istDate } from "@/lib/working-days";
import { formatIsoDate } from "@/lib/format";
import { DataTable, type Column } from "../data-table";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "../selection";
import { Button, Panel, Pill, cn, inputClass } from "../ui";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const DAY = 86_400_000;

type QuickFilter = "today" | "yesterday" | "custom";

/**
 * GPS self check-ins, most recent first, reactively sourced straight from the `geoCheckins`
 * collection (Supabase `gps_attendance` when configured, local fallback otherwise - same
 * live-store pattern as everywhere else in this app, so a fresh check-in appears immediately).
 * `showFilters` (the dedicated /attendance-log page, Managing Partner only) adds Today /
 * Yesterday / custom-date controls and a Date column; the compact dashboard embed just shows
 * today with no controls.
 */
export function AttendanceLogPanel({ showFilters = false }: { showFilters?: boolean }) {
  const { role } = useRole();
  const { items, ready } = geoCheckins.useItems();
  const now = new Date();
  const today = istDate(now);
  const yesterday = istDate(new Date(now.getTime() - DAY));
  const [quick, setQuick] = useState<QuickFilter>("today");
  const [customDate, setCustomDate] = useState(today);
  const date = !showFilters ? today : quick === "today" ? today : quick === "yesterday" ? yesterday : customDate;

  const rows = useMemo(() => items.filter((c) => c.date === date).sort((a, b) => b.checkInTime.localeCompare(a.checkInTime)), [items, date]);
  // Checked against the literal role, not a permission (which a per-employee panel override could
  // grant to someone else) - this view, and deleting from it, must stay exclusive to the actual
  // Managing Partner. Delete is only offered on the dedicated page (showFilters), not the compact
  // dashboard embed.
  const canDelete = showFilters && role === "managing_partner";
  const selection = useSelection(rows, (c) => c.id);
  const [confirming, setConfirming] = useState<GpsCheckin[] | null>(null);

  async function doDelete(targets: GpsCheckin[]) {
    const ids = targets.map((c) => c.id);
    if (ids.length === 1) await deleteGpsCheckin(ids[0]);
    else await deleteGpsCheckins(ids);
    selection.clear();
  }

  // Rows saved before the place-name lookup existed (or where it failed at check-in time) show
  // "Unknown location" - resolve those in the background, one at a time, and save the result so
  // it sticks and future visits don't need to look it up again.
  const backfilling = useRef(new Set<string>());
  useEffect(() => {
    const stale = rows.filter((c) => !c.placeName && c.latitude && c.longitude && !backfilling.current.has(c.id));
    if (!stale.length) return;
    let cancelled = false;
    (async () => {
      for (const c of stale) {
        if (cancelled) break;
        backfilling.current.add(c.id);
        const placeName = await reverseGeocode(c.latitude, c.longitude);
        if (placeName && !cancelled) await geoCheckins.update(c.id, (rec) => ({ ...rec, placeName }));
        await new Promise((r) => setTimeout(r, 1_100));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // This view (and everything in it) is Managing Partner only - checked against the literal role
  // above `canDelete`, not just the route-level `attendance.view` permission, since a per-employee
  // panel override could otherwise grant it to someone else.
  if (role !== "managing_partner") {
    return (
      <Panel flush title="Attendance log">
        <p className="px-4 py-6 text-center text-sm text-muted">This view is available only to the Managing Partner.</p>
      </Panel>
    );
  }

  const columns: Column<GpsCheckin>[] = [
    ...(canDelete
      ? [
          {
            header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all check-ins" />,
            cell: (c: GpsCheckin) => <RowCheckbox checked={selection.isSelected(c.id)} onChange={() => selection.toggle(c.id)} label={`Select ${c.userName}'s check-in`} />,
          } satisfies Column<GpsCheckin>,
        ]
      : []),
    ...(showFilters ? [{ header: "Date", cell: (c: GpsCheckin) => <span className="whitespace-nowrap text-muted">{formatIsoDate(c.date)}</span> } satisfies Column<GpsCheckin>] : []),
    { header: "Staff", cell: (c) => <span className="font-medium whitespace-nowrap">{c.userName}</span> },
    {
      header: "Check-in / out",
      cell: (c) => (
        <span className="whitespace-nowrap">
          {formatTime(c.checkInTime)}
          {c.checkOutTime && <span className="text-muted"> – {formatTime(c.checkOutTime)}</span>}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (c) => (
        <Pill tone={c.status === "late" ? "warn" : "ok"} icon={c.status === "late" ? <TriangleAlert className="size-3" /> : <CheckCircle2 className="size-3" />}>
          {c.status === "late" ? "Late" : "Present"}
        </Pill>
      ),
    },
    {
      header: "Location",
      align: "right",
      cell: (c) => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-muted">{c.placeName ?? "Unknown location"}</span>
          <a
            href={c.googleMapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <MapPin className="size-3.5" /> View on map <ExternalLink className="size-3" />
          </a>
        </div>
      ),
    },
    ...(canDelete
      ? [
          {
            header: "",
            align: "right",
            cell: (c: GpsCheckin) => (
              <Button size="sm" variant="ghost" onClick={() => setConfirming([c])} aria-label={`Delete ${c.userName}'s check-in on ${formatIsoDate(c.date)}`}>
                <Trash2 className="size-3.5" />
              </Button>
            ),
          } satisfies Column<GpsCheckin>,
        ]
      : []),
  ];

  return (
    <Panel
      flush
      title="Attendance log"
      description={`${rows.length} GPS check-in${rows.length === 1 ? "" : "s"} · ${formatIsoDate(date)}`}
      actions={
        showFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={quick === "today" ? "primary" : "secondary"} onClick={() => setQuick("today")}>
              Today
            </Button>
            <Button size="sm" variant={quick === "yesterday" ? "primary" : "secondary"} onClick={() => setQuick("yesterday")}>
              Yesterday
            </Button>
            <input
              type="date"
              value={customDate}
              max={today}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setQuick("custom");
              }}
              aria-label="Pick a date"
              className={cn(inputClass(), "h-8 w-auto px-2.5 text-xs", quick === "custom" && "border-brand")}
            />
          </div>
        ) : undefined
      }
    >
      {canDelete && selection.count > 0 && (
        <div className="px-4 pt-3">
          <SelectionToolbar count={selection.count} noun="check-in" nounPlural="check-ins" onClear={selection.clear} onDelete={() => setConfirming(rows.filter((c) => selection.isSelected(c.id)))} />
        </div>
      )}
      <DataTable rows={ready ? rows : []} rowKey={(c) => c.id} empty={ready ? "No check-ins on this date." : "Loading…"} columns={columns} />
      {confirming && (
        <ConfirmDeleteDialog
          count={confirming.length}
          items={confirming.map((c) => `${c.userName} · ${formatIsoDate(c.date)} · ${formatTime(c.checkInTime)}`)}
          noun="check-in"
          nounPlural="check-ins"
          onConfirm={() => doDelete(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </Panel>
  );
}
