"use client";

import { useState } from "react";
import { CalendarPlus, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { BRANCHES } from "@/lib/masters";
import { formatIsoDate } from "@/lib/format";
import { addDays, createRoster, mondayOf, onRollOn, rosters } from "@/lib/hr";
import { useAction } from "@/components/toast";
import { Button, EmptyState, PageHeader, Panel } from "@/components/ui";
import { BranchSelect, ViewOnlyNote, useEmployees, useToday, useCanManageHr } from "@/components/panels/hr-bits";
import { RosterGrid, ShiftLegend } from "@/components/panels/roster-grid";

export default function RosterPage() {
  const manage = useCanManageHr();
  const today = useToday();
  const { run, busy } = useAction();
  const [picked, setPicked] = useState<string>();
  const weekStart = picked ?? mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const [branch, setBranch] = useState("all");
  const { items, ready } = rosters.useItems();
  const { employees, byId } = useEmployees();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shift roster"
        icon={<CalendarRange className="size-6 text-brand" />}
        description={manage ? "Tap a shift to change it: Morning, General, Evening, Off." : "Weekly shifts by branch."}
      />
      {!manage && <ViewOnlyNote />}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_14rem] sm:items-center">
        <div className="flex items-center gap-2">
          <Button aria-label="Previous week" onClick={() => setPicked(addDays(weekStart, -7))} className="h-12 w-12 px-0">
            <ChevronLeft className="size-5" />
          </Button>
          <p className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums sm:w-56">
            {formatIsoDate(weekStart)} – {formatIsoDate(weekEnd)}
          </p>
          <Button aria-label="Next week" onClick={() => setPicked(addDays(weekStart, 7))} className="h-12 w-12 px-0">
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <p className="text-sm text-muted">
          {weekStart === mondayOf(today) ? (
            "This week"
          ) : (
            <button type="button" onClick={() => setPicked(undefined)} className="font-medium text-brand hover:underline">
              Back to this week
            </button>
          )}
        </p>
        <BranchSelect value={branch} onChange={setBranch} />
      </div>
      <ShiftLegend />

      {ready &&
        BRANCHES.filter((b) => branch === "all" || b.id === branch).map((b) => {
          const roster = items.find((r) => r.branchId === b.id && r.weekStart === weekStart);
          const onRoll = employees.filter((e) => e.branchId === b.id && onRollOn(e, weekEnd));
          const inRoster = roster ? [...new Set(roster.shifts.map((s) => s.employeeId))].map((id) => byId.get(id)).filter((e) => e !== undefined) : [];
          const staff = [...inRoster, ...onRoll.filter((e) => !inRoster.includes(e))].filter((e) => e.status !== "exited").sort((x, y) => x.name.localeCompare(y.name));
          if (branch === "all" && !roster && onRoll.length === 0) return null;
          return (
            <Panel key={b.id} flush title={b.name} description={`${staff.length} on the roster`}>
              {roster ? (
                <RosterGrid roster={roster} staff={staff} today={today} />
              ) : (
                <EmptyState>
                  <p>No roster for this week yet.</p>
                  {manage && onRoll.length > 0 && (
                    <Button variant="primary" className="mt-3" disabled={busy} onClick={() => run(() => createRoster(b.id, weekStart), `${b.name} roster started from the previous week`)}>
                      <CalendarPlus className="size-4" /> Start roster
                    </Button>
                  )}
                </EmptyState>
              )}
            </Panel>
          );
        })}
    </div>
  );
}
