"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { compressImage } from "@/lib/image";
import { cn } from "./ui";

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
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await compressImage(file));
    } catch {
      setError("Couldn't read that image");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className={cn(
        "group relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border-2 text-center transition",
        value ? "border-transparent" : "border-dashed bg-sunken hover:border-brand",
        !value && (invalid ? "border-danger" : "border-line-strong"),
      )}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-xs font-medium text-white">
            {label}
            <RotateCcw className="size-3.5 opacity-80" />
          </span>
        </>
      ) : (
        <>
          {busy ? <Loader2 className="size-6 animate-spin text-brand" /> : <Camera className="size-6 text-muted" />}
          <span className="mt-1.5 text-sm font-medium text-ink">{label}</span>
          <span className="px-2 text-[11px] leading-tight text-muted">{error ?? hint}</span>
        </>
      )}
    </button>
  );
}
