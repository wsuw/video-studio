import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "speech-samples", "_voices_local.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([], { status: 200 });
    }
    const fileContent = fs.readFileSync(filePath, "utf8");
    const voices = JSON.parse(fileContent);
    return NextResponse.json(voices);
  } catch (error: any) {
    console.error("Failed to read local voice database:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
