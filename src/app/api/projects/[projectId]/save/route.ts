import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const agentUrl = process.env.AGENT_URL || "http://localhost:8123";

    // Fetch state from LangGraph
    const response = await fetch(`${agentUrl}/threads/${projectId}/state`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ script: "" }); // New project
      }
      throw new Error("Failed to fetch graph state");
    }

    const state = await response.json();
    const design = state.values?.design || {};
    const script = design.script || "";
    const scenes = design.scenes || [];
    const isApproved = design.is_approved || false;

    return NextResponse.json({ script, scenes, isApproved });
  } catch (error) {
    console.error("Fetch state error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    // Allow partial updates to the design state
    const designUpdate: any = {};
    if (body.script !== undefined) designUpdate.script = body.script;
    if (body.scenes !== undefined) designUpdate.scenes = body.scenes;
    if (body.is_approved !== undefined) designUpdate.is_approved = body.is_approved;

    const agentUrl = process.env.AGENT_URL || "http://localhost:8123";

    // Call the NATIVE LangGraph Platform API update_state endpoint
    const response = await fetch(`${agentUrl}/threads/${projectId}/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: {
          design: designUpdate
        }
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update graph state");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
