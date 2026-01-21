import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

// GET - List all AI Voice Accounts
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const voices = await prisma.aIVoiceAccount.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Error fetching AI voice accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI voice accounts" },
      { status: 500 }
    );
  }
}

// POST - Add new AI Voice Account
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { elevenlabsVoiceId, name, description, customApiKey } = body;

    if (!elevenlabsVoiceId) {
      return NextResponse.json(
        { error: "ElevenLabs Voice ID is required" },
        { status: 400 }
      );
    }

    // Check if voice already exists
    const existingVoice = await prisma.aIVoiceAccount.findUnique({
      where: { elevenlabsVoiceId },
    });

    if (existingVoice) {
      return NextResponse.json(
        { error: "Voice account already exists" },
        { status: 400 }
      );
    }

    // Fetch voice details from ElevenLabs API
    const apiKey = customApiKey || ELEVENLABS_API_KEY;
    const voiceResponse = await fetch(
      `${ELEVENLABS_API_BASE}/v1/voices/${elevenlabsVoiceId}`,
      {
        headers: {
          "xi-api-key": apiKey || "",
        },
      }
    );

    if (!voiceResponse.ok) {
      const errorData = await voiceResponse.json().catch(() => ({}));
      console.error("ElevenLabs API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch voice from ElevenLabs. Please check the Voice ID." },
        { status: 400 }
      );
    }

    const voiceData = await voiceResponse.json();

    // Create the voice account
    const voice = await prisma.aIVoiceAccount.create({
      data: {
        name: name || voiceData.name || "Unnamed Voice",
        description: description || voiceData.description,
        elevenlabsVoiceId,
        elevenlabsApiKey: customApiKey || null,
        previewUrl: voiceData.preview_url,
        category: voiceData.category,
        gender: voiceData.labels?.gender,
        age: voiceData.labels?.age,
        accent: voiceData.labels?.accent,
        language: voiceData.labels?.language,
        labels: voiceData.labels,
        settings: voiceData.settings,
        createdBy: userId,
      },
    });

    return NextResponse.json({ voice });
  } catch (error) {
    console.error("Error creating AI voice account:", error);
    return NextResponse.json(
      { error: "Failed to create AI voice account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove AI Voice Account
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Voice account ID is required" },
        { status: 400 }
      );
    }

    await prisma.aIVoiceAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting AI voice account:", error);
    return NextResponse.json(
      { error: "Failed to delete AI voice account" },
      { status: 500 }
    );
  }
}

// PATCH - Update AI Voice Account
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, isActive, settings } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Voice account ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (settings !== undefined) updateData.settings = settings;

    const voice = await prisma.aIVoiceAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ voice });
  } catch (error) {
    console.error("Error updating AI voice account:", error);
    return NextResponse.json(
      { error: "Failed to update AI voice account" },
      { status: 500 }
    );
  }
}
