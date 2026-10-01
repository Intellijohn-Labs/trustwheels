import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server-side counterpart to lib/supabase.ts's browser client, for the one place this app needs
 * one: the PKCE code-exchange Route Handler (app/auth/callback/route.ts). Reads/writes the same
 * cookies the browser client set, so the code_verifier it generated when resetPasswordForEmail()
 * was called is visible here. Per @supabase/ssr's own guidance, a fresh client is created per
 * request - never share one across requests.
 */
export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called somewhere that can't set cookies (e.g. a Server Component) - fine for this
          // app, which only ever calls this from the callback route, where setting always works.
        }
      },
    },
  });
}
