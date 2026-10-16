import { NextResponse } from "next/server";
import { query } from "@/lib/server-db";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check user and password in hr_employees table
    const result = await query(
      `SELECT id, data FROM hr_employees WHERE lower(data->>'email') = $1 AND (data->>'status') = 'active' LIMIT 1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid email or inactive employee" }, { status: 401 });
    }

    const row = result.rows[0];
    const employeeData = row.data;

    // Check password
    if (employeeData.password !== password) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!employeeData.rbacRole) {
      return NextResponse.json({ error: "This employee does not have a system login role." }, { status: 403 });
    }

    // Return the authenticated employee and role
    return NextResponse.json({
      success: true,
      resolved: {
        employee: { id: row.id, ...employeeData },
        role: employeeData.rbacRole,
      },
    });
  } catch (err: any) {
    console.error("Auth error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
