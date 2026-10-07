"use client";

import { useRef, useState } from "react";
import { Camera, Images, Loader2 } from "lucide-react";
import { uploadVehiclePhoto } from "@/lib/vehicle-media";
import { cn } from "./ui";

/**
 * Two separate hidden inputs, not one: `capture="environment"` opens the device's back camera
 * directly, with no gallery fallback on the same input (that's the whole point of `capture` - a
 * single input can't offer both behaviours), so a standalone capture-less input covers "choose an
 * existing photo" instead. On a desktop browser neither input has a camera to open, so both just
 * fall back to the normal file picker.
 */
export function PhotoSlotInput({
  label,
  hint,
  value,
  invalid,
  onChange,
}: {
  label: string;
  hint: string;
  value?: string;
  invalid?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      // Shows the compressed local preview the moment it's ready, then swaps in the hosted
      // Supabase URL once the upload finishes - the slower network round trip happens invisibly.
      onChange(await uploadVehiclePhoto(file, onChange));
    } catch {
      setError("Couldn't read that image");
    } finally {
      setBusy(false);
      if (cameraInput.current) cameraInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "group relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border-2 text-center transition",
        value ? "border-transparent" : "border-dashed bg-sunken",
        !value && (invalid ? "border-danger" : "border-line-strong"),
      )}
    >
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />

      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-xs font-medium text-white">
            <span className="truncate">{label}</span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                aria-label={`Retake ${label} with camera`}
                className="btn-tap grid size-6 shrink-0 place-items-center rounded-md bg-black/35 hover:bg-black/55"
              >
                <Camera className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                aria-label={`Replace ${label} from gallery`}
                className="btn-tap grid size-6 shrink-0 place-items-center rounded-md bg-black/35 hover:bg-black/55"
              >
                <Images className="size-3.5" />
              </button>
            </span>
          </span>
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
        </>
      ) : (
        <>
          {busy ? (
            <Loader2 className="size-6 animate-spin text-brand" />
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                aria-label={`Take a photo for ${label}`}
                className="btn-tap inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium hover:bg-sunken"
              >
                <Camera className="size-3.5" /> Camera
              </button>
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                aria-label={`Choose a file for ${label}`}
                className="btn-tap inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium hover:bg-sunken"
              >
                <Images className="size-3.5" /> Gallery
              </button>
            </div>
          )}
          <span className="mt-1.5 text-sm font-medium text-ink">{label}</span>
          <span className="px-2 text-[11px] leading-tight text-muted">{error ?? hint}</span>
        </>
      )}
    </div>
  );
}
