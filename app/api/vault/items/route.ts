import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

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

      return NextResponse.json(items);
    }

    // Build where clause - if profileId provided, filter by it; otherwise get all user items
    const whereClause: { clerkId: string; profileId?: string; folderId?: string } = {
      clerkId: userId,
    };
    
    if (profileId) {
      whereClause.profileId = profileId;
    }
    
    if (folderId) {
      whereClause.folderId = folderId;
    }

    // Build profile map for "all profiles" mode (when no profileId specified)
    let profileMap: Record<string, string> = {};
    if (!profileId) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: userId },
        select: { id: true, name: true },
      });
      profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    // Get items based on the where clause
    const items = await prisma.vaultItem.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Add profileName to each item when in "all profiles" mode
    const itemsWithProfileName = !profileId ? items.map((item) => ({
      ...item,
      profileName: item.profileId ? profileMap[item.profileId] || "Unknown" : undefined,
    })) : items;

    return NextResponse.json(itemsWithProfileName);
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

    const item = await prisma.vaultItem.create({
      data: {
        clerkId: userId,
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
