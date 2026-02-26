import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { z } from "zod";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

const shareVaultFolderSchema = z.object({
  vaultFolderId: z.string().min(1),
  sharedWithClerkIds: z.array(z.string().min(1)).min(1),
  permission: z.enum(["VIEW", "EDIT"]).default("VIEW"),
  note: z.string().optional(),
});

// POST /api/vault/folders/share - Share a vault folder with users
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { vaultFolderId, sharedWithClerkIds, permission, note } =
      shareVaultFolderSchema.parse(body);

    // Verify the user owns this folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: vaultFolderId },
      include: {
        _count: { select: { items: true } },
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Check if user owns the folder OR has access to the profile
    const isOwner = folder.clerkId === userId;
    const hasProfileAccess = folder.profileId 
      ? await hasAccessToProfileSimple(userId, folder.profileId)
      : false;

    if (!isOwner && !hasProfileAccess) {
      return NextResponse.json(
        { error: "You can only share folders you own or have access to" },
        { status: 403 }
      );
    }

    // Get current user's name for display
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const userName =
      currentUser?.firstName && currentUser?.lastName
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser?.firstName || currentUser?.lastName || "";
    const sharedBy = userName || currentUser?.email || userId;

    // Create shares for all specified users
    const shares = await Promise.all(
      sharedWithClerkIds.map((sharedWithClerkId) =>
        prisma.vaultFolderShare.upsert({
          where: {
            vaultFolderId_sharedWithClerkId: {
              vaultFolderId,
              sharedWithClerkId,
            },
          },
          update: {
            permission,
            note,
            sharedBy,
            updatedAt: new Date(),
          },
          create: {
            vaultFolderId,
            ownerClerkId: userId,
            sharedWithClerkId,
            permission,
            note,
            sharedBy,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      shares,
      message: `Folder shared with ${shares.length} user(s)`,
    });
  } catch (error) {
    console.error("Error sharing vault folder:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to share folder" },
      { status: 500 }
    );
  }
}

// GET /api/vault/folders/share - Get list of users a folder is shared with
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vaultFolderId = searchParams.get("vaultFolderId");

    if (!vaultFolderId) {
      return NextResponse.json(
        { error: "vaultFolderId is required" },
        { status: 400 }
      );
    }

    // Verify the user owns this folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: vaultFolderId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.clerkId !== userId) {
      return NextResponse.json(
        { error: "You can only view sharing info for your own folders" },
        { status: 403 }
      );
    }

    const shares = await prisma.vaultFolderShare.findMany({
      where: {
        vaultFolderId,
        ownerClerkId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get user details for each share
    const sharesWithUserInfo = await Promise.all(
      shares.map(async (share) => {
        const user = await prisma.user.findUnique({
          where: { clerkId: share.sharedWithClerkId },
          select: { email: true, firstName: true, lastName: true, imageUrl: true },
        });

        const displayName = user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.firstName || user?.lastName || user?.email || share.sharedWithClerkId;

        return {
          ...share,
          sharedWithUser: user
            ? {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                imageUrl: user.imageUrl,
                displayName,
              }
            : null,
        };
      })
    );

    return NextResponse.json(sharesWithUserInfo);
  } catch (error) {
    console.error("Error getting vault folder shares:", error);
    return NextResponse.json(
      { error: "Failed to get shares" },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/folders/share - Remove share access
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { vaultFolderId, sharedWithClerkId } = body;

    if (!vaultFolderId || !sharedWithClerkId) {
      return NextResponse.json(
        { error: "vaultFolderId and sharedWithClerkId are required" },
        { status: 400 }
      );
    }

    // Verify the user owns this folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: vaultFolderId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.clerkId !== userId) {
      return NextResponse.json(
        { error: "You can only remove shares from your own folders" },
        { status: 403 }
      );
    }

    await prisma.vaultFolderShare.delete({
      where: {
        vaultFolderId_sharedWithClerkId: {
          vaultFolderId,
          sharedWithClerkId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Share removed successfully",
    });
  } catch (error) {
    console.error("Error removing vault folder share:", error);
    return NextResponse.json(
      { error: "Failed to remove share" },
      { status: 500 }
    );
  }
}
