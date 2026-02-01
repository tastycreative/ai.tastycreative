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

// This endpoint confirms uploads after direct S3 upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { setId, uploadedFiles } = await request.json();

    if (!setId || !uploadedFiles || !Array.isArray(uploadedFiles)) {
      return NextResponse.json(
        { error: "Set ID and uploaded files array required" },
        { status: 400 }
      );
    }

    // Find the set
    const set = await prisma.sextingSet.findFirst({
      where: {
        id: setId,
      },
    });

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 });
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, set.category);

    // Also allow if user owns the set directly
    if (!hasAccess && set.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this set" },
        { status: 403 }
      );
    }

    // Create database records for the uploaded files
    const images = await prisma.$transaction(
      uploadedFiles.map((file: {
        fileId: string;
        finalUrl: string;
        originalName: string;
        type: string;
        size: number;
        sequence: number;
      }) =>
        prisma.sextingImage.create({
          data: {
            id: file.fileId,
            setId: setId,
            url: file.finalUrl,
            name: file.originalName,
            type: file.type,
            size: file.size,
            sequence: file.sequence,
          },
        })
      )
    );

    return NextResponse.json({ 
      success: true, 
      images,
      message: `${images.length} file(s) uploaded successfully` 
    });
  } catch (error) {
    console.error("Error confirming uploads:", error);
    return NextResponse.json(
      { error: "Failed to confirm uploads" },
      { status: 500 }
    );
  }
}
