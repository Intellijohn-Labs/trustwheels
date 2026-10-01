import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/*
 * createBrowserClient (not plain createClient) specifically because PKCE's code_verifier has to
 * be readable from the server too: resetPasswordForEmail()/signUp() generate and store it the
 * moment they're called, and the exchange that completes the flow happens later, for a password
 * reset in src/app/auth/callback/route.ts - a server Route Handler with no access to this
 * browser's localStorage. createClient's default storage is localStorage-only, so a verifier
 * stored there is invisible to that route no matter what; createBrowserClient stores it in a
 * cookie instead, which rides along on the request to the server automatically.
 */
export const supabase = supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: "pkce" } }) : null;
