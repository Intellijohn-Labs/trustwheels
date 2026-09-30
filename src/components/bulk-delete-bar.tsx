"use client";

import { useState } from "react";
import { deleteVehicles } from "@/lib/stock-store";
import { displayReg } from "@/lib/format";
import { collapseThenRun } from "@/lib/exit-animation";
import type { Vehicle } from "@/lib/types";
import { SelectionToolbar } from "./selection";
import { ConfirmDeleteDialog } from "./panels/confirm-delete-dialog";

/**
 * The SelectionToolbar + ConfirmDeleteDialog + deleteVehicles wiring shared by every bulk-select
 * panel: Verification, Transit, Receiving, Reconditioning, Deliveries, Book & Sell, All Stocks.
 * Renders nothing when nothing is selected. The caller owns the actual row checkboxes and
 * selection state (via useSelection) - this just handles what happens once you hit delete.
 */
export function BulkDeleteBar({ vehicles, selected, onClear }: { vehicles: Vehicle[]; selected: Set<string>; onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (selected.size === 0) return null;
  const ids = [...selected];
  const items = vehicles.filter((v) => selected.has(v.id)).map((v) => `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`);

  return (
    <>
      <SelectionToolbar count={selected.size} noun="vehicle" onClear={onClear} onDelete={() => setConfirming(true)} />
      {confirming && (
        <ConfirmDeleteDialog
          count={selected.size}
          items={items}
          noun="vehicle"
          onConfirm={() =>
            collapseThenRun(ids, async () => {
              await deleteVehicles(ids);
              onClear();
            })
          }
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
