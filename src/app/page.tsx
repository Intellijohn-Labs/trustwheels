"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Entry point - normally just bounces to /login (AppShell's session guard sends an already
 * signed-in visitor on from there to /dashboard). A client component, not a plain server-side
 * redirect("/login"), specifically so a password-recovery link that ends up here (if Supabase's
 * Auth "Site URL" is configured to the bare origin rather than a specific page) can be routed
 * straight to /reset-password with its hash intact, instead of bouncing through /login first.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      router.replace(`/reset-password${hash}`);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
