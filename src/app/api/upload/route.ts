import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "photos";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || ".jpg";
    const baseName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    
    const targetDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, baseName);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${folder}/${baseName}`;
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Local Upload Error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload" }, { status: 500 });
  }
}
