import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUserExists } from "@/lib/database";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's own influencer LoRAs
    const ownInfluencers = await prisma.influencerLoRA.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        shares: {
          select: {
            id: true,
            sharedWithClerkId: true,
          },
        },
      },
    });

    // Fetch LoRAs shared with this user
    const sharedLoRAs = await prisma.loRAShare.findMany({
      where: {
        sharedWithClerkId: userId,
      },
      include: {
        lora: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Format own influencers
    const formattedOwnInfluencers = ownInfluencers.map((inf) => ({
      ...inf,
      isShared: false,
      hasShares: inf.shares.length > 0, // This LoRA is shared with others
      shares: undefined, // Remove shares from response
    }));

    // Format shared influencers
    const formattedSharedInfluencers = sharedLoRAs.map((share) => {
      const owner = share.lora.user;
      const ownerName = owner?.firstName && owner?.lastName 
        ? `${owner.firstName} ${owner.lastName}`
        : owner?.firstName || owner?.lastName || '';
      
      return {
        ...share.lora,
        isShared: true,
        sharedBy: share.sharedBy || ownerName || owner?.email || 'Unknown',
        shareNote: share.note,
        ownerClerkId: share.ownerClerkId,
        hasShares: false,
      };
    });

    // Combine both lists
    const allInfluencers = [...formattedOwnInfluencers, ...formattedSharedInfluencers];

    return NextResponse.json(allInfluencers);
  } catch (error) {
    console.error("Error fetching influencers:", error);
    return NextResponse.json(
      { error: "Failed to fetch influencers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await ensureUserExists(userId);

    const body = await request.json();
    
    // Create a new influencer LoRA record
    const influencer = await prisma.influencerLoRA.create({
      data: {
        clerkId: userId,
        name: body.name,
        displayName: body.displayName,
        fileName: body.fileName,
        originalFileName: body.originalFileName,
        fileSize: body.fileSize,
        description: body.description,
        thumbnailUrl: body.thumbnailUrl,
        cloudinaryUrl: body.cloudinaryUrl,
        cloudinaryPublicId: body.cloudinaryPublicId,
        comfyUIPath: body.comfyUIPath,
        trainingJobId: body.trainingJobId,
      },
    });

    return NextResponse.json(influencer);
  } catch (error) {
    console.error("Error creating influencer:", error);
    return NextResponse.json(
      { error: "Failed to create influencer" },
      { status: 500 }
    );
  }
}
