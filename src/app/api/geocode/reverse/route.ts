import { NextRequest, NextResponse } from "next/server";

/*
 * Server-side reverse geocoding proxy for GPS attendance check-ins.
 *
 * Nominatim's usage policy requires a real identifying User-Agent, and browser `fetch` can't set
 * that header (it's on the forbidden-headers list) - calling Nominatim directly from the client
 * gets silently rejected/rate-limited, which is why check-ins were landing as "Unknown location".
 * Routing the request through this server route (Node's fetch has no such restriction) fixes that.
 */

const USER_AGENT = "TrustWheelsApp/1.0 (contact@dealership.com)";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ place_name: null }, { status: 400 });
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return NextResponse.json({ place_name: null });

    const body = await res.json();
    const address = body?.address as Record<string, string> | undefined;
    if (!address) return NextResponse.json({ place_name: null });

    const locality = address.suburb ?? address.town ?? address.city ?? address.village ?? address.county;
    const region = address.state_district ?? address.state;
    const parts = [locality, region].filter((p, i, arr): p is string => !!p && arr.indexOf(p) === i);
    return NextResponse.json({ place_name: parts.length ? parts.join(", ") : null });
  } catch {
    return NextResponse.json({ place_name: null });
  }
}
