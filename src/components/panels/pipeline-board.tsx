"use client";

import { BRANCHES } from "@/lib/masters";
import { useScopedVehicles } from "@/lib/scoped";
import type { Vehicle } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import { cn } from "@/components/ui";

/** Real-time workflow status: how many vehicles sit at each step, per source branch. */
const STEPS: { label: string; test: (v: Vehicle) => boolean }[] = [
  { label: "At branch", test: (v) => !v.dispatch && !v.sale },
  { label: "In transit", test: (v) => !!v.dispatch && !v.receipt },
  { label: "Reconditioning", test: (v) => !!v.recon && !v.gate && !v.recon.completed },
  { label: "Quality gate", test: (v) => !!v.recon?.completed && !v.gate },
  { label: "On display", test: (v) => !!v.gate && !v.sale },
  { label: "Booked / sold", test: (v) => !!v.sale && !v.delivery?.delivered },
  { label: "Delivered", test: (v) => !!v.delivery?.delivered },
];

export function PipelineBoard() {
  const { vehicles } = useScopedVehicles();
  const { inScope } = useRole();
  const branches = BRANCHES.filter((b) => b.id !== "ang" && inScope(b.id));
  const total = (test: (v: Vehicle) => boolean) => vehicles.filter(test).length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
            <th className="px-4 py-2.5 font-medium">Branch</th>
            {STEPS.map((s) => (
              <th key={s.label} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {branches.map((b) => {
            const mine = vehicles.filter((v) => v.branchId === b.id);
            return (
              <tr key={b.id}>
                <td className="px-4 py-2.5 font-medium whitespace-nowrap">{b.name}</td>
                {STEPS.map((s) => {
                  const n = mine.filter(s.test).length;
                  return (
                    <td key={s.label} className={cn("px-3 py-2.5 text-right tabular-nums", n === 0 && "text-faint")}>
                      {n}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="bg-sunken/40 font-semibold">
            <td className="px-4 py-2.5">Total</td>
            {STEPS.map((s) => (
              <td key={s.label} className="px-3 py-2.5 text-right tabular-nums">
                {total(s.test)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
