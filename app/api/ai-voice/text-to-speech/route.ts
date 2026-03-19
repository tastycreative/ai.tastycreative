import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { uploadToAwsS3 } from "@/lib/awsS3Utils";

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
    let extension = "mp3";
    if (outputFormat.startsWith("pcm_")) {
      mimeType = "audio/pcm";
      extension = "pcm";
    } else if (outputFormat.startsWith("ulaw_")) {
      mimeType = "audio/basic";
      extension = "ulaw";
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

        const generationId = crypto.randomUUID();
        const filename = `voice-${generationId}.${extension}`;

        // Upload audio to S3 for persistent storage
        let audioUrl: string | null = null;
        let s3Key: string | null = null;
        try {
          const uploadResult = await uploadToAwsS3(
            Buffer.from(audioBuffer),
            userId,
            filename,
            mimeType,
            { type: "images" } // reuses the existing folder structure
          );
          if (uploadResult.success && uploadResult.publicUrl) {
            audioUrl = uploadResult.publicUrl;
            s3Key = uploadResult.s3Key || null;
          }
        } catch (uploadError) {
          console.error("S3 upload failed (audio still returned to client):", uploadError);
        }

        // Save generation to history with the permanent CDN URL
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
            audioUrl,
            awsS3Key: s3Key,
            audioSize: audioBuffer.byteLength,
            voiceSettings: voiceSettings || null,
          },
        });

        console.log("Generation saved successfully:", { generationId: generation.id, userId, voiceName: voiceAccount.name, audioUrl });

        return NextResponse.json({
          success: true,
          audio: base64Audio,
          mimeType,
          format: outputFormat,
          characterCount: text.length,
          generationId: generation.id,
          audioUrl,
        });
      } catch (dbError) {
        console.error("Error saving generation to database:", dbError);
        return NextResponse.json({
          success: true,
          audio: base64Audio,
          mimeType,
          format: outputFormat,
          characterCount: text.length,
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
    });
  } catch (error) {
    console.error("Error in text-to-speech:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
