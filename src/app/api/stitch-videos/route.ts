import { NextResponse } from "next/server";

export const maxDuration = 900; // 15 minutes execution limit

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrls } = body;

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "videoUrls must be a non-empty array" }, { status: 400 });
    }

    const wan2gpApiUrl = process.env.WAN2GP_API_URL || "http://localhost:8126";
    const stitchApiUrl = `${wan2gpApiUrl.replace(/\/$/, "")}/stitch-videos`;

    console.log(`[Stitch Proxy] Sending stitch request to Python Server: ${stitchApiUrl}`);

    const res = await fetch(stitchApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ video_urls: videoUrls }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Python server error: ${errorText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Stitch Proxy] Error stitching videos:", error);
    return NextResponse.json({ error: error.message || "Failed to stitch videos" }, { status: 500 });
  }
}
