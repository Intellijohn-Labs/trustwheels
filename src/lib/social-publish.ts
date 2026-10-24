import type { PhotoSlot } from "./types";

/*
 * Browser side of the Social Publish n8n workflow, reached through /api/social/* (which holds the
 * webhook secret). Both calls always resolve - a refusal, a validation problem or a network failure
 * all come back as the same {ok:false, ...} shape the workflow itself uses, so the UI has one path to render.
 */

export type SocialPlatform = "instagram" | "facebook";

/** Per-platform outcome. `not_posted` = held back because the other platform failed preflight. */
export type PlatformStatus = "success" | "processing" | "failed" | "already_posted" | "not_posted";

export interface PlatformResult {
  status: PlatformStatus;
  code?: string;
  message?: string;
  retryable?: boolean;
  /** none | wait | check_status | retry_later | retry_later_or_post_manually | post_manually | post_single | fix_input */
  action?: string;
  postUrl?: string | null;
  retryAfterSeconds?: number;
}

export interface PublishResponse {
  ok: boolean;
  processing?: boolean;
  requestId?: string;
  /** Present when the whole request was refused (validation, vehicle, service). */
  code?: string;
  message?: string;
  retryable?: boolean;
  action?: string;
  results?: Partial<Record<SocialPlatform, PlatformResult>>;
}

export interface PublishInput {
  vehicleId: string;
  caption: string;
  platforms: SocialPlatform[];
  imageKeys: PhotoSlot[];
}

const NETWORK_DOWN: PublishResponse = {
  ok: false,
  code: "SERVICE_DOWN",
  message: "Could not reach the server. Check your connection and try again.",
  retryable: true,
  action: "retry_later",
};

/**
 * We sent the request but never got the workflow's answer (gateway timeout, dropped connection). The post may well have
 * gone out, so this is not a failure to report - the caller re-reads the saved state with fetchSocialStatus() instead.
 */
const UNKNOWN_OUTCOME: PublishResponse = {
  ok: false,
  code: "UNKNOWN_OUTCOME",
  message: "No answer came back in time. Checking whether the post went through…",
  retryable: false,
  action: "check_status",
};

async function readJson(res: Response): Promise<PublishResponse | null> {
  try {
    const json = await res.json();
    return json && typeof json === "object" ? (json as PublishResponse) : null;
  } catch {
    return null;
  }
}

export async function publishToSocial(input: PublishInput): Promise<PublishResponse> {
  const requestId = crypto.randomUUID();
  try {
    const res = await fetch("/api/social/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, ...input }),
    });
    return (await readJson(res)) ?? { ...UNKNOWN_OUTCOME, requestId };
  } catch {
    // The connection dropped mid-request (a proxy timeout, a flaky network): the workflow may still have posted.
    return { ...UNKNOWN_OUTCOME, requestId };
  }
}

/** Latest known state per platform for a vehicle; the workflow refreshes any still-publishing posts first. */
export async function fetchSocialStatus(vehicleId: string): Promise<PublishResponse> {
  try {
    const res = await fetch(`/api/social/status?vehicleId=${encodeURIComponent(vehicleId)}`, { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as
      | { ok: boolean; posts?: { platform: SocialPlatform; status: string; postUrl: string | null; errorCode: string | null; message: string | null }[]; code?: string; message?: string; retryable?: boolean; action?: string }
      | null;
    if (!json) return NETWORK_DOWN;
    if (!json.ok) return json;
    const results: PublishResponse["results"] = {};
    // Rows arrive newest first, so the first one seen per platform is the current state.
    for (const p of json.posts ?? []) {
      if (results[p.platform]) continue;
      const status: PlatformStatus = p.status === "success" ? "success" : p.status === "pending" ? "processing" : "failed";
      results[p.platform] = {
        status,
        postUrl: p.postUrl,
        code: p.errorCode ?? undefined,
        message: status === "processing" ? "Still publishing. Check again in a minute." : (p.message ?? undefined),
        action: status === "processing" ? "check_status" : undefined,
        retryable: status === "failed" ? true : undefined,
      };
    }
    return { ok: true, results };
  } catch {
    return NETWORK_DOWN;
  }
}
