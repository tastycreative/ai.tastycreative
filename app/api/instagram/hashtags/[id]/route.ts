import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper to check if user has access to a hashtag set (owner or organization member with shared profiles)
async function hasAccessToHashtagSet(userId: string, setOwnerId: string): Promise<boolean> {
  // Owner always has access
  if (userId === setOwnerId) return true;

  const user = await currentUser();
  if (!user) return false;

  // Check if the set owner has shared profiles with user's organizations
  const userOrgIds = user.organizationMemberships?.map((m: any) => m.organization.id) || [];
  
  if (userOrgIds.length > 0) {
    // Check if set owner has profiles shared with user's organizations
    const sharedProfile = await prisma.instagramProfile.findFirst({
      where: {
        clerkId: setOwnerId,
        organizationId: { in: userOrgIds },
      },
    });
    
    if (sharedProfile) return true;
  }

  return false;
}

// PATCH update hashtag set
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, description, icon, color, hashtags, order } = body;

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id },
    });

    if (!existingSet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hasAccess = await hasAccessToHashtagSet(userId, existingSet.clerkId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const set = await prisma.hashtagSet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
        ...(icon && { icon }),
        ...(color && { color }),
        ...(hashtags && { hashtags }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error updating hashtag set:", error);
    return NextResponse.json(
      { error: "Failed to update hashtag set" },
      { status: 500 }
    );
  }
}

// DELETE hashtag set
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id },
    });

    if (!existingSet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hasAccess = await hasAccessToHashtagSet(userId, existingSet.clerkId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.hashtagSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hashtag set:", error);
    return NextResponse.json(
      { error: "Failed to delete hashtag set" },
      { status: 500 }
    );
  }
}
