import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch user's generation history
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");

    const generations = await prisma.ai_voice_generations.findMany({
      where: {
        userId,
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        voiceName: true,
        text: true,
        characterCount: true,
        modelId: true,
        outputFormat: true,
        audioUrl: true,
        audioSize: true,
        voiceSettings: true,
        createdAt: true,
      },
    });

    const nextCursor = generations.length === limit ? generations[generations.length - 1]?.id : null;

    return NextResponse.json({
      generations,
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json(
      { error: "Failed to fetch generations" },
      { status: 500 }
    );
  }
}

// POST - Save a new generation to history
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      voiceAccountId,
      voiceName,
      text,
      characterCount,
      modelId,
      outputFormat,
      audioUrl,
      audioSize,
      voiceSettings,
    } = body;

    if (!voiceAccountId || !voiceName || !text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const generation = await prisma.ai_voice_generations.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        voiceAccountId,
        voiceName,
        text,
        characterCount: characterCount || text.length,
        modelId: modelId || "eleven_multilingual_v2",
        outputFormat: outputFormat || "mp3_44100_128",
        audioUrl,
        audioSize,
        voiceSettings,
      },
    });

    return NextResponse.json({ generation });
  } catch (error) {
    console.error("Error saving generation:", error);
    return NextResponse.json(
      { error: "Failed to save generation" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a generation from history
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get("id");

    if (!generationId) {
      return NextResponse.json(
        { error: "Generation ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const generation = await prisma.ai_voice_generations.findFirst({
      where: {
        id: generationId,
        userId,
      },
    });

    if (!generation) {
      return NextResponse.json(
        { error: "Generation not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.ai_voice_generations.delete({
      where: { id: generationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting generation:", error);
    return NextResponse.json(
      { error: "Failed to delete generation" },
      { status: 500 }
    );
  }
}
