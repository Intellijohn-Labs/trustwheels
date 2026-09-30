"use client";

import { useRef, useState } from "react";
import { Eye, FileText, Loader2, Upload, X } from "lucide-react";
import { uploadVehicleDocument } from "@/lib/vehicle-media";
import { cn, inputClass } from "./ui";

export interface DocumentDraft {
  fileUrl: string;
  fileName: string;
  expiresAt?: string;
}

/** One row in the intake form's Documents section: upload/replace a PDF or photo, with an optional expiry date. */
export function DocumentUploadSlot({
  label,
  required,
  hasExpiry,
  value,
  invalid,
  onChange,
}: {
  label: string;
  required?: boolean;
  hasExpiry?: boolean;
  value?: DocumentDraft;
  invalid?: boolean;
  onChange: (value: DocumentDraft | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const fileUrl = await uploadVehicleDocument(file);
      onChange({ fileUrl, fileName: file.name, expiresAt: value?.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("rounded-xl border p-3", invalid ? "border-danger" : "border-line-strong")}>
      <div className="flex items-start gap-2.5">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {label} {required && <span className="text-xs text-danger">*</span>}
          </p>
          <p className="truncate text-xs text-muted">{value ? value.fileName : (error ?? "Not attached")}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs font-medium hover:bg-sunken disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {value ? "Replace" : "Upload"}
        </button>
        {value && (
          <>
            <a href={value.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-brand hover:underline">
              <Eye className="size-3.5" /> View
            </a>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label={`Remove ${label}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted hover:text-danger"
            >
              <X className="size-3.5" /> Remove
            </button>
          </>
        )}
        {hasExpiry && (
          <input
            type="date"
            aria-label={`${label} expiry date`}
            value={value?.expiresAt ?? ""}
            onChange={(e) => value && onChange({ ...value, expiresAt: e.target.value || undefined })}
            disabled={!value}
            className={cn(inputClass(), "ml-auto h-8 w-36 text-xs disabled:opacity-50")}
          />
        )}
      </div>
    </div>
  );
}
