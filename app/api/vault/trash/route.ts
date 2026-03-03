import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { deleteMultipleFromS3 } from "@/lib/s3-cleanup";
import { trackStorageDelete } from "@/lib/storageEvents";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

const TRASH_RETENTION_DAYS = 30;

// GET /api/vault/trash - List all trashed items for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    // Build where clause for trashed items
    const whereClause: any = {
      deletedAt: { not: null },
    };

    if (profileId && profileId !== "all") {
      // Verify access to this profile
      const hasAccess = await hasAccessToProfileSimple(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      whereClause.profileId = profileId;
    } else {
      // Get all profiles the user has access to
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { currentOrganizationId: true },
      });

      const profileCondition: any = {
        OR: [{ clerkId: userId }],
      };
      if (user?.currentOrganizationId) {
        profileCondition.OR.push({ organizationId: user.currentOrganizationId });
      }

      const profiles = await prisma.instagramProfile.findMany({
        where: profileCondition,
        select: { id: true, clerkId: true, user: { select: { clerkId: true } } },
      });

      const profileOrConditions = profiles.map((p) => ({
        profileId: p.id,
        clerkId: p.clerkId || p.user?.clerkId || userId,
      }));

      if (profileOrConditions.length === 0) {
        return NextResponse.json([]);
      }

      whereClause.OR = profileOrConditions;
    }

    const items = await prisma.vaultItem.findMany({
      where: whereClause,
      include: {
        folder: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
      orderBy: { deletedAt: "desc" },
    });

    // Enrich items with days remaining info
    const now = new Date();
    const enrichedItems = items.map((item) => {
      const deletedAt = item.deletedAt!;
      const daysSinceDeleted = Math.floor(
        (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysRemaining = Math.max(0, TRASH_RETENTION_DAYS - daysSinceDeleted);

      return {
        ...item,
        daysSinceDeleted,
        daysRemaining,
        originalFolderName: item.folder?.deletedAt ? `${item.folder.name} (deleted)` : item.folder?.name || "Unknown",
        originalFolderExists: item.folder ? !item.folder.deletedAt : false,
      };
    });

    return NextResponse.json(enrichedItems);
  } catch (error) {
    console.error("Error fetching trash items:", error);
    return NextResponse.json(
      { error: "Failed to fetch trash items" },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/trash - Permanently delete specific items from trash
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemIds array is required" },
        { status: 400 }
      );
    }

    // Fetch items and verify they belong to the user and are in trash
    const items = await prisma.vaultItem.findMany({
      where: {
        id: { in: itemIds },
        deletedAt: { not: null },
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "No trashed items found" }, { status: 404 });
    }

    // Verify permission for each item
    for (const item of items) {
      const isOwner = item.clerkId === userId;
      if (!isOwner) {
        const hasAccess = await hasAccessToProfileSimple(userId, item.profileId);
        if (!hasAccess) {
          return NextResponse.json(
            { error: `No permission to delete item ${item.id}` },
            { status: 403 }
          );
        }
      }
    }

    // Delete from S3
    const s3Keys = items.map((item) => item.awsS3Key);
    const { deleted, failed } = await deleteMultipleFromS3(s3Keys);

    if (failed.length > 0) {
      console.error("[Trash Permanent Delete] S3 deletion failed for some keys:", failed);
    }

    // Hard-delete from database (even if S3 delete failed - file may already be gone)
    await prisma.vaultItem.deleteMany({
      where: { id: { in: items.map((i) => i.id) } },
    });

    // Track storage deletion
    for (const item of items) {
      if (item.fileSize > 0) {
        trackStorageDelete(item.clerkId, item.fileSize).catch((err) => {
          console.error("[Trash Permanent Delete] Storage tracking failed:", err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: items.length,
      s3Deleted: deleted.length,
      s3Failed: failed.length,
    });
  } catch (error) {
    console.error("Error permanently deleting trash items:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete items" },
      { status: 500 }
    );
  }
}
