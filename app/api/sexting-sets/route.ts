import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null; isShared: boolean }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile, isShared: false };
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
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile, isShared: true };
    }
  }

  return { hasAccess: false, profile: null, isShared: false };
}

// Helper function to get all accessible profile IDs for a user
async function getAccessibleProfileIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  const whereCondition: any = {
    OR: [
      { clerkId: userId },
    ],
  };

  if (user?.currentOrganizationId) {
    whereCondition.OR.push({ organizationId: user.currentOrganizationId });
  }

  const profiles = await prisma.instagramProfile.findMany({
    where: whereCondition,
    select: { id: true },
  });

  return profiles.map((p) => p.id);
}

// GET - Fetch all sexting sets for the user (optionally filtered by profileId)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const isAllProfiles = profileId === "all";

    // Get user's organization for shared profile access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // Build profile map for adding profile names
    let profileMap: Record<string, { name: string; clerkId: string; isShared: boolean }> = {};
    let accessibleProfileIds: string[] = [];

    if (isAllProfiles) {
      // Get all profiles the user has access to (own + organization)
      const whereCondition: any = {
        OR: [
          { clerkId: userId },
        ],
      };
      if (user?.currentOrganizationId) {
        whereCondition.OR.push({ organizationId: user.currentOrganizationId });
      }

      const profiles = await prisma.instagramProfile.findMany({
        where: whereCondition,
        select: { id: true, name: true, clerkId: true },
      });

      profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = {
          name: profile.name,
          clerkId: profile.clerkId,
          isShared: profile.clerkId !== userId,
        };
        return acc;
      }, {} as Record<string, { name: string; clerkId: string; isShared: boolean }>);

      accessibleProfileIds = profiles.map((p) => p.id);
    } else if (profileId) {
      // Verify profile access (own or shared via organization)
      const { hasAccess, profile, isShared } = await hasAccessToProfile(userId, profileId);

      if (!hasAccess || !profile) {
        return NextResponse.json(
          { error: "Profile not found or unauthorized" },
          { status: 404 }
        );
      }

      profileMap[profileId] = {
        name: profile.name,
        clerkId: profile.clerkId,
        isShared,
      };
    }

    // Build the query for sexting sets
    // For shared profiles, we need to get sets by category (profileId) regardless of userId
    let setsWhere: any = {};

    if (isAllProfiles) {
      // Get sets for all accessible profiles
      setsWhere = {
        category: { in: accessibleProfileIds },
      };
    } else if (profileId) {
      // Get sets for the specific profile
      setsWhere = {
        category: profileId,
      };
    } else {
      // No profile specified - get only user's own sets
      setsWhere = {
        userId,
      };
    }

    const sets = await prisma.sextingSet.findMany({
      where: setsWhere,
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Add profileName and isShared to each set
    const setsWithProfileInfo = sets.map((set) => ({
      ...set,
      profileName: profileMap[set.category]?.name || null,
      isSharedProfile: profileMap[set.category]?.isShared || false,
    }));

    return NextResponse.json({ sets: setsWithProfileInfo });
  } catch (error) {
    console.error("Error fetching sexting sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch sexting sets" },
      { status: 500 }
    );
  }
}

// POST - Create a new sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, profileId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Set name is required" },
        { status: 400 }
      );
    }

    // Determine the target profile ID
    const targetProfileId = profileId || category;

    // If a profile is specified, verify access
    if (targetProfileId && targetProfileId !== "general") {
      const { hasAccess, profile } = await hasAccessToProfile(userId, targetProfileId);

      if (!hasAccess || !profile) {
        return NextResponse.json(
          { error: "Profile not found or unauthorized" },
          { status: 404 }
        );
      }

      // Use the profile owner's userId for the set
      const setOwnerId = profile.clerkId;

      // Generate S3 folder path using the profile owner's ID
      const s3FolderPath = `sexting-sets/${setOwnerId}/${targetProfileId}/${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

      const set = await prisma.sextingSet.create({
        data: {
          userId: setOwnerId,
          name,
          category: targetProfileId,
          s3FolderPath,
          status: "draft",
        },
        include: {
          images: true,
        },
      });

      return NextResponse.json({ set });
    }

    // No profile specified - create for current user
    const s3FolderPath = `sexting-sets/${userId}/general/${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

    const set = await prisma.sextingSet.create({
      data: {
        userId,
        name,
        category: "general",
        s3FolderPath,
        status: "draft",
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error creating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to create sexting set" },
      { status: 500 }
    );
  }
}

// PATCH - Update a sexting set
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, status, scheduledDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Find the set first
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id },
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

    const set = await prisma.sextingSet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(status && { status }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
      },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error updating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to update sexting set" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sexting set
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Find the set first
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id },
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
        { error: "Unauthorized to delete this set" },
        { status: 403 }
      );
    }

    // Delete files from S3
    const bucket = process.env.AWS_S3_BUCKET!;
    
    try {
      // First, list all objects in the set's S3 folder
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: existingSet.s3FolderPath,
      });
      
      const listedObjects = await s3Client.send(listCommand);
      
      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        // Delete all objects in the folder
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key })),
            Quiet: true,
          },
        });
        
        await s3Client.send(deleteCommand);
      }
    } catch (s3Error) {
      console.error("Error deleting S3 files:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete will cascade to images due to schema relation
    await prisma.sextingSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sexting set:", error);
    return NextResponse.json(
      { error: "Failed to delete sexting set" },
      { status: 500 }
    );
  }
}
