import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Helper function to search ElevenLabs history for a matching item
async function searchElevenLabsHistory(
  apiKey: string,
  text: string,
  voiceAccountId: string | null
): Promise<string | null> {
  try {
    // Get voice account to find voiceId if we have one
    let voiceId: string | undefined;
    if (voiceAccountId) {
      const voiceAccount = await prisma.ai_voice_accounts.findUnique({
        where: { id: voiceAccountId },
      });
      voiceId = voiceAccount?.elevenlabsVoiceId;
    }

    // Search recent history - check last 100 items
    const searchUrl = new URL(`${ELEVENLABS_API_BASE}/v1/history`);
    searchUrl.searchParams.set("page_size", "100");
    if (voiceId) {
      searchUrl.searchParams.set("voice_id", voiceId);
    }

    const historyResponse = await fetch(searchUrl.toString(), {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!historyResponse.ok) {
      return null;
    }

    const historyData = await historyResponse.json();
    
    // Find matching item by text content
    const normalizedSearchText = text.trim().toLowerCase();
    const matchingItem = historyData.history?.find((item: { text?: string }) => {
      const itemText = (item.text || "").trim().toLowerCase();
      return itemText === normalizedSearchText;
    });

    return matchingItem?.history_item_id || null;
  } catch (error) {
    console.error("Error searching ElevenLabs history:", error);
    return null;
  }
}

// GET - Stream audio from ElevenLabs history
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const historyItemId = searchParams.get("historyItemId");

    if (!historyItemId) {
      return NextResponse.json(
        { error: "History item ID is required" },
        { status: 400 }
      );
    }

    // Get the generation record to check for custom API key and get details
    const generation = await prisma.ai_voice_generations.findFirst({
      where: {
        id: historyItemId,
        userId,
      },
      include: {
        ai_voice_accounts: true,
      },
    });

    // Use custom API key if available, otherwise use default
    const apiKey = generation?.ai_voice_accounts?.elevenlabsApiKey || ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key configured" },
        { status: 500 }
      );
    }

    // First, try to fetch directly with the ID (works for new generations with ElevenLabs IDs)
    let response = await fetch(
      `${ELEVENLABS_API_BASE}/v1/history/${historyItemId}/audio`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    // If not found, it might be an old UUID-style ID - search by text content
    if (!response.ok && generation?.text) {
      console.log("Direct fetch failed, searching ElevenLabs history by text...");
      
      const elevenlabsHistoryId = await searchElevenLabsHistory(
        apiKey,
        generation.text,
        generation.voiceAccountId
      );

      if (elevenlabsHistoryId) {
        console.log(`Found matching history item: ${elevenlabsHistoryId}`);
        
        // Update our database with the correct ElevenLabs history ID for future requests
        // Note: We can't change the primary key, but we could add a separate field
        
        // Try fetching with the found ID
        response = await fetch(
          `${ELEVENLABS_API_BASE}/v1/history/${elevenlabsHistoryId}/audio`,
          {
            headers: {
              "xi-api-key": apiKey,
            },
          }
        );
      }
    }

    if (!response.ok) {
      console.error("ElevenLabs history audio error:", response.status);
      return NextResponse.json(
        { 
          error: "Audio not found in ElevenLabs history. This may be an older generation that is no longer available.",
          details: "ElevenLabs history items expire after 90 days."
        },
        { status: 404 }
      );
    }

    // Stream the audio response
    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("Error fetching history audio:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio" },
      { status: 500 }
    );
  }
}
