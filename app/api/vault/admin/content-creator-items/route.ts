import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET /api/vault/admin/content-creator-items - Get all vault items from Content Creator users (Admin only)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const contentCreatorId = searchParams.get("contentCreatorId");

    // Get all content creators
    const contentCreators = await prisma.user.findMany({
      where: {
        role: 'CONTENT_CREATOR'
      },
      select: {
        id: true,
        clerkId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // If a specific content creator is selected, get their items
    if (contentCreatorId) {
      const contentCreator = contentCreators.find(cc => cc.id === contentCreatorId || cc.clerkId === contentCreatorId);
      
      if (!contentCreator) {
        return NextResponse.json({ error: "Content creator not found" }, { status: 404 });
      }

      const items = await prisma.vaultItem.findMany({
        where: {
          clerkId: contentCreator.clerkId,
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              isDefault: true,
            }
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Fetch profiles for the content creator to map profile names
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: contentCreator.clerkId },
        select: { id: true, name: true, instagramUsername: true }
      });
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Fetch folders for the content creator
      const folders = await prisma.vaultFolder.findMany({
        where: { clerkId: contentCreator.clerkId },
        select: {
          id: true,
          name: true,
          profileId: true,
          isDefault: true,
          _count: {
            select: { items: true }
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' }
        ]
      });

      // Map folders with item count
      const foldersWithCount = folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        profileId: folder.profileId,
        isDefault: folder.isDefault,
        itemCount: folder._count.items,
        profileName: profileMap.get(folder.profileId)?.name || 'Unknown Profile'
      }));

      return NextResponse.json({
        contentCreators,
        selectedContentCreator: contentCreator,
        folders: foldersWithCount,
        profiles,
        items: items.map(item => ({
          ...item,
          creatorName: `${contentCreator.firstName || ''} ${contentCreator.lastName || ''}`.trim() || contentCreator.email || 'Unknown',
          creatorId: contentCreator.id,
          profile: profileMap.get(item.profileId) || null,
        })),
      });
    }

    // If no specific content creator, return all items from all content creators
    const contentCreatorClerkIds = contentCreators.map(cc => cc.clerkId);
    
    const allItems = await prisma.vaultItem.findMany({
      where: {
        clerkId: {
          in: contentCreatorClerkIds,
        },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            isDefault: true,
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch all profiles for the content creators to map profile names
    const allProfiles = await prisma.instagramProfile.findMany({
      where: { clerkId: { in: contentCreatorClerkIds } },
      select: { id: true, name: true, instagramUsername: true }
    });
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));

    // Map items with creator information
    const itemsWithCreatorInfo = allItems.map(item => {
      const creator = contentCreators.find(cc => cc.clerkId === item.clerkId);
      return {
        ...item,
        creatorName: creator 
          ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email || 'Unknown'
          : 'Unknown',
        creatorId: creator?.id || null,
        profile: profileMap.get(item.profileId) || null,
      };
    });

    return NextResponse.json({
      contentCreators,
      selectedContentCreator: null,
      items: itemsWithCreatorInfo,
    });
  } catch (error) {
    console.error("Error fetching content creator vault items:", error);
    return NextResponse.json(
      { error: "Failed to fetch content creator items" },
      { status: 500 }
    );
  }
}
