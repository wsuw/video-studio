import { NextResponse } from "next/server";
import http from "http";
import https from "https";

// Extend global Node.js http.Server default timeouts to 15 minutes to prevent Next.js dev server socket timeouts
if (http.Server.prototype) {
  http.Server.prototype.timeout = 900000; // 15 minutes
  http.Server.prototype.keepAliveTimeout = 900000;
  http.Server.prototype.headersTimeout = 900000;
  console.log("[API Proxy] Extended global Node.js http.Server default timeouts to 15 minutes.");
}

export const maxDuration = 900; // 15 minutes execution limit

function httpRequest(url: string, body: string, timeoutMs: number): Promise<{ statusCode?: number, body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    };

    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.request(options, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          body: responseBody,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Connection timed out after ${timeoutMs}ms`));
    });

    req.write(body);
    req.end();
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      negative_prompt = "worst quality, inconsistent motion, blurry, jittery, distorted",
      width = 768,
      height = 512,
      num_frames = 121,
      frame_rate = 24.0,
      num_inference_steps = 8,
      guidance_scale = 4.0,
      seed = 0,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Call the local Python unified Wan2GP server
    const wan2gpApiUrl = process.env.WAN2GP_API_URL || "http://localhost:8126";
    const videoServerUrl = `${wan2gpApiUrl.replace(/\/$/, "")}/generate/video`;
    console.log(`[API Proxy] Sending request to Video Server... (URL: ${videoServerUrl})`);

    const requestPayload = JSON.stringify({
      prompt,
      model_type: "ltx2_22B_distilled_1_1",
      resolution: `${width}x${height}`,
      duration_seconds: num_frames / frame_rate,
      video_length: num_frames,
      force_fps: frame_rate,
      custom_settings: {
        negative_prompt,
        num_inference_steps_stage1: num_inference_steps,
        guidance_scale_stage1: guidance_scale,
        seed,
      }
    });

    const result = await httpRequest(videoServerUrl, requestPayload, 900000); // 15 minutes timeout

    if (result.statusCode !== 200) {
      console.error(`[API Proxy] Video server returned status ${result.statusCode}: ${result.body}`);
      return NextResponse.json(
        { error: `Python model server error: ${result.body}` },
        { status: result.statusCode || 500 }
      );
    }

    const data = JSON.parse(result.body);
    console.log(`[API Proxy] Video server generation success:`, data);

    // The backend returns the complete URL directly in data.url or data.files[0]
    let url = data.url || (data.files && data.files[0]);

    // Rewrite any relative or local hostnames to use the correct public domain
    if (url) {
      try {
        if (url.startsWith("/")) {
          const origin = new URL(videoServerUrl).origin;
          url = `${origin}${url}`;
        } else {
          const urlObj = new URL(url);
          if (
            urlObj.hostname === "localhost" ||
            urlObj.hostname === "127.0.0.1" ||
            urlObj.hostname === "0.0.0.0"
          ) {
            const serverOrigin = new URL(videoServerUrl).origin;
            url = `${serverOrigin}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
          }
        }
      } catch (e) {
        console.warn("[API Proxy] Failed to rewrite video URL:", e);
      }
    }

    console.log(`[API Proxy] Returning corrected video URL:`, url);

    return NextResponse.json({
      status: "success",
      url: url,
      elapsed_seconds: data.elapsed_seconds,
    });
  } catch (error: any) {
    console.error("[Generate Video API] Error calling Python LTX-2 server:", error);
    return NextResponse.json(
      { error: error.message || "Failed to contact Python LTX-2 server" },
      { status: 500 }
    );
  }
}
