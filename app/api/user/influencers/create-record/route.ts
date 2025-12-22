import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUserExists } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await ensureUserExists(userId);

    const body = await request.json();
    
    console.log('📝 Creating influencer record with data:', {
      name: body.name,
      fileName: body.fileName,
      syncStatus: body.syncStatus,
      fileSize: body.fileSize
    });

    // Map frontend status to database enum
    const mapSyncStatus = (status: string) => {
      switch(status?.toLowerCase()) {
        case 'synced': return 'SYNCED';
        case 'pending': return 'PENDING';
        case 'missing': return 'MISSING';
        case 'error': return 'ERROR';
        default: return 'PENDING';
      }
    };
    
    // Create a new influencer LoRA record
    const influencer = await prisma.influencerLoRA.create({
      data: {
        clerkId: userId,
        name: body.name,
        displayName: body.displayName || body.name,
        fileName: body.fileName,
        originalFileName: body.originalFileName || body.fileName,
        fileSize: body.fileSize || 0,
        description: body.description,
        thumbnailUrl: body.thumbnailUrl,
        cloudinaryUrl: body.cloudinaryUrl,
        cloudinaryPublicId: body.cloudinaryPublicId,
        comfyUIPath: body.comfyUIPath,
        trainingJobId: body.trainingJobId,
        syncStatus: mapSyncStatus(body.syncStatus),
        isActive: body.isActive ?? true,
        usageCount: body.usageCount ?? 0,
      },
    });

    console.log('✅ Influencer record created successfully:', influencer.id);
    return NextResponse.json(influencer);
  } catch (error) {
    console.error("❌ Error creating influencer record:", error);
    return NextResponse.json(
      { 
        error: "Failed to create influencer record",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
