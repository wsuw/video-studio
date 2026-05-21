import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const voicePath = searchParams.get("path");

    if (!voicePath) {
      return NextResponse.json(
        { error: "Query parameter 'path' is required" },
        { status: 400 }
      );
    }

    // Safety boundary check: ensure we resolve relative to the index-tts examples folder
    const baseDir = path.resolve(process.cwd(), "index-tts");
    const safePath = path.resolve(baseDir, voicePath);

    if (!safePath.startsWith(baseDir)) {
      return NextResponse.json(
        { error: "Access denied: Unauthorized directory access" },
        { status: 403 }
      );
    }

    if (!fs.existsSync(safePath)) {
      return NextResponse.json(
        { error: `Preset voice file not found: ${voicePath}` },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(safePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Preview Voice API] Streaming error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stream preview voice WAV" },
      { status: 500 }
    );
  }
}
