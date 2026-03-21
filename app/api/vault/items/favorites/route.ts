import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST /api/vault/items/favorites - Get vault items by IDs (for favorites)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json([]);
    }

    // Limit to prevent abuse
    const limitedIds = itemIds.slice(0, 100);

    // Get user's accessible profiles
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build profile access conditions
    const profileWhere: any = {
      OR: [{ clerkId: userId }],
    };
    if (user.currentOrganizationId) {
      profileWhere.OR.push({ organizationId: user.currentOrganizationId });
    }

    const accessibleProfiles = await prisma.instagramProfile.findMany({
      where: profileWhere,
      select: { id: true },
    });

    const accessibleProfileIds = new Set(accessibleProfiles.map((p) => p.id));

    // Also get shared folder IDs for the user
    const sharedFolders = await prisma.vaultFolderShare.findMany({
      where: { sharedWithClerkId: userId },
      select: { vaultFolderId: true },
    });
    const sharedFolderIds = new Set(sharedFolders.map((s) => s.vaultFolderId));

    // Fetch items by IDs
    const items = await prisma.vaultItem.findMany({
      where: {
        id: { in: limitedIds },
        deletedAt: null,
      },
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter to only items the user has access to
    const accessibleItems = items.filter(
      (item) =>
        accessibleProfileIds.has(item.profileId) ||
        sharedFolderIds.has(item.folderId),
    );

    // Fetch profile info for accessible items
    const profileIds = [...new Set(accessibleItems.map((i) => i.profileId))];
    const profiles = await prisma.instagramProfile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, name: true, instagramUsername: true },
    });
    const profileMap = profiles.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, { id: string; name: string; instagramUsername: string | null }>);

    const enrichedItems = accessibleItems.map((item) => ({
      ...item,
      profile: profileMap[item.profileId] ?? null,
    }));

    return NextResponse.json(enrichedItems);
  } catch (error) {
    console.error("Error fetching favorite vault items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
