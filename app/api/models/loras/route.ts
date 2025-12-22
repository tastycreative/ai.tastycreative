import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Fetching LoRA models for user: ${userId}`);

    // Fetch user's uploaded LoRA models from database
    const userLoRAs = await prisma.influencerLoRA.findMany({
      where: {
        clerkId: userId,
        isActive: true, // Only active LoRAs
        syncStatus: 'SYNCED', // Only successfully synced LoRAs
      },
      orderBy: {
        uploadedAt: 'desc', // Most recent first
      },
      select: {
        id: true,
        displayName: true,
        fileName: true,
        originalFileName: true,
        fileSize: true,
        uploadedAt: true,
        comfyUIPath: true,
        usageCount: true,
      },
    });

    console.log(`📋 Found ${userLoRAs.length} LoRA models for user`);

    // Convert to format expected by text-to-image page
    const loraModels = [
      // Always include "None" option first
      {
        fileName: "None",
        displayName: "No LoRA (Base Model)",
        name: "none",
        id: "none",
        fileSize: 0,
        uploadedAt: new Date().toISOString(),
        usageCount: 0,
        networkVolumePath: null,
      },
      // Add user's uploaded LoRAs
      ...userLoRAs.map(lora => ({
        fileName: lora.fileName,
        displayName: lora.displayName,
        name: lora.displayName.toLowerCase().replace(/\s+/g, '_'),
        id: lora.id,
        fileSize: lora.fileSize,
        uploadedAt: lora.uploadedAt.toISOString(),
        usageCount: lora.usageCount,
        networkVolumePath: `/runpod-volume/loras/${userId}/${lora.fileName}`,
        originalFileName: lora.originalFileName,
        comfyUIPath: lora.comfyUIPath,
      }))
    ];

    console.log(`✅ Returning ${loraModels.length} LoRA models (including "None" option)`);

    // Log sample for debugging
    if (loraModels.length > 1) {
      console.log(`📸 Sample LoRA: ${loraModels[1].displayName} - ${Math.round(loraModels[1].fileSize / 1024 / 1024)}MB`);
    }

    return NextResponse.json({ 
      success: true,
      models: loraModels,
      total: loraModels.length - 1, // Subtract 1 for the "None" option
      message: `Found ${loraModels.length - 1} custom LoRA models`
    });

  } catch (error) {
    console.error('❌ Error fetching LoRA models:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch LoRA models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
