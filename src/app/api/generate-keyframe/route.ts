import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      height = 1024,
      width = 1024,
      guidance_scale = 1.0,
      num_inference_steps = 8,
      seed = 0,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Call the local Python Flux.2 Klein server on port 8124
    const fluxServerUrl = process.env.FLUX_SERVER_URL || "http://localhost:8124/generate";
    console.log(`[API Proxy] Sending request to Flux.2 Klein Server... (URL: ${fluxServerUrl})`);
    const response = await fetch(fluxServerUrl, {
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
    
    // The backend returns the complete URL directly in data.url
    const url = data.url;

    return NextResponse.json({
      status: "success",
      url: url,
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
