import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUserExists } from "@/lib/database";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's influencer LoRAs
    const influencers = await prisma.influencerLoRA.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(influencers);
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
