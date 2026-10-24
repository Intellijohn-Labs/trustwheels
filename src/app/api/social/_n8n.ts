import { NextResponse } from "next/server";

/*
 * Server-side proxy to the "Trust Wheels - Social Publish" n8n workflow. The webhooks sit behind
 * header auth, so the browser never calls them directly - the secret lives only in these env vars:
 *   N8N_SOCIAL_PUBLISH_URL, N8N_SOCIAL_STATUS_URL   the two webhook URLs
 *   N8N_WEBHOOK_AUTH_HEADER, N8N_WEBHOOK_AUTH_VALUE  the header name/value of the "Header Auth trust wheels" credential
 * The workflow already answers with {ok, code, message, retryable, action, ...} bodies and a matching
 * HTTP status, so a response from n8n is passed through untouched; only failures to reach it are shaped here.
 */

export function failure(status: number, code: string, message: string, retryable: boolean, action: string, requestId = "") {
  return NextResponse.json({ ok: false, requestId, code, message, retryable, action }, { status });
}

export async function callN8n(urlEnv: string, init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown }, requestId = "") {
  const base = process.env[urlEnv];
  const header = process.env.N8N_WEBHOOK_AUTH_HEADER;
  const value = process.env.N8N_WEBHOOK_AUTH_VALUE;
  if (!base || !header || !value) {
    console.error(`Social publish is not configured: set ${urlEnv}, N8N_WEBHOOK_AUTH_HEADER and N8N_WEBHOOK_AUTH_VALUE`);
    return failure(500, "SERVICE_CONFIG", "Posting is not set up correctly. Post manually and tell the admin.", false, "post_manually", requestId);
  }

  const url = new URL(base);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  try {
    const res = await fetch(url, {
      method: init.method,
      headers: { [header]: value, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      // The workflow waits on Zernio for up to 90s before it answers.
      signal: AbortSignal.timeout(100_000),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (json && typeof json === "object") return NextResponse.json(json, { status: res.status });
    // n8n answered with something that isn't the workflow's JSON (workflow inactive, gateway error, auth rejected).
    if (res.status === 401 || res.status === 403) {
      return failure(500, "SERVICE_CONFIG", "Posting is not set up correctly. Post manually and tell the admin.", false, "post_manually", requestId);
    }
    return failure(503, "SERVICE_DOWN", "The posting service is not responding. Try again in a minute, or post manually.", true, "retry_later_or_post_manually", requestId);
  } catch (err) {
    console.error("Social publish proxy error:", err);
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return failure(
      503,
      "SERVICE_DOWN",
      timedOut
        ? "Publishing is taking longer than expected. Check the status before trying again, to avoid a duplicate post."
        : "Could not reach the posting service. Try again in a minute, or post manually.",
      true,
      timedOut ? "check_status" : "retry_later_or_post_manually",
      requestId,
    );
  }
}
