"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Entry point - normally just bounces to /login (AppShell's session guard sends an already
 * signed-in visitor on from there to /dashboard). A client component, not a plain server-side
 * redirect("/login"), specifically so an auth email link that ends up here (if Supabase's Auth
 * "Site URL" is configured to the bare origin rather than a specific page) still reaches the
 * right place instead of just dead-ending on /login:
 *
 * - A `#access_token=...&type=recovery` hash is unambiguous - straight to /reset-password with
 *   the hash intact.
 * - A bare `?code=...` isn't: both the password-recovery and the sign-up email-confirmation links
 *   use this shape, and only the recovery one belongs on /reset-password. Rather than guess, this
 *   forwards it to /login (keeping the query string) - the Supabase client's own automatic
 *   exchange resolves the code into a real auth event there, and AppShell's session guard already
 *   routes a resulting PASSWORD_RECOVERY event on to /reset-password from any page.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      router.replace(`/reset-password${hash}`);
    } else if (/[?&]code=/.test(window.location.search)) {
      router.replace(`/login${window.location.search}`);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
