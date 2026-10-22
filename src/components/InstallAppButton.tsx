"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Share } from "lucide-react";
import { cn } from "./ui";

/*
 * "Install App" button. Self-contained: it keeps everything in its own state and touches nothing global.
 *  - Chrome / Edge / Android: shown once the browser fires `beforeinstallprompt`; a click opens the install prompt.
 *  - iOS Safari (no install event): shown as a button that toggles a short "Add to Home Screen" tip.
 *  - Renders nothing when the app is already installed / running standalone, after `appinstalled`,
 *    and on browsers that can't install it.
 */

// Not in lib.dom.d.ts: Chromium's install prompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const noopSubscribe = () => () => {};

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || matchMedia("(display-mode: standalone)").matches;
}

/** iPhone / iPad (iPadOS reports itself as a Mac with a touch screen) in Safari, not yet on the home screen. */
function canAddToHomeScreenManually() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Other iOS browsers (Chrome, Firefox, Edge) carry their own token; Add to Home Screen from them differs.
  const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return safari && !isStandalone();
}

export function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // False on the server and during hydration, so the markup always matches.
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const iosSafari = useSyncExternalStore(noopSubscribe, canAddToHomeScreenManually, () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the prompt for our own button instead of the browser's mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setTipOpen(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Close the iOS tip on an outside click or Escape.
  useEffect(() => {
    if (!tipOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setTipOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTipOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [tipOpen]);

  if (installed || standalone || (!deferred && !iosSafari)) return null;

  async function install() {
    if (!deferred) {
      setTipOpen((o) => !o);
      return;
    }
    const event = deferred;
    setDeferred(null); // a prompt event can only be used once
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } catch {
      // prompt unavailable or already shown: nothing to do
    }
  }

  return (
    <div ref={root} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={install}
        aria-haspopup={deferred ? undefined : "dialog"}
        aria-expanded={deferred ? undefined : tipOpen}
        title="Install app"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-muted transition hover:bg-sunken hover:text-ink"
      >
        <Download className="size-[18px]" aria-hidden />
        <span className="hidden sm:inline">Install App</span>
        <span className="sr-only sm:hidden">Install App</span>
      </button>
      {tipOpen && (
        <div
          role="dialog"
          aria-label="Install app on iPhone or iPad"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line-strong bg-surface p-3 text-sm text-ink shadow-lg"
        >
          <p>
            Tap Share <Share className="mx-0.5 -mt-0.5 inline size-4" aria-label="(square with an arrow)" /> then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        </div>
      )}
    </div>
  );
}
