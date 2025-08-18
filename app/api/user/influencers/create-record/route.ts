// app/api/user/influencers/create-record/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('💾 Creating influencer record for manual upload');

    const body = await request.json();
    console.log('📋 Manual upload data:', body);

    const {
      name,
      displayName,
      fileName,
      originalFileName,
      fileSize,
      description,
      syncStatus,
      isActive,
      usageCount,
      comfyUIPath
    } = body;

    if (!name || !fileName || !fileSize) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, fileName, fileSize' 
      }, { status: 400 });
    }

    try {
      // Create new LoRA entry for manual upload
      const lora = await prisma.influencerLoRA.create({
        data: {
          clerkId: userId,
          name: name,
          displayName: displayName || name,
          fileName: fileName,
          originalFileName: originalFileName || fileName,
          fileSize: parseInt(fileSize.toString()),
          description: description || `Manually uploaded LoRA model`,
          comfyUIPath: comfyUIPath,
          syncStatus: 'SYNCED', // Use proper enum value
          isActive: isActive !== undefined ? isActive : true,
          usageCount: usageCount || 0
        }
      });

      console.log(`✅ Created manual upload LoRA record: ${lora.id}`);

      // Map database fields to frontend interface
      const mappedLora = {
        id: lora.id,
        userId: lora.clerkId, // Map clerkId to userId for frontend compatibility
        name: lora.name,
        displayName: lora.displayName,
        fileName: lora.fileName,
        originalFileName: lora.originalFileName,
        fileSize: lora.fileSize,
        uploadedAt: lora.uploadedAt.toISOString(),
        description: lora.description,
        thumbnailUrl: lora.thumbnailUrl,
        isActive: lora.isActive,
        usageCount: lora.usageCount,
        syncStatus: lora.syncStatus?.toLowerCase() as "pending" | "synced" | "missing" | "error",
        lastUsedAt: lora.lastUsedAt?.toISOString(),
        comfyUIPath: lora.comfyUIPath
      };

      return NextResponse.json({
        success: true,
        message: 'LoRA record created successfully',
        lora: mappedLora
      });

    } catch (dbError) {
      console.error('❌ Database error creating manual upload record:', dbError);
      return NextResponse.json({
        error: 'Database operation failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 Manual upload record creation error:', error);
    
    return NextResponse.json({
      error: 'Failed to create LoRA record',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Manual upload record creation endpoint is active',
    timestamp: new Date().toISOString(),
    supportedMethods: ['POST']
  });
}