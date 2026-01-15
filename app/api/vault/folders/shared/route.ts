import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET /api/vault/folders/shared - Get folders that are shared with the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId"); // Optional: filter by profile

    // Get all vault folders shared with this user
    const shares = await prisma.vaultFolderShare.findMany({
      where: {
        sharedWithClerkId: userId,
      },
      include: {
        folder: {
          include: {
            _count: {
              select: { items: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get owner details and profile info for each share
    const sharesWithDetails = await Promise.all(
      shares.map(async (share) => {
        // Get owner info
        const owner = await prisma.user.findUnique({
          where: { clerkId: share.ownerClerkId },
          select: { email: true, firstName: true, lastName: true, imageUrl: true },
        });

        const ownerName =
          owner?.firstName && owner?.lastName
            ? `${owner.firstName} ${owner.lastName}`
            : owner?.firstName || owner?.lastName || owner?.email || "Unknown";

        // Get the Instagram profile this folder belongs to
        const profile = await prisma.instagramProfile.findUnique({
          where: { id: share.folder.profileId },
          select: { id: true, name: true, instagramUsername: true, profileImageUrl: true },
        });

        return {
          id: share.id,
          folderId: share.folder.id,
          folderName: share.folder.name,
          profileId: share.folder.profileId,
          profileName: profile?.name || "Unknown Profile",
          profileUsername: profile?.instagramUsername,
          profileImageUrl: profile?.profileImageUrl,
          isDefault: share.folder.isDefault,
          itemCount: share.folder._count.items,
          permission: share.permission,
          sharedBy: share.sharedBy || ownerName,
          ownerClerkId: share.ownerClerkId,
          ownerName,
          ownerImageUrl: owner?.imageUrl,
          note: share.note,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
        };
      })
    );

    // Optionally filter by profile if specified
    const filteredShares = profileId
      ? sharesWithDetails.filter((s) => s.profileId === profileId)
      : sharesWithDetails;

    // Group by owner for better organization
    const groupedByOwner = filteredShares.reduce((acc, share) => {
      const key = share.ownerClerkId;
      if (!acc[key]) {
        acc[key] = {
          ownerClerkId: share.ownerClerkId,
          ownerName: share.ownerName,
          ownerImageUrl: share.ownerImageUrl,
          folders: [],
        };
      }
      acc[key].folders.push(share);
      return acc;
    }, {} as Record<string, { ownerClerkId: string; ownerName: string; ownerImageUrl?: string | null; folders: typeof sharesWithDetails }>);

    return NextResponse.json({
      shares: filteredShares,
      groupedByOwner: Object.values(groupedByOwner),
      totalSharedFolders: filteredShares.length,
    });
  } catch (error) {
    console.error("Error fetching shared vault folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared folders" },
      { status: 500 }
    );
  }
}
