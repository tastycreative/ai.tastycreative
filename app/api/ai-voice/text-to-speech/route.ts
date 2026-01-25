import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      voiceId,
      text,
      modelId = "eleven_multilingual_v2",
      voiceSettings,
      outputFormat = "mp3_44100_128",
    } = body;

    if (!voiceId) {
      return NextResponse.json(
        { error: "Voice ID is required" },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Check character limit (ElevenLabs has limits based on plan)
    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Text exceeds maximum length of 5000 characters" },
        { status: 400 }
      );
    }

    // Check if voice exists in our database and get custom API key if available
    const voiceAccount = await prisma.ai_voice_accounts.findFirst({
      where: {
        elevenlabsVoiceId: voiceId,
        isActive: true,
      },
    });

    console.log("Voice lookup:", { voiceId, found: !!voiceAccount, voiceAccountId: voiceAccount?.id });

    // Use custom API key if available, otherwise use default
    const apiKey = voiceAccount?.elevenlabsApiKey || ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key configured" },
        { status: 500 }
      );
    }

    // Prepare request body
    const requestBody: Record<string, unknown> = {
      text,
      model_id: modelId,
    };

    // Add voice settings if provided
    if (voiceSettings) {
      requestBody.voice_settings = {
        stability: voiceSettings.stability ?? 0.5,
        similarity_boost: voiceSettings.similarityBoost ?? 0.75,
        style: voiceSettings.style ?? 0,
        use_speaker_boost: voiceSettings.useSpeakerBoost ?? true,
        speed: voiceSettings.speed ?? 1.0,
      };
    }

    // Call ElevenLabs Text-to-Speech API
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("ElevenLabs TTS API error:", errorData);
      return NextResponse.json(
        { 
          error: errorData.detail?.message || "Failed to generate speech",
          details: errorData 
        },
        { status: response.status }
      );
    }

    // Get the audio data as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for easy transport
    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    
    // Determine MIME type based on output format
    let mimeType = "audio/mpeg";
    if (outputFormat.startsWith("pcm_")) {
      mimeType = "audio/pcm";
    } else if (outputFormat.startsWith("ulaw_")) {
      mimeType = "audio/basic";
    }

    // Fetch the most recent history item from ElevenLabs to get the history_item_id
    let historyItemId: string | null = null;
    try {
      const historyResponse = await fetch(
        `${ELEVENLABS_API_BASE}/v1/history?page_size=1&voice_id=${voiceId}`,
        {
          headers: {
            "xi-api-key": apiKey,
          },
        }
      );
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.history && historyData.history.length > 0) {
          historyItemId = historyData.history[0].history_item_id;
        }
      }
    } catch (historyError) {
      console.error("Error fetching history item ID:", historyError);
    }

    // Update usage count for the voice
    if (voiceAccount) {
      try {
        await prisma.ai_voice_accounts.update({
          where: { id: voiceAccount.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Use the ElevenLabs history_item_id as our generation ID for easy retrieval
        const generationId = historyItemId || crypto.randomUUID();

        // Save generation to history - we'll fetch audio from ElevenLabs history API
        const generation = await prisma.ai_voice_generations.create({
          data: {
            id: generationId,
            userId,
            voiceAccountId: voiceAccount.id,
            voiceName: voiceAccount.name,
            text: text.trim(),
            characterCount: text.length,
            modelId,
            outputFormat,
            audioSize: audioBuffer.byteLength,
            voiceSettings: voiceSettings || null,
          },
        });

        console.log("Generation saved successfully:", { generationId: generation.id, userId, voiceName: voiceAccount.name });

        return NextResponse.json({
          success: true,
          audio: base64Audio,
          mimeType,
          format: outputFormat,
          characterCount: text.length,
          generationId: generation.id,
          historyItemId,
        });
      } catch (dbError) {
        console.error("Error saving generation to database:", dbError);
        // Still return the audio even if DB save failed
        return NextResponse.json({
          success: true,
          audio: base64Audio,
          mimeType,
          format: outputFormat,
          characterCount: text.length,
          historyItemId,
          warning: "Audio generated but failed to save to history",
        });
      }
    }

    console.log("Voice account not found, generation not tracked:", { voiceId });

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      mimeType,
      format: outputFormat,
      characterCount: text.length,
      historyItemId,
    });
  } catch (error) {
    console.error("Error in text-to-speech:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
