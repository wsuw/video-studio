import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get("url");

    if (!videoUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let targetUrl = videoUrl;
    if (targetUrl.startsWith("/")) {
      const requestOrigin = new URL(req.url).origin;
      targetUrl = `${requestOrigin}${targetUrl}`;
    }

    console.log(`[Download Proxy] Fetching from target url: ${targetUrl}`);

    const res = await fetch(targetUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch source: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    const filename = targetUrl.split("/").pop()?.split("?")[0] || "video.mp4";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    if (!res.body) {
      throw new Error("No body received from source fetch");
    }

    return new Response(res.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[Download Proxy] Error proxying download:", error);
    
    // Fallback: Redirect directly to the original video url
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get("url");
    if (videoUrl) {
      return NextResponse.redirect(videoUrl);
    }
    return NextResponse.json({ error: error.message || "Failed to download" }, { status: 500 });
  }
}
