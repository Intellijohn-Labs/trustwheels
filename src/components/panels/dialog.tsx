"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { displayReg } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { useAction } from "../toast";
import { cn } from "../ui";

/**
 * Modal shell shared by the hub panels: dimmed overlay, bottom sheet on phones,
 * centred card on larger screens, Escape or a tap outside closes it.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  onSubmit,
  wide,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  onSubmit?: (e: FormEvent) => void;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(

    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[92dvh] w-full flex-col anim-dialog overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-3 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </form>
    </div>,
    document.body,
  );
}

export function VehicleSummary({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <>
      {v.make} {v.model} · <span className="font-mono">{displayReg(v.registrationNo)}</span>
    </>
  );
}

/**
 * useAction() for dialogs: the store's refusal is toasted and also kept as `failure`
 * so the dialog can show it inline next to the input that caused it.
 */
export function useInlineAction() {
  const { run, busy } = useAction();
  const [failure, setFailure] = useState<string>();
  async function submit(fn: () => Promise<unknown>, success?: string) {
    setFailure(undefined);
    return run(async () => {
      try {
        await fn();
      } catch (e) {
        setFailure(e instanceof Error ? e.message : "Something went wrong");
        throw e;
      }
    }, success);
  }
  return { submit, failure, busy, setFailure };
}
