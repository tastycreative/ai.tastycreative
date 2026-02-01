import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to resolve generator user info from clerkId
async function resolveGeneratorInfo(items: any[]): Promise<any[]> {
  // Collect unique generatedByClerkIds from metadata
  const generatorClerkIds = new Set<string>();
  items.forEach((item) => {
    const metadata = item.metadata as any;
    if (metadata?.generatedByClerkId) {
      generatorClerkIds.add(metadata.generatedByClerkId);
    }
  });

  // If no generator clerkIds found, return items as-is
  if (generatorClerkIds.size === 0) {
    return items;
  }

  // Fetch user info for all generator clerkIds
  const users = await prisma.user.findMany({
    where: {
      clerkId: { in: Array.from(generatorClerkIds) },
    },
    select: {
      clerkId: true,
      firstName: true,
      lastName: true,
      email: true,
      imageUrl: true,
    },
  });

  // Create a map for quick lookup
  const userMap = users.reduce((acc, user) => {
    acc[user.clerkId] = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imageUrl: user.imageUrl,
      displayName: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.email?.split('@')[0] || 'Unknown User',
    };
    return acc;
  }, {} as Record<string, { firstName: string | null; lastName: string | null; email: string | null; imageUrl: string | null; displayName: string }>);

  // Enrich items with generator info
  return items.map((item) => {
    const metadata = item.metadata as any;
    if (metadata?.generatedByClerkId && userMap[metadata.generatedByClerkId]) {
      const generatorInfo = userMap[metadata.generatedByClerkId];
      return {
        ...item,
        metadata: {
          ...metadata,
          generatedByName: generatorInfo.displayName,
          generatedByImageUrl: generatorInfo.imageUrl,
        },
      };
    }
    return item;
  });
}

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
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// GET /api/vault/items - Get all items for a folder or all items for a profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const profileId = searchParams.get("profileId");
    const sharedFolderId = searchParams.get("sharedFolderId"); // For accessing shared folders

    // Handle shared folder access
    if (sharedFolderId) {
      // Check if user has access to this shared folder
      const share = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: sharedFolderId,
            sharedWithClerkId: userId,
          },
        },
        include: {
          folder: true,
        },
      });

      if (!share) {
        return NextResponse.json(
          { error: "You don't have access to this folder" },
          { status: 403 }
        );
      }

      const items = await prisma.vaultItem.findMany({
        where: {
          folderId: sharedFolderId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Resolve generator info for shared folder items
      const enrichedItems = await resolveGeneratorInfo(items);

      return NextResponse.json(enrichedItems);
    }

    // Get user's organization for "all profiles" mode
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // Handle "all" profiles case OR no profileId - get items from all accessible profiles
    if (profileId === "all" || !profileId) {
      // Build profile query for "all profiles" mode
      const profileWhereCondition: any = {
        OR: [
          { clerkId: userId },
        ],
      };
      if (user?.currentOrganizationId) {
        profileWhereCondition.OR.push({ organizationId: user.currentOrganizationId });
      }

      const profiles = await prisma.instagramProfile.findMany({
        where: profileWhereCondition,
        select: { 
          id: true, 
          name: true, 
          clerkId: true,
          user: {
            select: { clerkId: true },
          },
        },
      });
      const profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<string, string>);

      // Build OR conditions for items - for each profile, get items owned by that profile's owner
      const itemOrConditions: { profileId: string; clerkId: string }[] = [];
      for (const profile of profiles) {
        const ownerClerkId = profile.clerkId || profile.user?.clerkId;
        if (ownerClerkId) {
          itemOrConditions.push({
            profileId: profile.id,
            clerkId: ownerClerkId,
          });
        }
      }

      // If no valid conditions, return empty array
      if (itemOrConditions.length === 0) {
        return NextResponse.json([]);
      }

      // Get items for all accessible profiles (only from profile owners)
      const items = await prisma.vaultItem.findMany({
        where: {
          OR: itemOrConditions,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Add profileName to each item
      const itemsWithProfileName = items.map((item) => ({
        ...item,
        profileName: item.profileId ? profileMap[item.profileId] || "Unknown" : undefined,
      }));

      // Resolve generator info for items
      const enrichedItems = await resolveGeneratorInfo(itemsWithProfileName);

      return NextResponse.json(enrichedItems);
    }

    // For specific profile, check if user has access
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
      
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied to this profile" }, { status: 403 });
      }

      // Determine the profile owner's clerkId for filtering items
      const profileOwnerClerkId = profile?.clerkId || profile?.user?.clerkId;

      // If we can't determine the owner, return empty array
      if (!profileOwnerClerkId) {
        return NextResponse.json([]);
      }

      // Build where clause for items - only show items from the profile owner
      const whereClause: { profileId: string; clerkId: string; folderId?: string } = {
        profileId: profileId,
        clerkId: profileOwnerClerkId,
      };
      
      if (folderId) {
        whereClause.folderId = folderId;
      }

      const items = await prisma.vaultItem.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
      });

      // Resolve generator info for items
      const enrichedItems = await resolveGeneratorInfo(items);

      return NextResponse.json(enrichedItems);
    }

    // This should not be reached, but return empty array as fallback
    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching vault items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// POST /api/vault/items - Create a new vault item (after file upload)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, folderId, fileName, fileType, fileSize, awsS3Key, awsS3Url } = body;

    if (!profileId || !folderId || !fileName || !fileType || !fileSize || !awsS3Key || !awsS3Url) {
      return NextResponse.json(
        { error: "All fields are required" },
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
        profileId: profileId,
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

    const item = await prisma.vaultItem.create({
      data: {
        clerkId: profileOwnerClerkId,
        profileId,
        folderId,
        fileName,
        fileType,
        fileSize,
        awsS3Key,
        awsS3Url,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error creating vault item:", error);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }
}
