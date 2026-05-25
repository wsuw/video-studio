import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path ? path.join("/") : "";
    const searchParams = req.nextUrl.searchParams.toString();
    const agentUrl = process.env.AGENT_URL || "http://192.168.1.4:8123";
    const targetUrl = `${agentUrl}/${pathStr}${searchParams ? `?${searchParams}` : ""}`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("LangGraph proxy GET error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path ? path.join("/") : "";
    const body = await req.json().catch(() => ({}));
    const agentUrl = process.env.AGENT_URL || "http://192.168.1.4:8123";
    const targetUrl = `${agentUrl}/${pathStr}`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("LangGraph proxy POST error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
