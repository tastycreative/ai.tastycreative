import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Proxy endpoint to download files from S3 (avoiding CORS issues)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.searchParams.get("url");
    const fileName = request.nextUrl.searchParams.get("fileName") || "download";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the file from S3
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    const headers = new Headers();
    headers.set("Content-Type", blob.type || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Content-Length", blob.size.toString());

    return new NextResponse(blob, { headers });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
