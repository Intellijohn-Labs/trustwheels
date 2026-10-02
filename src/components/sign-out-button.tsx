"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutAuth } from "@/lib/auth";
import { beginLogoutFlow, endLogoutFlow } from "@/lib/login-flow";
import { LogoutDriveAway } from "./logout-drive-away";

/** Matches the drive-away animation's own duration (globals.css) plus a beat so the navigation never cuts it off mid-motion. */
const LOGOUT_MS = 1500;

/**
 * Replaces the sidebar's old plain "Sign out" link. Local state is cleared and the Supabase
 * session starts revoking immediately on click, not gated behind the animation; the drive-away
 * overlay then plays for its own fixed beat before actually navigating to /login - a timer, not
 * tied to the animation's real (possibly reduced-motion-shortened) duration, so the sign-out
 * always takes a consistent, deliberate beat regardless of motion settings. beginLogoutFlow()/
 * endLogoutFlow() tell AppShell's session guard to keep this page mounted for that beat even
 * though the session is already gone underneath - otherwise AppShell reacts to the session change
 * the instant it lands and yanks this page (and the portal overlay it owns) to a loading screen
 * mid-animation.
 */
export function SignOutButton({ onNavigate, className, children }: { onNavigate?: () => void; className?: string; children?: ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleSignOut() {
    onNavigate?.();
    beginLogoutFlow();
    setLoggingOut(true);
    void signOutAuth();
    setTimeout(() => {
      endLogoutFlow();
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
