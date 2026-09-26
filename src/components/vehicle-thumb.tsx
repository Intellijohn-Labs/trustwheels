import { Bike } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { cn } from "./ui";

export function VehicleThumb({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const src = vehicle.photos.front ?? vehicle.photos.left ?? vehicle.photos.right;
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden bg-sunken text-faint", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL, not an optimisable asset
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Bike className="size-1/3" strokeWidth={1.5} />
      )}
    </div>
  );
}
