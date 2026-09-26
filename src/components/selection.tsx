"use client";

import { useCallback, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button, cn } from "./ui";

/**
 * Row selection for a filtered list: "select all" only ever touches the rows currently
 * on screen, but a pick made before a filter change stays picked once you filter back.
 */
export function useSelection<T>(visible: T[], key: (item: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleIds = visible.map(key);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  // Not memoized: cheap, and its behaviour depends on the current filtered list anyway.
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, isSelected: (id: string) => selected.has(id), toggle, toggleAll, allVisibleSelected, clear, count: selected.size };
}

/** Plain square checkbox for a single row — visually distinct from any business-meaning checkbox on the row. */
export function RowCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="grid shrink-0 cursor-pointer place-items-center p-2.5" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="size-[18px] cursor-pointer accent-[var(--brand)]" />
    </label>
  );
}

/** "Select all" checkbox for a table header or a list toolbar. */
export function SelectAllCheckbox({ checked, indeterminate, onChange, label = "Select all" }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label?: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked;
      }}
      onChange={onChange}
      aria-label={label}
      className="size-[18px] cursor-pointer accent-[var(--brand)]"
    />
  );
}

/** Toolbar that appears once one or more rows are selected: count, clear, and a bulk delete button. */
export function SelectionToolbar({ count, onClear, onDelete, noun = "item" }: { count: number; onClear: () => void; onDelete: () => void; noun?: string }) {
  if (count === 0) return null;
  return (
    <div className={cn("anim-pop flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5")}>
      <p className="text-sm font-semibold text-brand">
        {count} {count === 1 ? noun : `${noun}s`} selected
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="size-3.5" /> Clear
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete selected ({count})
        </Button>
      </div>
    </div>
  );
}
