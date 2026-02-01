import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// POST - Reorder images within a sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setId, imageIds } = body;

    if (!setId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { error: "Set ID and image IDs array are required" },
        { status: 400 }
      );
    }

    // Find the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId },
      include: { images: true },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, existingSet.category);

    // Also allow if user owns the set directly
    if (!hasAccess && existingSet.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this set" },
        { status: 403 }
      );
    }

    // Update sequence for each image
    const updatePromises = imageIds.map((imageId: string, index: number) =>
      prisma.sextingImage.updateMany({
        where: {
          id: imageId,
          setId: setId, // Ensure image belongs to this set
        },
        data: {
          sequence: index + 1, // 1-based sequence
        },
      })
    );

    await Promise.all(updatePromises);

    // Fetch updated set with images
    const updatedSet = await prisma.sextingSet.findUnique({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({ set: updatedSet });
  } catch (error) {
    console.error("Error reordering sexting set images:", error);
    return NextResponse.json(
      { error: "Failed to reorder images" },
      { status: 500 }
    );
  }
}
