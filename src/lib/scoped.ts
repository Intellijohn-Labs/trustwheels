"use client";

import { useMemo } from "react";
import { useRole } from "./role-context";
import { useVehicles } from "./stock-store";

/** Vehicles the signed-in role may see (its branch scope). Use this in screens, not useVehicles(). */
export function useScopedVehicles() {
  const { vehicles, ready } = useVehicles();
  const { inScope } = useRole();
  const scoped = useMemo(() => vehicles.filter((v) => inScope(v.branchId)), [vehicles, inScope]);
  return { vehicles: scoped, ready };
}
