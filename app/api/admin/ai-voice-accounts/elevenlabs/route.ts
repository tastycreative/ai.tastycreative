import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

// GET - Fetch voices from ElevenLabs API
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const pageSize = searchParams.get("pageSize") || "30";

    // Build query params for ElevenLabs API v2
    const params = new URLSearchParams();
    params.set("page_size", pageSize);
    if (search) params.set("search", search);
    if (category) params.set("category", category);

    const response = await fetch(
      `${ELEVENLABS_API_BASE}/v2/voices?${params.toString()}`,
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("ElevenLabs API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch voices from ElevenLabs" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching ElevenLabs voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices from ElevenLabs" },
      { status: 500 }
    );
  }
}
