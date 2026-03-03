import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { deleteMultipleFromS3 } from "@/lib/s3-cleanup";
import { trackStorageDelete } from "@/lib/storageEvents";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

// DELETE /api/vault/trash/empty - Empty entire trash for the authenticated user
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Find all trashed items for this user
    const trashedItems = await prisma.vaultItem.findMany({
      where: {
        deletedAt: { not: null },
        OR: profileOrConditions,
      },
      select: { id: true, awsS3Key: true, fileSize: true, clerkId: true },
    });

    if (trashedItems.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Delete from S3
    const s3Keys = trashedItems.map((item) => item.awsS3Key);
    const { deleted, failed } = await deleteMultipleFromS3(s3Keys);

    if (failed.length > 0) {
      console.error("[Empty Trash] S3 deletion failed for some keys:", failed);
    }

    // Hard-delete from database
    await prisma.vaultItem.deleteMany({
      where: { id: { in: trashedItems.map((i) => i.id) } },
    });

    // Also permanently delete any soft-deleted folders that have no remaining items
    const trashedFolders = await prisma.vaultFolder.findMany({
      where: {
        deletedAt: { not: null },
        clerkId: userId,
        items: { none: {} },
      },
      select: { id: true },
    });

    if (trashedFolders.length > 0) {
      await prisma.vaultFolder.deleteMany({
        where: { id: { in: trashedFolders.map((f) => f.id) } },
      });
    }

    // Track storage deletion
    for (const item of trashedItems) {
      if (item.fileSize > 0) {
        trackStorageDelete(item.clerkId, item.fileSize).catch((err) => {
          console.error("[Empty Trash] Storage tracking failed:", err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: trashedItems.length,
      foldersRemoved: trashedFolders.length,
    });
  } catch (error) {
    console.error("Error emptying trash:", error);
    return NextResponse.json(
      { error: "Failed to empty trash" },
      { status: 500 }
    );
  }
}
