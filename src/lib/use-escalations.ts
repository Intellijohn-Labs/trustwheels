"use client";

import { useMemo } from "react";
import { useScopedVehicles } from "./scoped";
import { useNow } from "./use-now";
import { followUpEscalations, sortEscalations, vehicleEscalations } from "./escalations";
import { overdueFollowUps, useScopedLeads } from "./leads";

/** All open escalations within the signed-in role's scope, most urgent first. */
export function useEscalations() {
  const { vehicles, ready } = useScopedVehicles();
  const { leads, ready: leadsReady } = useScopedLeads();
  const now = useNow(30_000);
  const items = useMemo(
    () => sortEscalations([...vehicleEscalations(vehicles, now), ...followUpEscalations(overdueFollowUps(leads, now), now)]),
    [vehicles, leads, now],
  );
  return { items, ready: ready && leadsReady, now };
}
