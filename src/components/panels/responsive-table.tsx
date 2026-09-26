import type { ReactNode } from "react";
import { DataTable, type Column } from "../data-table";
import { EmptyState, cn } from "../ui";

type Tone = "danger" | "warn" | "ok" | undefined;

/**
 * DataTable from `sm` up; below that, a stacked card per row so the status and the action
 * button are visible at 390px without scrolling the table sideways.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  rowTone,
  empty,
  card,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowTone?: (row: T) => Tone;
  empty?: ReactNode;
  card: (row: T) => ReactNode;
}) {
  return (
    <>
      <div className="hidden sm:block">
        <DataTable columns={columns} rows={rows} rowKey={rowKey} rowTone={rowTone} empty={empty} />
      </div>
      <div className="sm:hidden">
        {rows.length === 0 ? (
          <EmptyState>{empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const tone = rowTone?.(row);
              return (
                <li
                  key={rowKey(row)}
                  className={cn(
                    "space-y-2.5 px-4 py-3",
                    tone === "danger" && "bg-danger-soft/60 shadow-[inset_4px_0_0_var(--danger)]",
                    tone === "warn" && "bg-warn-soft/50 shadow-[inset_4px_0_0_var(--warn)]",
                    tone === "ok" && "bg-ok-soft/40",
                  )}
                >
                  {card(row)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/** Row of label/value pairs and pills inside a mobile card. */
export function CardMeta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">{children}</div>;
}
