import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      height = 1024,
      width = 1024,
      guidance_scale = 1.0,
      num_inference_steps = 4,
      seed = 0,
      sceneId = "default"
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Ensure public/images/outputs directory exists
    const outputsDir = path.join(process.cwd(), "public", "images", "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // Generate a unique filename using sceneId, seed, and timestamp
    const filename = `scene_${sceneId}_seed_${seed}_${Date.now()}.png`;
    const absoluteOutputPath = path.join(outputsDir, filename);

    // Call the local Python Flux.2 Klein server on port 8124
    console.log(`[API Proxy] Sending request to Flux.2 Klein Server... Path: ${absoluteOutputPath}`);
    const response = await fetch("http://localhost:8124/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        height,
        width,
        guidance_scale,
        num_inference_steps,
        seed,
        output_path: absoluteOutputPath,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Proxy] Flux server returned status ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Python model server error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API Proxy] Flux server generation success:`, data);
    
    // Web-accessible URL for Next.js static files
    const webUrl = `/images/outputs/${filename}`;

    return NextResponse.json({
      status: "success",
      url: webUrl,
      elapsed_seconds: data.elapsed_seconds,
    });
  } catch (error: any) {
    console.error("[Generate API] Error calling Python model server:", error);
    return NextResponse.json(
      { error: error.message || "Failed to contact Python model server" },
      { status: 500 }
    );
  }
}
