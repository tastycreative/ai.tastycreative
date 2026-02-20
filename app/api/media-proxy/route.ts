import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "tastycreative.s3.us-east-1.amazonaws.com",
  "tastycreative.s3.amazonaws.com",
];

/**
 * Server-side media proxy for GIF export.
 * Streams media from S3 through the app server so the client gets a same-origin
 * response that won't taint an HTML canvas.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Upstream fetch failed" },
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = upstream.headers.get("Content-Length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Stream the response body through without buffering
    return new NextResponse(upstream.body, { headers });
  } catch {
    return NextResponse.json(
      { error: "Failed to proxy media" },
      { status: 502 }
    );
  }
}
