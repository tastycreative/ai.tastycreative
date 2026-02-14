import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to check if user can modify a folder
async function canModifyFolder(userId: string, folderId: string): Promise<boolean> {
  const folder = await prisma.vaultFolder.findUnique({
    where: { id: folderId },
    select: { 
      clerkId: true, 
      organizationSlug: true,
      isDefault: true 
    },
  });

  if (!folder) return false;

  // Can't modify default folders
  if (folder.isDefault) return false;

  // If it's a personal folder, check ownership
  if (!folder.organizationSlug) {
    return folder.clerkId === userId;
  }

  // If it's an organization folder, check membership and role
  const membership = await prisma.teamMember.findFirst({
    where: {
      user: { clerkId: userId },
      organization: { slug: folder.organizationSlug },
      role: {
        in: ['OWNER', 'ADMIN', 'MANAGER']
      }
    },
  });

  return !!membership;
}

// POST /api/vault/folders/reorder - Update the order of folders
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderOrders } = body;

    // folderOrders should be an array of { folderId: string, order: number }
    if (!Array.isArray(folderOrders)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate that all folders exist and user can modify them
    for (const { folderId } of folderOrders) {
      const canModify = await canModifyFolder(userId, folderId);
      if (!canModify) {
        return NextResponse.json(
          { error: `Cannot modify folder ${folderId} - insufficient permissions` },
          { status: 403 }
        );
      }
    }

    // Update each folder's order
    for (const { folderId, order } of folderOrders) {
      await prisma.vaultFolder.update({
        where: { id: folderId },
        data: { order },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering folders:", error);
    return NextResponse.json(
      { error: "Failed to reorder folders" },
      { status: 500 }
    );
  }
}
