import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
      num_inference_steps = 40,
      guidance_scale = 4.0,
      seed = 0,
      sceneId = "default"
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Ensure public/videos/outputs directory exists
    const outputsDir = path.join(process.cwd(), "public", "videos", "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // Generate a unique filename using sceneId, seed, and timestamp
    const filename = `scene_${sceneId}_seed_${seed}_${Date.now()}.mp4`;
    const absoluteOutputPath = path.join(outputsDir, filename);

    // Call the local Python LTX-2 server on port 8125
    const ltxServerUrl = process.env.LTX_SERVER_URL || "http://localhost:8125/generate";
    console.log(`[API Proxy] Sending request to LTX-2 Server... Path: ${absoluteOutputPath} (URL: ${ltxServerUrl})`);
    const response = await fetch(ltxServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt,
        width,
        height,
        num_frames,
        frame_rate,
        num_inference_steps,
        guidance_scale,
        seed,
        output_path: absoluteOutputPath,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Proxy] LTX-2 server returned status ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Python model server error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API Proxy] LTX-2 server generation success:`, data);
    
    // Web-accessible URL for Next.js static files
    const webUrl = `/videos/outputs/${filename}`;

    return NextResponse.json({
      status: "success",
      url: webUrl,
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
