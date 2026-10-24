import { NextRequest } from "next/server";
import { callN8n, failure } from "../_n8n";

export async function GET(req: NextRequest) {
  const vehicleId = req.nextUrl.searchParams.get("vehicleId");
  if (!vehicleId) return failure(400, "VALIDATION", "vehicleId is required", false, "fix_input");
  return callN8n("N8N_SOCIAL_STATUS_URL", { method: "GET", query: { vehicleId } });
}
