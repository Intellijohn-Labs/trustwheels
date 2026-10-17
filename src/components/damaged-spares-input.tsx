"use client";

import { useRef, useState } from "react";
import { Camera, Images, Loader2, X } from "lucide-react";
import { uploadVehiclePhoto } from "@/lib/vehicle-media";

/**
 * 0 to `max` photos of damaged or broken spares, each removable. Camera opens the device's back
 * camera directly; Gallery picks existing files (several at once, up to what's left). Optional:
 * nothing here is required, whether there are no damaged parts or a full set.
 */
export function DamagedSparesInput({ value, onChange, max = 4 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const room = max - value.length;
    if (room <= 0) return;
    setBusy(true);
    setNote(files.length > room ? `Only ${max} photos are allowed - the extra ${files.length - room === 1 ? "one was" : "ones were"} skipped.` : undefined);
    const next = [...value];
    try {
      for (const file of Array.from(files).slice(0, room)) {
        next.push(await uploadVehiclePhoto(file));
        onChange([...next]);
      }
    } catch {
      setNote("Couldn't read that image.");
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (gallery.current) gallery.current.value = "";
    }
  }

  const full = value.length >= max;

  return (
    <div className="space-y-2">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((src, i) => (
          <li key={`${i}-${src.slice(-24)}`} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken">
            <a href={src} target="_blank" rel="noreferrer" aria-label={`Open damaged spare photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- hosted or data-URL photo */}
              <img src={src} alt={`Damaged spare ${i + 1}`} className="size-full object-cover" />
            </a>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove damaged spare photo ${i + 1}`}
              className="btn-tap absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-black"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {!full && (
          <li className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong bg-sunken p-2 text-center">
            {busy ? (
              <Loader2 className="size-6 animate-spin text-brand" />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => camera.current?.click()}
                    aria-label="Take a photo of a damaged spare"
                    className="btn-tap inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium hover:bg-sunken"
                  >
                    <Camera className="size-3.5" /> Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => gallery.current?.click()}
                    aria-label="Choose photos of damaged spares"
                    className="btn-tap inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium hover:bg-sunken"
                  >
                    <Images className="size-3.5" /> Gallery
                  </button>
                </div>
                <span className="text-[11px] leading-tight text-muted">Add a photo</span>
              </>
            )}
          </li>
        )}
      </ul>
      <p className="text-xs text-muted" aria-live="polite">
        {value.length}/{max} added{full ? " - remove one to add another" : ""}
        {note && <span className="ml-2 font-medium text-warn">{note}</span>}
      </p>
    </div>
  );
}
