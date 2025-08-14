// app/api/comfyui/sync-loras/route.ts - ComfyUI Integration Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';

// Type definition for pending LoRA data
type PendingLoRA = {
  id: string;
  fileName: string;
  clerkId: string;
  displayName: string;
  fileSize: number;
};

// POST endpoint that ComfyUI can call to get pending LoRAs
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 ComfyUI sync request received');
    
    // Import database functions
    const { PrismaClient } = require('@/lib/generated/prisma');
    const prisma = new PrismaClient();
    
    try {
      // Get all pending LoRAs across all users
      const pendingLoras = await prisma.influencerLoRA.findMany({
        where: {
          syncStatus: 'pending'
        },
        select: {
          id: true,
          fileName: true,
          clerkId: true,
          displayName: true,
          fileSize: true
        }
      });
      
      console.log(`📊 Found ${pendingLoras.length} pending LoRAs to sync`);
      
      // For each pending LoRA, provide download info
      const downloadTasks = await Promise.all(pendingLoras.map(async (lora: PendingLoRA) => {
        // Get the blob URL from database or construct it
        const blobUrl = await getBlobUrlForLora(lora.id);
        
        return {
          id: lora.id,
          fileName: lora.fileName,
          displayName: lora.displayName,
          fileSize: lora.fileSize,
          downloadUrl: blobUrl,
          targetPath: `models/loras/${lora.fileName}`,
          userId: lora.clerkId
        };
      }));
      
      return NextResponse.json({
        success: true,
        message: `Found ${pendingLoras.length} LoRAs to sync`,
        loras: downloadTasks,
        instructions: {
          note: 'Download each file from downloadUrl and place in targetPath',
          endpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/comfyui/mark-synced`
        }
      });
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('💥 ComfyUI sync error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get pending LoRAs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to get blob URL for a LoRA
async function getBlobUrlForLora(loraId: string): Promise<string | null> {
  try {
    // This would need to be implemented based on how you store blob URLs
    // For now, construct from the standard pattern
    const { PrismaClient } = require('@/lib/generated/prisma');
    const prisma = new PrismaClient();
    
    const lora = await prisma.influencerLoRA.findUnique({
      where: { id: loraId },
      select: { fileName: true, clerkId: true }
    });
    
    if (!lora) return null;
    
    // Construct blob URL from known pattern
    return `https://kwjks4nt08wcoqbn.public.blob.vercel-storage.com/loras/${lora.clerkId}/${lora.fileName}`;
    
  } catch (error) {
    console.error('Error getting blob URL:', error);
    return null;
  }
}

// PUT endpoint to mark LoRAs as synced
export async function PUT(request: NextRequest) {
  try {
    const { loraIds } = await request.json();
    
    if (!Array.isArray(loraIds)) {
      return NextResponse.json({
        success: false,
        error: 'loraIds must be an array'
      }, { status: 400 });
    }
    
    console.log(`✅ Marking ${loraIds.length} LoRAs as synced`);
    
    const { PrismaClient } = require('@/lib/generated/prisma');
    const prisma = new PrismaClient();
    
    try {
      await prisma.influencerLoRA.updateMany({
        where: {
          id: {
            in: loraIds
          }
        },
        data: {
          syncStatus: 'synced',
          isActive: true,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Successfully marked ${loraIds.length} LoRAs as synced`);
      
      return NextResponse.json({
        success: true,
        message: `Marked ${loraIds.length} LoRAs as synced`,
        updated: loraIds.length
      });
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('💥 Error marking LoRAs as synced:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to mark LoRAs as synced',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
