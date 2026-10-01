import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null until the env vars are set, so importing this module never crashes call sites
// that fall back to local data when Supabase isn't configured yet.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Password-recovery and email-confirmation links redirect back with a `?code=` to
        // exchange, not a `#access_token=` fragment - the client's own URL detection (which runs
        // once, automatically, on load) only completes that exchange when its flowType matches
        // what the link actually is. Left at the default ('implicit'), a PKCE-style link's
        // exchange silently throws inside the client and no session is ever established, which is
        // exactly why /reset-password was seeing "link invalid or expired" on an otherwise valid,
        // unused link.
        flowType: "pkce",
      },
    })
  : null;
