"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Dialog, useInlineAction } from "./dialog";
import { Button } from "../ui";

/**
 * Confirmation modal shared by every "delete" action (single row or a bulk selection).
 * Nothing is removed until the caller's `onConfirm` resolves without throwing.
 */
export function ConfirmDeleteDialog({
  count,
  items,
  noun = "item",
  onConfirm,
  onClose,
}: {
  /** How many records this will remove. */
  count: number;
  /** Optional short labels (e.g. reg. no. + model) for what's about to go, shown up to a handful. */
  items?: string[];
  /** Singular noun for the message, e.g. "vehicle". */
  noun?: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { submit, failure, busy } = useInlineAction();
  const plural = count === 1 ? noun : `${noun}s`;

  async function handleConfirm() {
    if (await submit(onConfirm, `Deleted ${count} ${plural}`)) onClose();
  }

  return (
    <Dialog
      title={`Delete ${count} ${plural}?`}
      onClose={onClose}
      onSubmit={handleConfirm}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="danger" className="flex-[2]" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Confirm delete
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl bg-danger-soft/60 p-3.5 text-danger">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm font-medium">
          Are you sure you want to delete {count === 1 ? "this" : "these"} {count} selected {plural}? This cannot be undone.
        </p>
      </div>
      {items && items.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-3 text-sm">
          {items.slice(0, 20).map((label, i) => (
            <li key={i} className="truncate text-muted">
              {label}
            </li>
          ))}
          {items.length > 20 && <li className="text-xs text-faint">+{items.length - 20} more</li>}
        </ul>
      )}
      {failure && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  );
}
