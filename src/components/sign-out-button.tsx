"use client";

import { useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOutAuth } from "@/lib/auth";
import { LogoutDriveAway } from "./logout-drive-away";
import { createPortal } from "react-dom";

export function SignOutButton({ onNavigate, className, children }: { onNavigate?: () => void; className?: string; children?: ReactNode }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSignOut(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    setLoggingOut(true);

    try {
      await signOutAuth();
    } catch (err) {
      console.error("Sign out error:", err);
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}

    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
    }

    setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
  }

  return (
    <>
      <button type="button" onClick={handleSignOut} className={className}>
        {children ?? (
          <>
            <LogOut className="size-4" /> Sign out
          </>
        )}
      </button>
      {loggingOut && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-black/80 backdrop-blur-sm text-white">
            <div className="flex flex-col items-center gap-5 text-center">
              <LogoutDriveAway className="h-32 w-auto" />
              <div>
                <p className="text-lg font-semibold tracking-tight">Shutting down engine…</p>
                <p className="mt-1 text-sm text-gray-300">See you tomorrow!</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
