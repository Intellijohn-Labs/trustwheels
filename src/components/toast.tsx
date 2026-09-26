"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, ShieldAlert, X } from "lucide-react";
import { cn } from "./ui";

type Toast = { id: number; kind: "ok" | "error"; message: string };

const ToastContext = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "anim-toast pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
              t.kind === "error" ? "bg-danger text-surface" : "bg-ink text-page",
            )}
          >
            {t.kind === "error" ? <ShieldAlert className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Run a store mutation and report the outcome. Store gates throw "Blocked: ..." errors,
 * which surface here exactly as the API's refusal will.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) toast("ok", success);
        return true;
      } catch (e) {
        toast("error", e instanceof Error ? e.message : "Something went wrong");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
