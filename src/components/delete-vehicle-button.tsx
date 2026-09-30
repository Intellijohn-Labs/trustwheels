"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { deleteVehicle } from "@/lib/stock-store";
import { displayReg } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { Button } from "./ui";
import { ConfirmDeleteDialog } from "./panels/confirm-delete-dialog";

/**
 * Full vehicle record deletion, gated to whoever holds stock.delete (Managing Partner only, per
 * rbac.ts). Reuses the same deleteVehicle() and confirmation dialog as the main Stock page, just
 * reachable directly from wherever a vehicle currently sits in the pipeline - Reconditioning,
 * Receiving, Transit, Verification, Book & Sell - instead of only from All Stocks.
 */
export function DeleteVehicleButton({ vehicle: v, size = "sm" }: { vehicle: Vehicle; size?: "sm" | "md" | "lg" }) {
  const { can } = useRole();
  const [confirming, setConfirming] = useState(false);
  if (!can("stock.delete")) return null;
  const label = `${v.make} ${v.model} · ${displayReg(v.registrationNo)}`;
  return (
    <>
      <Button size={size} variant="ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${label}`}>
        <Trash2 className="size-3.5" />
      </Button>
      {confirming && <ConfirmDeleteDialog count={1} items={[label]} noun="vehicle" onConfirm={() => deleteVehicle(v.id)} onClose={() => setConfirming(false)} />}
    </>
  );
}
