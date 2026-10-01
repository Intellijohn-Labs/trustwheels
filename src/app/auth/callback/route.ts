import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * PKCE code exchange, server-side. Password-recovery (and, incidentally, sign-up confirmation)
 * links point here instead of straight at /reset-password, because the exchange needs the
 * code_verifier that was generated and cookie-stored when resetPasswordForEmail()/signUp() was
 * first called - doing the exchange in the browser only works if that's the exact same browser,
 * which an email link often isn't (a different device, a different browser, a copy-pasted URL).
 * Running it here instead means it works regardless of which browser actually opens the link, as
 * long as the cookie made it to this request.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/reset-password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
