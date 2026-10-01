"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutAuth } from "@/lib/auth";
import { LogoutDriveAway } from "./logout-drive-away";

/** Matches the drive-away animation's own duration (globals.css) plus a beat so the redirect never cuts it off mid-motion. */
const LOGOUT_MS = 1500;

/**
 * Replaces the sidebar's old plain "Sign out" link: shows the drive-away overlay first, and only
 * clears the session and redirects to /login once it's actually played out - a fixed timer, not
 * tied to the animation's real (possibly reduced-motion-shortened) duration, so the sign-out
 * always takes a consistent, deliberate beat regardless of motion settings.
 */
export function SignOutButton({ onNavigate, className, children }: { onNavigate?: () => void; className?: string; children?: ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleSignOut() {
    onNavigate?.();
    setLoggingOut(true);
    setTimeout(() => {
      signOutAuth();
      router.push("/login");
    }, LOGOUT_MS);
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
      {loggingOut &&
        createPortal(
          <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-page/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5 text-center">
              <LogoutDriveAway className="h-32 w-auto" />
              <div>
                <p className="text-lg font-semibold tracking-tight">Shutting down engine…</p>
                <p className="mt-1 text-sm text-muted">See you tomorrow!</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
