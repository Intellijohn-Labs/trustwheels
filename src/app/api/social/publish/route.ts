import { callN8n, failure } from "../_n8n";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return failure(400, "VALIDATION", "The request was not valid.", false, "fix_input");
  }
  // Only the fields the workflow reads are forwarded; it re-validates all of them itself.
  const { requestId, vehicleId, caption, platforms, imageKeys } = body;
  return callN8n(
    "N8N_SOCIAL_PUBLISH_URL",
    // `replace` is forwarded only when it is exactly true (n8n ignores anything else, and no other publish carries it).
    { method: "POST", body: { requestId, vehicleId, caption, platforms, imageKeys, ...(body.replace === true ? { replace: true } : {}) } },
    typeof requestId === "string" ? requestId : "",
  );
}
