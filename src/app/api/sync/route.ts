import { NextResponse } from "next/server";
import { query } from "@/lib/server-db";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

const ALLOWED_TABLES = new Set([
  "vehicles",
  "leads",
  "calls",
  "campaigns",
  "funds",
  "gps_attendance",
  "hr_employees",
  "ledger_entries",
  "settlements",
  "activity_logs",
  "escalation_contacts",
  "escalation-contacts",
  "branches",
  "payments",
  "deliveries",
  "enquiries",
  "attendance",
  "hr-attendance",
  "hr-leave",
  "hr-rosters"
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "vehicles";
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "Unsupported table" }, { status: 400 });

    const res = await query(`SELECT data FROM ${table}`);
    const data = res.rows.map((r: { data: unknown }) => (typeof r.data === "string" ? JSON.parse(r.data) : r.data));
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, items } = body;
    const rawRows = Array.isArray(items) ? items : body.id ? [body] : [];

    if (!table || !ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    for (const item of rawRows) {
      const rowId = item.id;
      if (!rowId) continue;
      const payload = item.data !== undefined ? item.data : item;
      await query(
        `INSERT INTO ${table} (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = $2::jsonb`,
        [rowId, JSON.stringify(payload)],
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");
    const idsParam = searchParams.get("ids") || searchParams.get("id");
    if (!table || !ALLOWED_TABLES.has(table) || !idsParam) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    await query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [ids]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
