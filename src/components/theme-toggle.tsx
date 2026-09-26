"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "./ui";

/*
 * Light / dark switch. With no choice saved the app follows the system setting;
 * a click saves an explicit theme on <html data-theme>. THEME_SCRIPT applies it before
 * first paint so there's no flash.
 */

const KEY = "tw-theme";
const listeners = new Set<() => void>();

// Also decides the splash: shown once per browser session, hidden before paint on later loads.
export const THEME_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${KEY}"),a=localStorage.getItem("tw-accent");if(t==="light"||t==="dark")d.dataset.theme=t;if(a)d.dataset.accent=a}catch(e){}try{if(sessionStorage.getItem("tw-splash"))document.documentElement.dataset.splash="seen";else sessionStorage.setItem("tw-splash","1")}catch(e){document.documentElement.dataset.splash="seen"}`;

function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

export type ThemeChoice = "light" | "dark" | "system";

/** Light, dark, or follow the device ("system": removes the saved choice). */
export function setTheme(theme: ThemeChoice) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  try {
    if (theme === "system") {
      delete root.dataset.theme;
      localStorage.removeItem(KEY);
    } else {
      root.dataset.theme = theme;
      localStorage.setItem(KEY, theme);
    }
  } catch {
    // storage blocked: theme still applies for this visit
  }
  listeners.forEach((l) => l());
  setTimeout(() => root.classList.remove("theme-switching"), 400);
}

function themeChoice(): ThemeChoice {
  const set = document.documentElement.dataset.theme;
  return set === "light" || set === "dark" ? set : "system";
}

/** The saved choice (not the effective theme). */
export function useThemeChoice() {
  return useSyncExternalStore(subscribe, themeChoice, () => "system" as const);
}

export function ThemeToggle({ className, onDark }: { className?: string; onDark?: boolean }) {
  const theme = useSyncExternalStore(subscribe, effectiveTheme, () => "light" as const);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border transition",
        // Positioned so the icons can stack; callers may pass their own position (e.g. absolute).
        !className?.includes("absolute") && "relative",
        onDark ? "border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20" : "border-line-strong bg-surface text-muted hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      <Sun className={cn("absolute size-[18px] transition-all duration-500", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")} />
      <Moon className={cn("absolute size-[18px] transition-all duration-500", dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
    </button>
  );
}
