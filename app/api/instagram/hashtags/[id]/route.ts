import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper to check if user has access to a hashtag set (owner or organization member with shared profiles)
async function hasAccessToHashtagSet(userId: string, setOwnerId: string): Promise<boolean> {
  // Owner always has access
  if (userId === setOwnerId) return true;

  // Get user from database to check organization memberships
  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });

  if (!currentUser) return false;

  let organizationIds: string[] = [];

  // Get all organizations the user is a member of
  const memberships = await prisma.teamMember.findMany({
    where: { userId: currentUser.id },
    select: { organizationId: true },
  });

  organizationIds = memberships
    .map(m => m.organizationId)
    .filter((id): id is string => id !== null);

  // Add current organization if set
  if (currentUser.currentOrganizationId && !organizationIds.includes(currentUser.currentOrganizationId)) {
    organizationIds.push(currentUser.currentOrganizationId);
  }
  
  if (organizationIds.length > 0) {
    // Check if set owner has profiles shared with user's organizations
    const sharedProfile = await prisma.instagramProfile.findFirst({
      where: {
        clerkId: setOwnerId,
        organizationId: { in: organizationIds },
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
