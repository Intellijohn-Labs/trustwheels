import type { ReactNode } from "react";
import { EmptyState, cn } from "./ui";

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "right" | "center";
  className?: string;
}

/**
 * Plain data table used by every role panel. Scrolls sideways inside its panel on
 * narrow screens (the page itself never scrolls horizontally).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowTone,
  empty = "Nothing here.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowTone?: (row: T) => "danger" | "warn" | "ok" | undefined;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-sunken/60 text-left text-xs font-medium text-muted">
            {columns.map((c, i) => (
              <th key={i} className={cn("px-4 py-2.5 font-medium whitespace-nowrap", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="cascade divide-y divide-line">
          {rows.map((row) => {
            const tone = rowTone?.(row);
            return (
              <tr
                key={rowKey(row)}
                data-vehicle-id={rowKey(row)}
                className={cn(
                  "align-middle",
                  tone === "danger" && "bg-danger-soft/60 shadow-[inset_4px_0_0_var(--danger)]",
                  tone === "warn" && "bg-warn-soft/50 shadow-[inset_4px_0_0_var(--warn)]",
                  tone === "ok" && "bg-ok-soft/40",
                )}
              >
                {columns.map((c, i) => (
                  <td key={i} className={cn("px-4 py-3", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
