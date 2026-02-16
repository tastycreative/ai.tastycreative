import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { trackStorageUpload } from "@/lib/storageEvents";

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

  // Get the profile to check if it belongs to an organization
  const profile = await prisma.instagramProfile.findUnique({
    where: { id: profileId },
    select: { 
      id: true,
      organizationId: true,
      name: true,
      clerkId: true,
    },
  });

  if (!profile?.organizationId) {
    return { hasAccess: false, profile: null }; // Profile doesn't belong to an organization
  }

  // Check if user is a member of the organization that owns this profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { 
      id: true,
      currentOrganizationId: true,
      teamMemberships: {
        where: {
          organizationId: profile.organizationId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return { hasAccess: false, profile: null };
  }

  // User has access if they're a member of the organization
  if (user.teamMemberships.length > 0) {
    return { hasAccess: true, profile };
  }

  // Fallback: check if currentOrganizationId matches (for backward compatibility)
  if (user.currentOrganizationId === profile.organizationId) {
    return { hasAccess: true, profile };
  }

  return { hasAccess: false, profile: null };
}

// POST /api/vault/confirm-upload - Confirm upload and create vault item record
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { s3Key, awsS3Url, fileName, fileType, fileSize, profileId, folderId } = await request.json();

    if (!s3Key || !awsS3Url || !fileName || !fileType || !profileId || !folderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user has access to this profile
    const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this profile" },
        { status: 403 }
      );
    }

    // Verify the folder exists and belongs to this profile
    const folder = await prisma.vaultFolder.findFirst({
      where: {
        id: folderId,
        profileId,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found or access denied" },
        { status: 404 }
      );
    }

    // Determine the profile owner's clerkId for consistency
    const profileOwnerClerkId = profile?.clerkId || profile?.user?.clerkId || userId;

    // Create vault item in database
    const vaultItem = await prisma.vaultItem.create({
      data: {
        clerkId: profileOwnerClerkId,
        profileId,
        folderId,
        fileName,
        fileType,
        fileSize: fileSize || 0,
        awsS3Key: s3Key,
        awsS3Url,
      },
    });

    // Track storage usage for the organization (non-blocking)
    if (fileSize && fileSize > 0) {
      trackStorageUpload(profileOwnerClerkId, fileSize).catch((error) => {
        console.error('Failed to track storage upload:', error);
      });
    }

    return NextResponse.json(vaultItem);
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
