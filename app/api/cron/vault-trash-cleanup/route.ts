import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { deleteMultipleFromS3 } from "@/lib/s3-cleanup";
import { trackStorageDelete } from "@/lib/storageEvents";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TRASH_RETENTION_DAYS = 30;
const BATCH_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "your-secret-key";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const cutoffDate = new Date(
      now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    console.log(
      `[Vault Trash Cleanup] Starting cleanup at ${now.toISOString()}, cutoff: ${cutoffDate.toISOString()}`,
    );

    // 1. Find expired trashed items (oldest first, limited to batch size)
    const expiredItems = await prisma.vaultItem.findMany({
      where: {
        deletedAt: { not: null, lte: cutoffDate },
      },
      select: { id: true, awsS3Key: true, fileSize: true, clerkId: true },
      take: BATCH_SIZE,
      orderBy: { deletedAt: "asc" },
    });

    let itemsRemoved = 0;
    let s3Deleted = 0;
    let s3Failed = 0;

    if (expiredItems.length > 0) {
      console.log(
        `[Vault Trash Cleanup] Found ${expiredItems.length} expired items`,
      );

      // 2. Delete from S3
      const s3Keys = expiredItems.map((item) => item.awsS3Key);
      const result = await deleteMultipleFromS3(s3Keys);
      s3Deleted = result.deleted.length;
      s3Failed = result.failed.length;

      if (result.failed.length > 0) {
        console.error(
          `[Vault Trash Cleanup] S3 deletion failed for ${result.failed.length} files`,
        );
      }

      // 3. Hard-delete from database (even if S3 failed - files may already be gone)
      await prisma.vaultItem.deleteMany({
        where: { id: { in: expiredItems.map((i) => i.id) } },
      });
      itemsRemoved = expiredItems.length;

      // 4. Track storage deletion
      for (const item of expiredItems) {
        if (item.fileSize > 0) {
          trackStorageDelete(item.clerkId, item.fileSize).catch((err) => {
            console.error(
              "[Vault Trash Cleanup] Storage tracking failed:",
              err,
            );
          });
        }
      }
    }

    // 5. Clean up expired soft-deleted folders that have no remaining items
    const expiredFolders = await prisma.vaultFolder.findMany({
      where: {
        deletedAt: { not: null, lte: cutoffDate },
      },
      select: { id: true },
    });

    let foldersRemoved = 0;

    if (expiredFolders.length > 0) {
      // Delete remaining items in these folders from S3 first
      const remainingItems = await prisma.vaultItem.findMany({
        where: { folderId: { in: expiredFolders.map((f) => f.id) } },
        select: { id: true, awsS3Key: true, fileSize: true, clerkId: true },
      });

      if (remainingItems.length > 0) {
        const remainingKeys = remainingItems.map((i) => i.awsS3Key);
        await deleteMultipleFromS3(remainingKeys);

        // Track storage for remaining items
        for (const item of remainingItems) {
          if (item.fileSize > 0) {
            trackStorageDelete(item.clerkId, item.fileSize).catch(() => {});
          }
        }
      }

      // Hard-delete folders (cascade removes remaining items from DB)
      for (const folder of expiredFolders) {
        try {
          await prisma.vaultFolder.delete({ where: { id: folder.id } });
          foldersRemoved++;
        } catch (err) {
          console.error(
            `[Vault Trash Cleanup] Failed to delete folder ${folder.id}:`,
            err,
          );
        }
      }
    }

    console.log(
      `[Vault Trash Cleanup] Complete: ${itemsRemoved} items removed, ${foldersRemoved} folders removed, S3: ${s3Deleted} deleted / ${s3Failed} failed`,
    );

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      itemsRemoved,
      foldersRemoved,
      s3Deleted,
      s3Failed,
    });
  } catch (error) {
    console.error("[Vault Trash Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Vault trash cleanup failed" },
      { status: 500 },
    );
  }
}
