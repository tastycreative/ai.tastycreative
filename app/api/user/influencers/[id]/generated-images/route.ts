import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/user/influencers/[id]/generated-images
 * Fetches images generated using this specific LoRA model
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the influencer exists and belongs to the user or is shared with them
    const influencer = await prisma.influencerLoRA.findFirst({
      where: {
        id,
        OR: [
          { clerkId: userId },
          {
            shares: {
              some: {
                sharedWithClerkId: userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        fileName: true,
        name: true,
        displayName: true,
      },
    });

    if (!influencer) {
      return NextResponse.json(
        { error: "Influencer not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`🔍 Searching for images generated with LoRA: ${influencer.fileName}`);
    console.log(`🔍 Also checking for: ${influencer.name}`);

    // Find all images where this LoRA was used (using the new loraModels field)
    const images = await prisma.generatedImage.findMany({
      where: {
        clerkId: userId,
        loraModels: {
          hasSome: [influencer.fileName], // PostgreSQL array contains operator
        },
      },
      select: {
        id: true,
        filename: true,
        awsS3Url: true,
        networkVolumePath: true,
        width: true,
        height: true,
        createdAt: true,
        jobId: true,
        loraModels: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit for performance
    });

    console.log(`✅ Found ${images.length} images generated with this LoRA`);

    // Transform to match the expected format
    const relevantImages = images.map(image => ({
      id: image.id,
      filename: image.filename,
      url: image.awsS3Url || image.networkVolumePath || null,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      jobId: image.jobId,
    }));

    return NextResponse.json({
      success: true,
      images: relevantImages,
      influencer: {
        id: influencer.id,
        name: influencer.displayName,
      },
    });
  } catch (error) {
    console.error("Error fetching generated images:", error);

    const message =
      error instanceof Error ? error.message : "Failed to fetch generated images";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
