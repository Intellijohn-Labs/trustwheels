import { NextResponse } from "next/server";
import { query } from "@/lib/server-db";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if employee exists and is active
    const result = await query(
      `SELECT id, data FROM hr_employees WHERE lower(data->>'email') = $1 AND (data->>'status') = 'active' LIMIT 1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "This email isn't registered to an active employee. Contact your Managing Partner." },
        { status: 404 }
      );
    }

    // Step 1: Verification check only (when password is empty)
    if (password === "") {
      return NextResponse.json({ success: true, message: "Email verified" });
    }

    const row = result.rows[0];
    let employeeData = typeof row.data === "string" ? JSON.parse(row.data) : { ...row.data };

    if (!employeeData.rbacRole) {
      return NextResponse.json(
        { error: "This employee does not have a system login role assigned." },
        { status: 403 }
      );
    }

    // Update password
    employeeData.password = String(password);

    await query(
      `UPDATE hr_employees SET data = $1::jsonb WHERE id = $2`,
      [JSON.stringify(employeeData), row.id]
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err: any) {
    console.error("Signup/Reset error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
