import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

// POST /api/vault/trash/restore - Restore items from trash
export async function POST(request: NextRequest) {
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

    // Fetch items that are in trash
    const items = await prisma.vaultItem.findMany({
      where: {
        id: { in: itemIds },
        deletedAt: { not: null },
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ success: true, restoredCount: 0 });
    }

    // Batch permission check: collect unique profileIds, check once per profile
    const profileIds = [...new Set(items.filter((i) => i.clerkId !== userId).map((i) => i.profileId))];
    for (const profileId of profileIds) {
      const hasAccess = await hasAccessToProfileSimple(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "No permission to restore some items" },
          { status: 403 }
        );
      }
    }

    // Batch fetch: get all target folders in one query
    const targetFolderIds = [
      ...new Set(items.map((i) => i.deletedFromFolderId || i.folderId)),
    ];
    const existingFolders = await prisma.vaultFolder.findMany({
      where: { id: { in: targetFolderIds }, deletedAt: null },
      select: { id: true },
    });
    const validFolderIds = new Set(existingFolders.map((f) => f.id));

    // Batch fetch: get default folders for all profiles in one query
    const allProfileIds = [...new Set(items.map((i) => i.profileId))];
    const defaultFolders = await prisma.vaultFolder.findMany({
      where: { profileId: { in: allProfileIds }, isDefault: true, deletedAt: null },
      select: { id: true, profileId: true },
    });
    const defaultFolderMap = new Map(defaultFolders.map((f) => [f.profileId, f.id]));

    // Group items by target folder for batch updates
    const updateGroups = new Map<string, string[]>(); // folderId -> itemIds[]

    for (const item of items) {
      const originalFolderId = item.deletedFromFolderId || item.folderId;
      let targetFolderId: string;

      if (validFolderIds.has(originalFolderId)) {
        targetFolderId = originalFolderId;
      } else if (defaultFolderMap.has(item.profileId)) {
        targetFolderId = defaultFolderMap.get(item.profileId)!;
      } else {
        // Create default folder if missing (rare edge case)
        const newDefault = await prisma.vaultFolder.create({
          data: {
            clerkId: item.clerkId,
            profileId: item.profileId,
            name: "Default",
            isDefault: true,
          },
        });
        targetFolderId = newDefault.id;
        defaultFolderMap.set(item.profileId, newDefault.id);
      }

      const group = updateGroups.get(targetFolderId) || [];
      group.push(item.id);
      updateGroups.set(targetFolderId, group);
    }

    // Execute batch updates — one updateMany per target folder
    await Promise.all(
      Array.from(updateGroups.entries()).map(([folderId, ids]) =>
        prisma.vaultItem.updateMany({
          where: { id: { in: ids } },
          data: {
            deletedAt: null,
            deletedFromFolderId: null,
            folderId,
          },
        })
      )
    );

    return NextResponse.json({ success: true, restoredCount: items.length });
  } catch (error) {
    console.error("Error restoring trash items:", error);
    return NextResponse.json(
      { error: "Failed to restore items" },
      { status: 500 }
    );
  }
}
